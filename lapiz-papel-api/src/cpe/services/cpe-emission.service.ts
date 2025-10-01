import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CpeSequence } from '../entities/cpe-sequence.entity';
import { CpeDocument } from '../entities/cpe-document.entity';
import { InvoiceDto } from '../dto/invoice.dto';
import { SunatCompliantUblBuilder } from '../builders/sunat-compliant-ubl.builder';
import { XadesSignerService } from '../signer/xades-signer.service';
import { SunatSoapClient } from '../soap/sunat-soap.client';
import { CpeStatus } from '../enums/cpe-status.enum';
import { CpeStorageService } from './cpe-storage.service';
import * as AdmZip from 'adm-zip';

@Injectable()
export class CpeEmissionService {
  private builder = new SunatCompliantUblBuilder();
  private igvRate = 0.18;

  constructor(
    @InjectRepository(CpeSequence) private seqRepo: Repository<CpeSequence>,
    @InjectRepository(CpeDocument) private docRepo: Repository<CpeDocument>,
    private dataSource: DataSource,
    private signer: XadesSignerService,
    private soap: SunatSoapClient,
    private storage: CpeStorageService,
  ) {}

  private async nextSequence(docType: string, series: string): Promise<number> {
    return await this.dataSource.transaction(async (manager) => {
      let seq = await manager.findOne(CpeSequence, {
        where: { doc_type: docType, series },
      });
      if (!seq) {
        seq = manager.create(CpeSequence, {
          doc_type: docType,
          series,
          last_number: 0,
        });
      }
      seq.last_number += 1;
      await manager.save(seq);
      return seq.last_number;
    });
  }

  async emitInvoice(dto: InvoiceDto, docType: '01' | '03') {
    const series = docType === '01' ? 'F001' : 'B001'; // Hardcoded MVP
    const number = await this.nextSequence(docType, series);
    const ruc = process.env.SUNAT_RUC || '00000000000';
    const companyName = process.env.COMPANY_NAME || 'RAZON SOCIAL';
    const issueDateISO = new Date().toISOString().slice(0, 10);

    // Convertir datos a formato JSON SUNAT para usar el nuevo builder
    const sunatJson = this.convertToSunatJson(dto, {
      docType,
      ruc,
      companyName,
      series,
      number,
      issueDateISO,
    });

    const { xml } = this.builder.buildFromSunatJson(sunatJson);

    // Firmar XML usando el servicio Java XAdES
    const signed = await this.signer.sign(xml);

    // Debug: Log del XML generado
    console.log(
      '[DEBUG] Generated XML (first 1000 chars):',
      xml.substring(0, 1000),
    );
    console.log('[DEBUG] === FULL XML START ===');
    console.log(xml);
    console.log('[DEBUG] === FULL XML END ===');
    console.log(
      '[DEBUG] XML contains ProfileID:',
      xml.includes('cbc:ProfileID'),
    );
    console.log(
      '[DEBUG] XML contains InvoiceTypeCode:',
      xml.includes('cbc:InvoiceTypeCode'),
    );
    console.log(
      '[DEBUG] XML contains AdditionalAccountID:',
      xml.includes('cbc:AdditionalAccountID'),
    );

    // Validación SUNAT 3030
    if (!xml.includes('<cbc:AddressTypeCode>0000</cbc:AddressTypeCode>')) {
      throw new Error(
        'Falta cbc:AddressTypeCode=0000 en RegistrationAddress del emisor (requerido por SUNAT - 3030)',
      );
    }

    const filename = `${ruc}-${docType}-${series}-${number
      .toString()
      .padStart(8, '0')}`;
    const xmlPath = this.storage.saveFile(
      `${issueDateISO}/${filename}.xml`,
      signed.signedXml,
    );

    // Crear ZIP
    const zip = new AdmZip();
    zip.addFile(`${filename}.xml`, Buffer.from(signed.signedXml, 'utf8'));
    const zipBuffer = zip.toBuffer();
    const zipPath = this.storage.saveFile(
      `${issueDateISO}/${filename}.zip`,
      zipBuffer,
    );

    // Persist document initial
    let doc = this.docRepo.create({
      doc_type: docType,
      series,
      number,
      sale_id: dto.saleId || null,
      filename,
      hash: signed.digestValue,
      xml_path: xmlPath,
      zip_path: zipPath,
      status: CpeStatus.PENDING,
    });
    doc = await this.docRepo.save(doc);

    // Enviar a SUNAT (solo si SUNAT_ENV=beta o prod y cert real cargado)
    const env = process.env.SUNAT_ENV || 'beta';
    const endpoint =
      env === 'prod'
        ? process.env.SUNAT_PROD_ENDPOINT!
        : process.env.SUNAT_BETA_ENDPOINT!;
    try {
      // Para beta: usuario = RUC, contraseña = MODDATOS
      // Para prod: usuario = RUC + SOL_USER, contraseña = SOL_PASSWORD
      const username =
        env === 'beta' ? ruc : `${ruc}${process.env.SUNAT_SOL_USER}`;

      console.log(
        `[DEBUG] SUNAT Config: env=${env}, endpoint=${endpoint}, username=${username}, password=${process.env.SUNAT_SOL_PASSWORD}`,
      );

      // Debug: Log del XML firmado que se envía a SUNAT
      console.log(
        '[DEBUG] Signed XML being sent to SUNAT (first 2000 chars):',
        signed.signedXml.substring(0, 2000),
      );
      console.log(
        '[DEBUG] Signed XML contains AdditionalAccountID:',
        signed.signedXml.includes('cbc:AdditionalAccountID'),
      );

      const sunatResponse = await this.soap.sendBill({
        endpoint,
        username,
        password: process.env.SUNAT_SOL_PASSWORD!,
        fileName: `${filename}.zip`,
        zipContent: zipBuffer,
      });

      // Procesar respuesta CDR
      if (sunatResponse.success) {
        doc.status = CpeStatus.ACCEPTED;
        doc.sunat_code = sunatResponse.code || '0';
        doc.sunat_description = sunatResponse.description || 'Accepted';

        // Guardar CDR si está disponible
        if (sunatResponse.cdrContent) {
          const cdrPath = await this.storage.saveCdr(
            filename,
            sunatResponse.cdrContent,
          );
          doc.cdr_path = cdrPath;
        }
      } else {
        doc.status = CpeStatus.REJECTED;
        doc.sunat_code = sunatResponse.code || 'ERROR';
        doc.sunat_description =
          sunatResponse.description || 'Rejected by SUNAT';
      }

      await this.docRepo.save(doc);
    } catch (err: any) {
      doc.status = CpeStatus.ERROR;
      doc.sunat_description = (err?.message || 'SEND ERROR').slice(0, 500);
      await this.docRepo.save(doc);
    }

    return {
      id: doc.id,
      docType,
      series,
      number,
      hash: doc.hash,
      status: doc.status,
      description: doc.sunat_description,
      signedXml: signed.signedXml, // Agregar XML firmado al retorno
    };
  }

  async findOne(id: string) {
    return this.docRepo.findOne({ where: { id } });
  }

  /**
   * Convierte datos del CPE al formato JSON SUNAT requerido por el nuevo builder
   */
  private convertToSunatJson(
    dto: InvoiceDto,
    params: {
      docType: string;
      ruc: string;
      companyName: string;
      series: string;
      number: number;
      issueDateISO: string;
    },
  ): any {
    const { docType, ruc, companyName, series, number, issueDateISO } = params;

    // Calcular totales
    let subtotal = 0;
    let total = 0;
    dto.items.forEach((item) => {
      const lineTotal = item.quantity * item.unitPrice;
      total += lineTotal;
    });

    if (dto.includesIgv) {
      subtotal = total / (1 + this.igvRate);
    } else {
      subtotal = total;
      total = subtotal + subtotal * this.igvRate;
    }

    const igvTotal = total - subtotal;

    // Mapear items al formato SUNAT
    const details = dto.items.map((item, index) => {
      const itemTotal = item.quantity * item.unitPrice;
      const itemSubtotal = dto.includesIgv
        ? itemTotal / (1 + this.igvRate)
        : itemTotal;
      const itemIgv = dto.includesIgv
        ? itemTotal - itemSubtotal
        : itemSubtotal * this.igvRate;
      const itemTotalWithIgv = itemSubtotal + itemIgv;

      return {
        orden: index + 1,
        cantidad: item.quantity,
        unidad: 'NIU', // Unidad por defecto
        descripcion: item.description || 'Producto',
        mtoValorVenta: itemSubtotal,
        mtoPrecioUnitario: itemTotalWithIgv / item.quantity,
        mtoValorUnitario: itemSubtotal / item.quantity,
        igv: itemIgv,
        mtoBaseIgv: itemSubtotal,
        porcentajeIgv: this.igvRate * 100,
        tipAfeIgv: '10', // Gravado
        codProducto: item.productCode || 'ITEM001',
      };
    });

    return {
      ublVersion: '2.1',
      tipoOperacion: '0101',
      tipoDoc: docType,
      serie: series,
      correlativo: number.toString().padStart(8, '0'),
      fechaEmision: issueDateISO,
      tipoMoneda: 'PEN',
      company: {
        ruc,
        razonSocial: companyName,
        nombreComercial: companyName,
        address: {
          ubigueo: '150101',
          departamento: 'Lima',
          provincia: 'Lima',
          distrito: 'Lima',
          direccion: 'Dirección no especificada',
        },
      },
      client: {
        tipoDoc: '1', // DNI por defecto
        numDoc: '12345678',
        rznSocial: dto.customer?.name || 'Cliente',
        address: {
          direccion: 'Dirección no especificada',
        },
      },
      mtoOperGravadas: subtotal,
      mtoIGV: igvTotal,
      mtoImpVenta: total,
      details,
    };
  }
}
