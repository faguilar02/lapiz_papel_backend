import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesReceipt } from '../entities/sales-receipt.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Sale } from '../entities/sale.entity';
import { CompanySettings } from '../../common/entities/company-settings.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { CpeEmissionService } from '../../cpe/services/cpe-emission.service';
import { XadesSignerService } from '../../cpe/signer/xades-signer.service';
import { InvoiceDto } from '../../cpe/dto/invoice.dto';
import { PartyDto } from '../../cpe/dto/party.dto';
import { CpeItemDto } from '../../cpe/dto/cpe-item.dto';

@Injectable()
export class SunatDocumentService {
  private readonly logger = new Logger(SunatDocumentService.name);

  constructor(
    @InjectRepository(SalesReceipt)
    private salesReceiptRepository: Repository<SalesReceipt>,

    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,

    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,

    @InjectRepository(CompanySettings)
    private companySettingsRepository: Repository<CompanySettings>,

    private cpeEmissionService: CpeEmissionService,
    private xadesSignerService: XadesSignerService,
  ) {}

  /**
   * Actualiza un sales_receipt existente con información SUNAT
   * Detecta automáticamente si debe ser factura o boleta basado en el cliente
   */
  async updateReceiptForSunat(
    receiptId: string,
    options?: {
      forceDocumentType?: string; // '01'=Factura, '03'=Boleta (opcional, se detecta automáticamente)
      clientData?: {
        docType?: string;
        docNumber?: string;
        address?: string;
      };
    },
  ): Promise<SalesReceipt> {
    // 1. Obtener el receipt y su sale asociada
    const receipt = await this.salesReceiptRepository.findOne({
      where: { id: receiptId },
      relations: ['sale', 'sale.customer'],
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${receiptId} not found`);
    }

    // 2. Obtener configuración de la empresa
    const companySettings = await this.getCompanySettings();

    // 3. Determinar tipo de documento automáticamente
    const documentType =
      options?.forceDocumentType ||
      this.determineDocumentType(receipt.sale?.customer, options?.clientData);

    // 4. Generar serie y correlativo apropiados
    const { series, correlative } = await this.generateSeriesAndCorrelative(
      documentType,
      companySettings,
    );

    // 5. Actualizar el receipt con datos SUNAT
    const updatedReceipt = await this.salesReceiptRepository.save({
      ...receipt,
      document_type: documentType,
      operation_type: '0101', // Venta interna
      ubl_version: '2.1',
      currency: 'PEN',
      series,
      sequence_number: correlative,
      receipt_number: `${series}-${correlative.toString().padStart(8, '0')}`,

      // Datos del cliente
      client_doc_type:
        options?.clientData?.docType ||
        this.mapDocumentType(receipt.sale?.customer?.document_type),
      client_doc_number:
        options?.clientData?.docNumber ||
        receipt.sale?.customer?.document_number ||
        '',
      client_address:
        options?.clientData?.address || receipt.sale?.customer?.address || '',

      // Actualizar estado
      status: 'pending',
    });

    // 6. Actualizar items de la venta con cálculos SUNAT
    await this.updateSaleItemsForSunat(
      receipt.sale_id,
      companySettings.default_igv_rate,
    );

    // 7. Actualizar correlativo en configuración
    await this.updateCorrelative(documentType, companySettings);

    return updatedReceipt;
  }

  /**
   * Determina automáticamente el tipo de documento basado en el cliente
   */
  private determineDocumentType(customer?: any, clientData?: any): string {
    const docType = clientData?.docType || customer?.document_type;
    const docNumber = clientData?.docNumber || customer?.document_number;

    // Si tiene RUC (11 dígitos) o tipo de documento es RUC -> Factura
    if (
      docType === 'ruc' ||
      docType === '6' ||
      (docNumber && docNumber.length === 11)
    ) {
      return '01'; // Factura
    }

    // Para DNI, CE o sin documento -> Boleta
    return '03'; // Boleta
  }

  /**
   * Genera serie y correlativo apropiados según el tipo de documento
   */
  private async generateSeriesAndCorrelative(
    documentType: string,
    companySettings: CompanySettings,
  ): Promise<{ series: string; correlative: number }> {
    let series: string;
    let correlative: number;

    switch (documentType) {
      case '01': // Factura
        series = companySettings.invoice_series;
        correlative = companySettings.invoice_correlative;
        break;
      case '03': // Boleta
        series = companySettings.ticket_series;
        correlative = companySettings.ticket_correlative;
        break;
      case '07': // Nota de Crédito
        series = companySettings.credit_note_series;
        correlative = companySettings.credit_note_correlative;
        break;
      case '08': // Nota de Débito
        series = companySettings.debit_note_series;
        correlative = companySettings.debit_note_correlative;
        break;
      default:
        throw new BadRequestException(
          `Tipo de documento no soportado: ${documentType}`,
        );
    }

    return { series, correlative };
  }

  /**
   * Actualiza el correlativo en la configuración
   */
  private async updateCorrelative(
    documentType: string,
    companySettings: CompanySettings,
  ): Promise<void> {
    switch (documentType) {
      case '01': // Factura
        companySettings.invoice_correlative += 1;
        break;
      case '03': // Boleta
        companySettings.ticket_correlative += 1;
        break;
      case '07': // Nota de Crédito
        companySettings.credit_note_correlative += 1;
        break;
      case '08': // Nota de Débito
        companySettings.debit_note_correlative += 1;
        break;
    }

    await this.companySettingsRepository.save(companySettings);
  }

  /**
   * Actualiza los sale_items con cálculos SUNAT
   */
  private async updateSaleItemsForSunat(
    saleId: string,
    igvRate: number,
  ): Promise<void> {
    const saleItems = await this.saleItemRepository.find({
      where: { sale_id: saleId },
      relations: ['product'],
    });

    for (const item of saleItems) {
      // Calcular valores SUNAT
      const unitValue = Number(item.unit_price) / (1 + igvRate / 100); // Valor sin IGV
      const saleValue = unitValue * item.quantity;
      const igvAmount = saleValue * (igvRate / 100);
      const totalAmount = Number(item.unit_price) * item.quantity;

      await this.saleItemRepository.save({
        ...item,
        product_code: item.product?.sku || `PROD-${item.product_id.slice(-8)}`,
        description: item.product?.name || 'Producto',
        unit_code: 'NIU', // Unidad de medida estándar
        unit_value: Number(unitValue.toFixed(2)),
        sale_value: Number(saleValue.toFixed(2)),
        igv_base_amount: Number(saleValue.toFixed(2)),
        igv_rate: igvRate,
        igv_amount: Number(igvAmount.toFixed(2)),
        total_taxes: Number(igvAmount.toFixed(2)),
        total_amount: Number(totalAmount.toFixed(2)),
        tax_affectation_type: '10', // Gravado - Operación Onerosa
      });
    }
  }

  /**
   * Genera el JSON en formato SUNAT UBL (funciona para facturas y boletas)
   */
  async generateSunatJson(receiptId: string): Promise<any> {
    const receipt = await this.salesReceiptRepository.findOne({
      where: { id: receiptId },
      relations: ['sale', 'sale.items', 'sale.customer', 'sale.items.product'],
    });

    if (!receipt) {
      throw new NotFoundException(
        'Receipt not found for SUNAT JSON generation',
      );
    }

    const saleItems = await this.saleItemRepository.find({
      where: { sale_id: receipt.sale_id },
      relations: ['product'],
    });

    const companySettings = await this.getCompanySettings();

    // Determinar nombre del documento
    const documentTypeName =
      receipt.document_type === '01' ? 'FACTURA' : 'BOLETA';

    // Estructura JSON compatible con SUNAT
    const sunatDocument = {
      ublVersion: receipt.ubl_version,
      tipoOperacion: receipt.operation_type,
      tipoDoc: receipt.document_type,
      serie: receipt.series,
      correlativo: receipt.sequence_number.toString().padStart(8, '0'),
      fechaEmision: receipt.issue_date.toISOString().split('T')[0],
      tipoMoneda: receipt.currency,

      // Datos del emisor (empresa)
      company: {
        ruc: companySettings.ruc,
        razonSocial: companySettings.business_name,
        nombreComercial: companySettings.trade_name,
        address: {
          ubigueo: companySettings.ubigeo,
          departamento: companySettings.department,
          provincia: companySettings.province,
          distrito: companySettings.district,
          direccion: companySettings.address,
        },
      },

      // Datos del cliente (automáticamente formateado según tipo de documento)
      client: {
        tipoDoc: receipt.client_doc_type,
        numDoc: receipt.client_doc_number,
        rznSocial:
          receipt.customer_name ||
          receipt.sale?.customer?.display_name ||
          'Cliente General',
        // Solo incluir dirección si es factura (obligatorio) o si está disponible
        ...(receipt.document_type === '01' || receipt.client_address
          ? {
              address: {
                direccion:
                  receipt.client_address ||
                  receipt.sale?.customer?.address ||
                  'Dirección no especificada',
              },
            }
          : {}),
      },

      // Totales
      mtoOperGravadas: receipt.sale?.subtotal || 0,
      mtoIGV: receipt.sale?.igv_amount || 0,
      totalImpuestos: receipt.sale?.igv_amount || 0,
      mtoImpVenta: receipt.sale?.total_amount || 0,

      // Detalles de productos
      details: saleItems.map((item, index) => ({
        codProducto: item.product_code,
        unidad: item.unit_code,
        descripcion: item.description,
        cantidad: item.quantity,
        mtoValorUnitario: item.unit_value,
        mtoValorVenta: item.sale_value,
        mtoBaseIgv: item.igv_base_amount,
        porcentajeIgv: item.igv_rate,
        igv: item.igv_amount,
        tipAfeIgv: item.tax_affectation_type,
        totalImpuestos: item.total_taxes,
        mtoPrecioUnitario: item.unit_price,
        mtoValorGratuito: 0,
        orden: index + 1,
      })),

      // Metadatos útiles
      metadata: {
        documentTypeName,
        isFactura: receipt.document_type === '01',
        isBoleta: receipt.document_type === '03',
        clientType: receipt.client_doc_type === '6' ? 'EMPRESA' : 'PERSONA',
        generatedAt: new Date().toISOString(),
      },
    };

    return sunatDocument;
  }

  /**
   * Genera y emite documento completo a SUNAT (XML firmado + envío)
   */
  async generateAndEmitToSunat(receiptId: string): Promise<{
    cpeDocumentId: string;
    documentId: string;
    status: string;
    description: string;
    hash: string;
    signedXml?: string;
  }> {
    // Verificar si XAdES está habilitado
    if (!this.xadesSignerService.isEnabled()) {
      this.logger.warn(
        `Attempted to emit to SUNAT but XAdES is disabled. Receipt ID: ${receiptId}`,
      );

      // Actualizar el receipt indicando que la emisión está deshabilitada
      await this.salesReceiptRepository.update(receiptId, {
        sunat_status_code: 'DISABLED',
        sunat_status_message:
          'CPE emission is disabled. Using external API for electronic invoicing.',
        sent_to_sunat_at: new Date(),
      });

      return {
        cpeDocumentId: 'N/A',
        documentId: 'N/A',
        status: 'DISABLED',
        description:
          'CPE emission is disabled. Configure XADES_URL to enable built-in SUNAT emission, or use your external API.',
        hash: 'N/A',
        signedXml: undefined,
      };
    }

    const receipt = await this.salesReceiptRepository.findOne({
      where: { id: receiptId },
      relations: ['sale', 'sale.customer'],
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${receiptId} not found`);
    }

    const saleItems = await this.saleItemRepository.find({
      where: { sale_id: receipt.sale_id },
      relations: ['product'],
    });

    // Convertir datos a formato CPE
    const customer: PartyDto = {
      docType:
        receipt.client_doc_type ||
        this.mapDocumentType(receipt.sale?.customer?.document_type),
      docNumber:
        receipt.client_doc_number ||
        receipt.sale?.customer?.document_number ||
        '',
      name:
        receipt.customer_name ||
        receipt.sale?.customer?.display_name ||
        'Cliente General',
      address: receipt.client_address || receipt.sale?.customer?.address,
    };

    const items: CpeItemDto[] = saleItems.map((item) => ({
      description: item.description || item.product?.name || 'Producto',
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      unitCode: item.unit_code || 'NIU',
      taxAffectation: item.tax_affectation_type || '10',
      includesIgv: receipt.sale?.includes_igv ?? true,
      productCode: item.product_code || item.product?.sku,
    }));

    const invoiceDto: InvoiceDto = {
      customer,
      items,
      currency: receipt.currency || 'PEN',
      includesIgv: receipt.sale?.includes_igv ?? true,
      saleId: receipt.sale_id,
    };

    // Emitir usando el servicio CPE completo
    const result = await this.cpeEmissionService.emitInvoice(
      invoiceDto,
      receipt.document_type as '01' | '03',
    );

    // Actualizar receipt con información del CPE incluyendo XML firmado
    await this.salesReceiptRepository.update(receiptId, {
      hash: result.hash,
      signed_xml: result.signedXml, // Guardar XML firmado
      sunat_status_code: result.status === 'ACCEPTED' ? '0' : 'ERROR',
      sunat_status_message: result.description,
      accepted_by_sunat_at: result.status === 'ACCEPTED' ? new Date() : null,
      sent_to_sunat_at: new Date(),
    });

    return {
      cpeDocumentId: result.id,
      documentId: `${result.series}-${result.number
        .toString()
        .padStart(8, '0')}`,
      status: result.status,
      description: result.description,
      hash: result.hash,
      signedXml: result.signedXml,
    };
  }

  /**
   * Genera XML UBL 2.1 completo usando el JSON SUNAT
   */
  async generateSunatXml(receiptId: string): Promise<{
    xml: string;
    hashBase: string;
    total: number;
    igv: number;
    subtotal: number;
    documentId: string;
  }> {
    // 1. Generar el JSON SUNAT completo
    const sunatJson = await this.generateSunatJson(receiptId);

    // 2. Usar el builder 100% conforme a SUNAT para crear XML desde JSON
    const { SunatCompliantUblBuilder } = await import(
      '../../cpe/builders/sunat-compliant-ubl.builder'
    );
    const builder = new SunatCompliantUblBuilder();

    const result = builder.buildFromSunatJson(sunatJson);

    // 3. Guardar XML en el receipt
    await this.salesReceiptRepository.update(receiptId, {
      xml_content: result.xml,
      hash: result.hashBase,
    });

    return {
      ...result,
      documentId: `${sunatJson.serie}-${sunatJson.correlativo}`,
    };
  }

  /**
   * Obtiene el XML generado para un documento
   */
  async getGeneratedXml(receiptId: string): Promise<string> {
    const receipt = await this.salesReceiptRepository.findOne({
      where: { id: receiptId },
      select: ['xml_content'],
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${receiptId} not found`);
    }

    if (!receipt.xml_content) {
      throw new BadRequestException(
        'XML not generated yet. Call generateSunatXml first.',
      );
    }

    return receipt.xml_content;
  }

  /**
   * Obtiene el XML firmado (signed XML) para un documento
   */
  async getSignedXml(receiptId: string): Promise<string> {
    const receipt = await this.salesReceiptRepository.findOne({
      where: { id: receiptId },
      select: ['signed_xml'],
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${receiptId} not found`);
    }

    if (!receipt.signed_xml) {
      throw new BadRequestException(
        'Signed XML not available. The document may not have been processed through SUNAT emission yet.',
      );
    }

    return receipt.signed_xml;
  }

  /**
   * Marca un documento como enviado a SUNAT
   */
  async markAsSentToSunat(receiptId: string, ticket: string): Promise<void> {
    await this.salesReceiptRepository.update(receiptId, {
      sunat_ticket: ticket,
      sent_to_sunat_at: new Date(),
      status: 'sent',
    });
  }

  /**
   * Actualiza el estado con la respuesta de SUNAT
   */
  async updateSunatResponse(
    receiptId: string,
    statusCode: string,
    statusMessage: string,
    cdrContent?: string,
  ): Promise<void> {
    await this.salesReceiptRepository.update(receiptId, {
      sunat_status_code: statusCode,
      sunat_status_message: statusMessage,
      cdr_content: cdrContent,
      accepted_by_sunat_at: statusCode === '0' ? new Date() : null,
      status: statusCode === '0' ? 'accepted' : 'rejected',
    });
  }

  /**
   * Obtiene la configuración de la empresa
   */
  private async getCompanySettings(): Promise<CompanySettings> {
    const settings = await this.companySettingsRepository.findOne({
      where: { is_active: true },
    });

    if (!settings) {
      throw new BadRequestException('Company settings not configured');
    }

    return settings;
  }

  /**
   * Mapea el tipo de documento del cliente
   */
  private mapDocumentType(documentType?: string): string {
    switch (documentType) {
      case 'ruc':
        return '6';
      case 'dni':
        return '1';
      case 'ce':
        return '4';
      default:
        return '1'; // DNI por defecto
    }
  }
}
