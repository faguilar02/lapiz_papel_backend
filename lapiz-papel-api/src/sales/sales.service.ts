import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { SalesReceipt } from './entities/sales-receipt.entity';
import {
  CreateSaleDto,
  UpdateSaleDto,
  CreateSaleReceiptDto,
  SearchReceiptsDto,
  SearchSalesDto,
} from './dto';
import { UpdateSaleReceiptDto } from './dto/update-sale-receipt.dto';
import { PaginationDto } from '../auth/dto';
import { ProductsService } from '../products/products.service';
import { CustomersService } from '../customers/customers.service';
import { User } from '../auth/entities/user.entity';
import { InventoryService } from 'src/inventory/inventory.service';
import { PaginatedResponse } from '../auth/interfaces/paginated-response.interface';
import { createPaginatedResponse } from '../auth/utils/pagination.helper';
import { IGVCalculatorUtil } from './utils/igv-calculator.util';
import { CpeEmissionService } from '../cpe/services/cpe-emission.service';
import { SunatDocumentService } from './services/sunat-document.service';
import { InvoiceDto } from '../cpe/dto/invoice.dto';
import { DocumentType, Customer } from '../customers/entities/customer.entity';
import { CompanySettings } from '../common/entities/company-settings.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(SalesReceipt)
    private readonly salesReceiptRepository: Repository<SalesReceipt>,
    @InjectRepository(CompanySettings)
    private readonly companySettingsRepository: Repository<CompanySettings>,
    private readonly productsService: ProductsService,
    private readonly customersService: CustomersService,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
    private readonly cpeEmissionService: CpeEmissionService,
    private readonly sunatDocumentService: SunatDocumentService,
  ) {}

  async create(createSaleDto: CreateSaleDto, user: User): Promise<Sale> {
    console.log(
      '🛒 Starting sale creation process...',
      createSaleDto.receipt_type,
    );
    console.log('🔧 CpeEmissionService available:', !!this.cpeEmissionService);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Handle customer resolution/creation
      let customerId = createSaleDto.customer_id;

      // If customer_data is provided but no customer_id, create/find customer
      if (!customerId && createSaleDto.customer_data) {
        console.log('🆕 Creating/finding customer from provided data');
        const customer = await this.customersService.findOrCreateByDocument(
          createSaleDto.customer_data.document_number,
          createSaleDto.customer_data.document_type,
          {
            display_name: createSaleDto.customer_data.display_name,
            email: createSaleDto.customer_data.email,
            phone: createSaleDto.customer_data.phone,
            address: createSaleDto.customer_data.address,
            status: createSaleDto.customer_data.status,
            condition: createSaleDto.customer_data.condition,
          },
        );
        customerId = customer.id;
        console.log('✅ Customer resolved with ID:', customerId);
      }

      // Calculate IGV if needed
      let igvCalculation;
      if (createSaleDto.includes_igv) {
        console.log('🧮 Calculating IGV for sale');
        igvCalculation = IGVCalculatorUtil.autoCalculateIGV(
          createSaleDto.total_amount,
          createSaleDto.includes_igv,
          createSaleDto.igv_rate || 0.18,
        );
        console.log('📊 IGV Calculation:', igvCalculation);

        // Validate that provided amounts match calculated amounts (allow small rounding differences)
        const providedSubtotal = createSaleDto.subtotal;
        const calculatedSubtotal = igvCalculation.subtotal;
        const difference = Math.abs(providedSubtotal - calculatedSubtotal);

        if (difference > 0.02) {
          // Allow 2 cent difference for rounding
          console.warn(
            '⚠️ Subtotal mismatch detected, using calculated values',
          );
        }
      }

      // Validate products and stock
      for (const item of createSaleDto.items) {
        const product = await this.productsService.findOne(item.product_id);
        if (product.stock_quantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.name}`,
          );
        }
      }

      // Create sale with IGV calculations
      const saleData = {
        ...createSaleDto,
        customer_id: customerId,
        created_by: user.id,
        // Use calculated values if IGV is included
        ...(igvCalculation && {
          subtotal: igvCalculation.subtotal,
          igv_amount: igvCalculation.igv_amount,
          total_amount: igvCalculation.total_amount,
        }),
      };

      const sale = this.saleRepository.create(saleData);
      const savedSale = await queryRunner.manager.save(Sale, sale);

      // Create sale items
      const saleItems = createSaleDto.items.map((item) => {
        const total_price = item.quantity * item.unit_price;
        return this.saleItemRepository.create({
          ...item,
          sale_id: savedSale.id,
          total_price,
        });
      });
      await queryRunner.manager.save(SaleItem, saleItems);

      // Update product stock and create inventory movements
      for (const item of createSaleDto.items) {
        await this.productsService.updateStock(item.product_id, -item.quantity);
        await this.inventoryService.create(
          {
            product_id: item.product_id,
            movement_type: 'exit',
            quantity: -item.quantity,
            reason: 'Sale',
            reference_id: savedSale.id,
            reference_type: 'sale',
          },
          user,
        );
      }

      // Create automatic receipt for the sale
      // Determine series based on receipt type
      let receiptSeries = createSaleDto.receipt_series;
      if (!receiptSeries) {
        switch (createSaleDto.receipt_type) {
          case 'boleta':
            receiptSeries = 'B001';
            break;
          case 'factura':
            receiptSeries = 'F001';
            break;
          case 'nota':
          default:
            receiptSeries = 'NV01';
            break;
        }
      }

      // Get next sequence number for this series
      const lastReceipt = await queryRunner.manager
        .createQueryBuilder(SalesReceipt, 'receipt')
        .where('receipt.series = :series', { series: receiptSeries })
        .orderBy('receipt.sequence_number', 'DESC')
        .getOne();

      const sequenceNumber = lastReceipt ? lastReceipt.sequence_number + 1 : 1;
      // ✅ Formato uniforme con padding de 8 dígitos para todos los receipts
      const receiptNumber = `${receiptSeries}-${sequenceNumber
        .toString()
        .padStart(8, '0')}`;

      // Determine customer name for receipt
      let receiptCustomerName = createSaleDto.receipt_customer_name;
      if (!receiptCustomerName && createSaleDto.customer_data) {
        receiptCustomerName = createSaleDto.customer_data.display_name;
      }
      if (!receiptCustomerName && !customerId) {
        receiptCustomerName = 'Cliente Anónimo';
      }

      // Create the receipt
      const receipt = this.salesReceiptRepository.create({
        sale_id: savedSale.id,
        series: receiptSeries,
        receipt_number: receiptNumber,
        sequence_number: sequenceNumber,
        customer_name: receiptCustomerName,
        customer_phone:
          createSaleDto.receipt_customer_phone ||
          createSaleDto.customer_data?.phone ||
          null,
        notes: createSaleDto.receipt_notes || null,
      });

      await queryRunner.manager.save(SalesReceipt, receipt);

      console.log(
        '📋 Receipt saved successfully. About to check CPE conditions...',
      );
      console.log('📄 Receipt type:', createSaleDto.receipt_type);

      await queryRunner.commitTransaction();
      console.log(
        '✅ Transaction committed successfully for sale:',
        savedSale.id,
      );

      // 🚀 SECUENCIA AUTOMÁTICA SUNAT COMPLETA - DESPUÉS DEL COMMIT
      console.log('🔍 Checking SUNAT automatic processing conditions...');
      if (
        createSaleDto.receipt_type === 'boleta' ||
        createSaleDto.receipt_type === 'factura'
      ) {
        try {
          console.log(
            '🎯 Iniciando secuencia SUNAT automática para:',
            savedSale.id,
          );

          // Obtener datos del customer usando el customer service
          const customer = await this.customersService.findOne(customerId);

          if (customer) {
            // Ejecutar secuencia completa SUNAT pasando el receipt object directamente
            this.executeFullSunatSequenceWithReceipt(
              receipt,
              customer,
              createSaleDto.receipt_type,
            )
              .then((sunatResult) => {
                console.log(
                  '✅ Secuencia SUNAT completada exitosamente:',
                  sunatResult,
                );
              })
              .catch((sunatError) => {
                console.error(
                  '❌ Error en secuencia SUNAT:',
                  sunatError.message,
                );
                // Log error but don't affect the sale transaction
              });
          }
        } catch (error) {
          console.error('⚠️ Error iniciando secuencia SUNAT:', error.message);
          // No lanzamos error para no afectar la venta principal
        }
      }
      return this.findOne(savedSale.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<Sale>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const [data, total] = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.creator', 'creator')
      .addSelect('sale.is_active')
      .orderBy('sale.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return createPaginatedResponse(data, total, limit, offset);
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: ['customer', 'creator', 'items', 'items.product', 'receipts'],
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return sale;
  }

  async update(id: string, updateSaleDto: UpdateSaleDto): Promise<Sale> {
    const sale = await this.findOne(id);
    Object.assign(sale, updateSaleDto);
    return await this.saleRepository.save(sale);
  }

  async remove(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sale = await this.findOne(id);

      // Si la venta tenía productos despachados, devolver el stock
      for (const item of sale.items) {
        await this.productsService.updateStock(item.product_id, item.quantity);
        await this.inventoryService.create(
          {
            product_id: item.product_id,
            movement_type: 'entry',
            quantity: item.quantity,
            reason: 'Sale cancelled (set inactive)',
            reference_id: sale.id,
            reference_type: 'sale',
          },
          { id: sale.created_by } as User,
        );
      }

      sale.is_active = false;
      await queryRunner.manager.save(sale);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Manual receipt creation - for additional receipts or custom series
  // Note: Each sale now automatically creates a receipt with series 'NV-001'
  async createReceipt(
    createReceiptDto: CreateSaleReceiptDto,
  ): Promise<SalesReceipt> {
    const sale = await this.findOne(createReceiptDto.sale_id);

    // Get next sequence number for this series
    const lastReceipt = await this.salesReceiptRepository
      .createQueryBuilder('receipt')
      .where('receipt.series = :series', { series: createReceiptDto.series })
      .orderBy('receipt.sequence_number', 'DESC')
      .getOne();

    const sequenceNumber = lastReceipt ? lastReceipt.sequence_number + 1 : 1;
    // ✅ Formato uniforme con padding de 8 dígitos para todos los receipts
    const receiptNumber = `${createReceiptDto.series}-${sequenceNumber
      .toString()
      .padStart(8, '0')}`;

    const receipt = this.salesReceiptRepository.create({
      ...createReceiptDto,
      receipt_number: receiptNumber,
      sequence_number: sequenceNumber,
    });

    return await this.salesReceiptRepository.save(receipt);
  }

  async getSalesReport(startDate: Date, endDate: Date): Promise<any> {
    const result = await this.saleRepository
      .createQueryBuilder('sale')
      .select([
        'COUNT(sale.id) as total_sales',
        'SUM(sale.total_amount) as total_revenue',
        'AVG(sale.total_amount) as average_sale',
        'DATE(sale.created_at) as sale_date',
      ])
      .where('sale.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('DATE(sale.created_at)')
      .orderBy('sale_date', 'DESC')
      .getRawMany();

    return result;
  }

  // Receipts management methods
  async searchReceipts(searchDto: SearchReceiptsDto): Promise<{
    data: any[];
    total: number;
    pagination: {
      current_page: number;
      total_pages: number;
      total_items: number;
      items_per_page: number;
    };
  }> {
    const limit = searchDto.limit || 20;
    const offset = searchDto.offset || 0;
    const currentPage = Math.floor(offset / limit) + 1;

    console.log('🔍 Sales Service: searchReceipts called with:', searchDto);

    let query = this.salesReceiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.sale', 'sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.creator', 'creator')
      .select([
        'receipt.id',
        'receipt.receipt_number',
        'receipt.series',
        'receipt.sequence_number',
        'receipt.status',
        'receipt.customer_name',
        'receipt.customer_phone',
        'receipt.notes',
        'receipt.created_at',
        'sale.id',
        'sale.subtotal',
        'sale.discount_amount',
        'sale.total_amount',
        'sale.payment_method',
        'sale.notes',
        'sale.created_at',
        'customer.id',
        'customer.display_name',
        'creator.id',
        'creator.full_name',
      ]);

    // Búsqueda general por cliente, cajero o número de recibo
    if (searchDto.search) {
      query = query.andWhere(
        '(customer.display_name ILIKE :search OR creator.full_name ILIKE :search OR receipt.receipt_number ILIKE :search)',
        { search: `%${searchDto.search}%` },
      );
    }

    // Specific field searches
    if (searchDto.receipt_number) {
      query = query.andWhere('receipt.receipt_number ILIKE :receiptNumber', {
        receiptNumber: `%${searchDto.receipt_number}%`,
      });
    }

    if (searchDto.payment_method) {
      query = query.andWhere('sale.payment_method = :paymentMethod', {
        paymentMethod: searchDto.payment_method,
      });
    }

    // Date range filters - Filtrar por fecha de la venta, no del recibo
    // Ajustar fechas para zona horaria local (Peru UTC-5)
    if (searchDto.start_date && searchDto.end_date) {
      // Crear fechas en zona horaria local de Peru (UTC-5)
      const startDate = new Date(searchDto.start_date + 'T05:00:00.000Z'); // 00:00 Peru = 05:00 UTC
      const endDate = new Date(searchDto.end_date + 'T23:59:59.999-05:00'); // 23:59:59 Peru (final del día)

      query = query.andWhere(
        'sale.created_at BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    } else if (searchDto.start_date) {
      const startDate = new Date(searchDto.start_date + 'T05:00:00.000Z'); // 00:00 Peru = 05:00 UTC
      query = query.andWhere('sale.created_at >= :startDate', { startDate });
    } else if (searchDto.end_date) {
      const endDate = new Date(searchDto.end_date + 'T23:59:59.999-05:00'); // 23:59:59 Peru (final del día)
      query = query.andWhere('sale.created_at <= :endDate', { endDate });
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.getCount();

    // Apply pagination and ordering
    const receipts = await query
      .orderBy('receipt.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getMany();

    // Format response data
    const data = receipts.map((receipt) => ({
      id: receipt.id,
      receipt_number: receipt.receipt_number,
      series: receipt.series,
      status: receipt.status,
      date: receipt.sale?.created_at || receipt.created_at, // Fecha de la venta, fallback a fecha del recibo
      customer_name:
        receipt.customer_name ||
        receipt.sale?.customer?.display_name ||
        'Cliente Anónimo',
      customer_phone: receipt.customer_phone,
      total_amount: receipt.sale?.total_amount || 0,
      payment_method: receipt.sale?.payment_method || 'N/A',
      cashier_name: receipt.sale?.creator?.full_name || 'N/A',
      sale_id: receipt.sale?.id,
      sale_date: receipt.sale?.created_at,
      receipt_date: receipt.created_at, // Agregamos la fecha del recibo por separado
      notes: receipt.notes,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      pagination: {
        current_page: currentPage,
        total_pages: totalPages,
        total_items: total,
        items_per_page: limit,
      },
    };
  }

  async updateReceipt(
    id: string,
    updateSaleReceiptDto: UpdateSaleReceiptDto,
  ): Promise<SalesReceipt> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const receipt = await this.salesReceiptRepository
        .createQueryBuilder('receipt')
        .leftJoinAndSelect('receipt.sale', 'sale')
        .leftJoinAndSelect('sale.items', 'items')
        .where('receipt.id = :id', { id })
        .getOne();

      if (!receipt) {
        throw new NotFoundException('Receipt not found');
      }

      const oldStatus = receipt.status;
      const newStatus = updateSaleReceiptDto.status;

      // Si se está cambiando el status a cancelled
      if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
        // Desactivar la venta asociada
        receipt.sale.is_active = false;
        await queryRunner.manager.save(receipt.sale);

        // Reponer el stock de los productos
        for (const item of receipt.sale.items) {
          await this.productsService.updateStock(
            item.product_id,
            item.quantity,
          );
          // Crear el movimiento de inventario
          await this.inventoryService.create(
            {
              product_id: item.product_id,
              movement_type: 'entry',
              quantity: item.quantity,
              reason: 'Sale cancelled (Receipt cancelled)',
              reference_id: receipt.sale.id,
              reference_type: 'sale',
            },
            { id: receipt.sale.created_by } as User,
          );
        }
      }

      // Actualizar el recibo
      Object.assign(receipt, updateSaleReceiptDto);
      await queryRunner.manager.save(receipt);

      await queryRunner.commitTransaction();
      return receipt;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getReceiptById(id: string): Promise<any> {
    const receipt = await this.salesReceiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.sale', 'sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.creator', 'creator')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('receipt.id = :id', { id })
      .getOne();

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    return {
      id: receipt.id,
      sale_id: receipt.sale_id,
      receipt_number: receipt.receipt_number,
      series: receipt.series,
      sequence_number: receipt.sequence_number,
      status: receipt.status,
      customer_name: receipt.customer_name,
      customer_phone: receipt.customer_phone,
      notes: receipt.notes,

      // Campos SUNAT
      ubl_version: receipt.ubl_version,
      document_type: receipt.document_type,
      operation_type: receipt.operation_type,
      issue_date: receipt.issue_date,
      currency: receipt.currency,
      client_doc_type: receipt.client_doc_type,
      client_doc_number: receipt.client_doc_number,
      client_address: receipt.client_address,
      xml_content: receipt.xml_content,
      signed_xml: receipt.signed_xml,
      hash: receipt.hash,
      sunat_ticket: receipt.sunat_ticket,
      sunat_response: receipt.sunat_response,
      cdr_content: receipt.cdr_content,
      sunat_status_code: receipt.sunat_status_code,
      sunat_status_message: receipt.sunat_status_message,
      sent_to_sunat_at: receipt.sent_to_sunat_at,
      accepted_by_sunat_at: receipt.accepted_by_sunat_at,

      created_at: receipt.created_at,
      updated_at: receipt.updated_at,
      sale: {
        id: receipt.sale.id,
        subtotal: receipt.sale.subtotal,
        discount_amount: receipt.sale.discount_amount,
        total_amount: receipt.sale.total_amount,
        payment_method: receipt.sale.payment_method,
        created_at: receipt.sale.created_at,
        customer: receipt.sale.customer
          ? {
              id: receipt.sale.customer.id,
              name: receipt.sale.customer.display_name,
              document_type: receipt.sale.customer.document_type,
              document_number: receipt.sale.customer.document_number,
              phone: receipt.sale.customer.phone,
              address: receipt.sale.customer.address,
            }
          : null,
        creator: receipt.sale.creator
          ? {
              id: receipt.sale.creator.id,
              full_name: receipt.sale.creator.full_name,
              email: receipt.sale.creator.email,
            }
          : null,
        items:
          receipt.sale.items?.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            product: item.product
              ? {
                  id: item.product.id,
                  name: item.product.name,
                  sku: item.product.sku,
                }
              : null,
          })) || [],
      },
    };
  }

  async getAllReceipts(
    limit = 20,
    offset = 0,
  ): Promise<{
    data: any[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    const [receipts, total] = await this.salesReceiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.sale', 'sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.creator', 'creator')
      .select([
        'receipt.id',
        'receipt.receipt_number',
        'receipt.series',
        'receipt.status',
        'receipt.customer_name',
        'receipt.customer_phone',
        'receipt.notes',
        'receipt.created_at',
        'sale.id',
        'sale.total_amount',
        'sale.payment_method',
        'sale.created_at',
        'sale.is_active',
        'customer.id',
        'customer.display_name',
        'creator.id',
        'creator.full_name',
      ])
      .orderBy('receipt.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    const data = receipts.map((receipt) => ({
      id: receipt.id,
      receipt_number: receipt.receipt_number,
      series: receipt.series,
      status: receipt.status, // Incluimos el status para trazabilidad
      date: receipt.created_at,
      customer_name:
        receipt.customer_name ||
        receipt.sale?.customer?.display_name ||
        'Cliente Anónimo',
      customer_phone: receipt.customer_phone,
      total_amount: receipt.sale?.total_amount || 0,
      payment_method: receipt.sale?.payment_method || 'N/A',
      cashier_name: receipt.sale?.creator?.full_name || 'N/A',
      sale_id: receipt.sale?.id,
      sale_is_active: receipt.sale?.is_active, // Incluimos is_active de la venta asociada
      notes: receipt.notes,
    }));

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return { data, total, totalPages, currentPage };
  }

  async search(searchDto: SearchSalesDto): Promise<PaginatedResponse<Sale>> {
    const {
      search,
      start_date,
      end_date,
      payment_method,
      limit = 20,
      offset = 0,
    } = searchDto;

    console.log('🔍 Sales Service: search called with:', searchDto);

    const queryBuilder = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.creator', 'creator')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .addSelect('sale.is_active')
      .orderBy('sale.created_at', 'DESC');

    // Búsqueda general por cliente o cajero
    if (search) {
      queryBuilder.andWhere(
        '(customer.display_name ILIKE :search OR creator.full_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Filtro por método de pago específico
    if (payment_method) {
      queryBuilder.andWhere('sale.payment_method = :paymentMethod', {
        paymentMethod: payment_method,
      });
    }

    // Filtro por rango de fechas - Ajustado para zona horaria de Peru (UTC-5)
    if (start_date && end_date) {
      // Crear fechas en zona horaria local de Peru (UTC-5)
      const startDate = new Date(start_date + 'T05:00:00.000Z'); // 00:00 Peru = 05:00 UTC
      const endDate = new Date(end_date + 'T23:59:59.999-05:00'); // 23:59:59 Peru (final del día)

      queryBuilder.andWhere('sale.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (start_date) {
      const startDate = new Date(start_date + 'T05:00:00.000Z'); // 00:00 Peru = 05:00 UTC
      queryBuilder.andWhere('sale.created_at >= :startDate', { startDate });
    } else if (end_date) {
      const endDate = new Date(end_date + 'T23:59:59.999-05:00'); // 23:59:59 Peru (final del día)
      queryBuilder.andWhere('sale.created_at <= :endDate', { endDate });
    }

    const [data, total] = await queryBuilder
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    console.log('🔍 Sales Service: found', total, 'sales');
    return createPaginatedResponse(data, total, limit, offset);
  }

  /**
   * Mapea los datos de una venta al formato requerido por el servicio CPE
   */
  private async mapSaleToCpeDto(
    sale: Sale,
    saleItems: SaleItem[],
    customer: any,
    createSaleDto: CreateSaleDto,
  ): Promise<InvoiceDto> {
    // Mapear items de la venta a formato CPE
    const items = await Promise.all(
      saleItems.map(async (item) => {
        // Obtener información del producto para la descripción
        const product = await this.productsService.findOne(item.product_id);

        return {
          description: product?.name || 'Producto',
          quantity: item.quantity,
          unitCode: 'NIU', // NIU = Unidad (servicio)
          unitPrice: Number(item.unit_price),
          taxAffectation: '10', // 10 = Operación Onerosa Gravada
          includesIgv: createSaleDto.includes_igv || false,
          productCode: item.product_id,
        };
      }),
    );

    // Determinar tipo de documento del cliente
    const docType = customer.document_type === 'ruc' ? '6' : '1';

    return {
      customer: {
        docType,
        docNumber: customer.document_number,
        name: customer.display_name,
        address: customer.address || 'Sin dirección',
        ubigeo: '130101', // Default: San Martín de Porres, Lima
        distrito: 'SAN MARTIN DE PORRES',
        provincia: 'LIMA',
        departamento: 'LIMA',
      },
      items,
      currency: 'PEN',
      includesIgv: createSaleDto.includes_igv || false,
      saleId: sale.id,
    };
  }

  /**
   * 🚀 SECUENCIA AUTOMÁTICA SUNAT COMPLETA
   * Ejecuta todo el proceso SUNAT automáticamente al crear una venta:
   * 1. Prepara receipt con campos SUNAT
   * 2. Genera JSON SUNAT completo
   * 3. Genera XML UBL 2.1
   * 4. Emite a SUNAT (firma + envío)
   */
  // Método mejorado que recibe el receipt directamente para evitar problemas de timing
  private async executeFullSunatSequenceWithReceipt(
    receipt: SalesReceipt,
    customer: Customer,
    receiptType: string,
  ): Promise<{
    step1_prepare: boolean;
    step2_json: boolean;
    step3_xml: boolean;
    step4_emit: boolean;
    result: any;
    errors: string[];
  }> {
    const errors: string[] = [];
    let result: any = {};

    try {
      console.log(
        `🔧 PASO 1: Preparando receipt ${receipt.id} con campos SUNAT...`,
      );

      // 1. PREPARAR RECEIPT CON CAMPOS SUNAT
      await this.sunatDocumentService.updateReceiptForSunat(receipt.id, {
        clientData: {
          docType: customer.document_type === 'ruc' ? '6' : '1',
          docNumber: customer.document_number,
          address: customer.address || 'Dirección no especificada',
        },
      });
      console.log('✅ PASO 1 completado: Receipt preparado');

      console.log('📄 PASO 2: Generando JSON SUNAT completo...');

      // 2. GENERAR JSON SUNAT COMPLETO
      const sunatJson = await this.sunatDocumentService.generateSunatJson(
        receipt.id,
      );
      result.sunatJson = {
        documentType: sunatJson.documentType,
        serie: sunatJson.serie,
        numero: sunatJson.numero,
        total: sunatJson.importeTotal,
      };
      console.log('✅ PASO 2 completado: JSON SUNAT generado');
      console.log('📋 JSON SUNAT GENERADO:');
      console.log('=====================================');
      console.log(JSON.stringify(sunatJson, null, 2));
      console.log('=====================================');

      console.log('🗂️ PASO 3: Generando XML UBL 2.1...');

      // 3. GENERAR XML UBL 2.1
      const xmlData = await this.sunatDocumentService.generateSunatXml(
        receipt.id,
      );
      result.xmlData = {
        documentId: xmlData.documentId,
        xmlLength: xmlData.xml.length,
        total: xmlData.total,
      };
      console.log('✅ PASO 3 completado: XML UBL 2.1 generado');
      console.log('📄 XML UBL 2.1 GENERADO:');
      console.log('=====================================');
      console.log(xmlData.xml);
      console.log('=====================================');

      console.log('📤 PASO 4: Emitiendo a SUNAT...');

      // 4. EMITIR A SUNAT (incluye firma XAdES y envío)
      try {
        const emissionResult =
          await this.sunatDocumentService.generateAndEmitToSunat(receipt.id);
        result.emissionResult = emissionResult;
        console.log('✅ PASO 4 completado: Documento emitido a SUNAT');
        console.log('📤 RESULTADO EMISIÓN SUNAT:');
        console.log('=====================================');
        console.log('Document ID:', emissionResult.documentId);
        console.log('Status:', emissionResult.status);
        console.log('Description:', emissionResult.description);
        console.log('Hash:', emissionResult.hash);
        console.log('CPE Document ID:', emissionResult.cpeDocumentId);
        console.log('=====================================');

        // Mostrar XML firmado directamente del resultado
        if (emissionResult.signedXml) {
          console.log('🔐 XML FIRMADO (XAdES):');
          console.log('=====================================');
          console.log(emissionResult.signedXml);
          console.log('=====================================');
        } else {
          console.log('⚠️ XML firmado no disponible en el resultado');
        }

        return {
          step1_prepare: true,
          step2_json: true,
          step3_xml: true,
          step4_emit: true,
          result,
          errors,
        };
      } catch (emissionError) {
        console.log('⚠️ PASO 4 falló (emisión SUNAT):', emissionError.message);
        errors.push(`Emission error: ${emissionError.message}`);

        return {
          step1_prepare: true,
          step2_json: true,
          step3_xml: true,
          step4_emit: false,
          result,
          errors,
        };
      }
    } catch (error) {
      console.error('❌ Error en secuencia SUNAT:', error.message);
      errors.push(`Error en secuencia SUNAT: ${error.message}`);

      return {
        step1_prepare: false,
        step2_json: false,
        step3_xml: false,
        step4_emit: false,
        result,
        errors,
      };
    }
  }

  private async executeFullSunatSequence(
    receiptId: string,
    customer: Customer,
    receiptType: string,
  ): Promise<{
    step1_prepare: boolean;
    step2_json: boolean;
    step3_xml: boolean;
    step4_emit: boolean;
    result: any;
    errors: string[];
  }> {
    const errors: string[] = [];
    let result: any = {};

    try {
      // VERIFICACIÓN ROBUSTA: Asegurar que el receipt esté disponible
      console.log(
        '🔍 VERIFICACIÓN: Confirmando que el receipt esté disponible...',
      );
      let receipt = null;
      let attempts = 0;
      const maxAttempts = 5;

      while (!receipt && attempts < maxAttempts) {
        try {
          receipt = await this.salesReceiptRepository.findOne({
            where: { id: receiptId },
            relations: ['sale', 'sale.customer'],
          });

          if (receipt) {
            console.log(`✅ Receipt encontrado en intento ${attempts + 1}`);
            break;
          }
        } catch (error) {
          console.log(`⚠️ Intento ${attempts + 1} falló: ${error.message}`);
        }

        attempts++;
        if (attempts < maxAttempts) {
          console.log(
            `⏳ Esperando 1 segundo antes del intento ${attempts + 1}...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!receipt) {
        throw new Error(
          `Receipt with ID ${receiptId} not found after ${maxAttempts} attempts`,
        );
      }

      console.log('🔧 PASO 1: Preparando receipt con campos SUNAT...');

      // 1. PREPARAR RECEIPT CON CAMPOS SUNAT
      await this.sunatDocumentService.updateReceiptForSunat(receiptId, {
        clientData: {
          docType: customer.document_type === 'ruc' ? '6' : '1',
          docNumber: customer.document_number,
          address: customer.address || 'Dirección no especificada',
        },
      });
      console.log('✅ PASO 1 completado: Receipt preparado');

      console.log('📄 PASO 2: Generando JSON SUNAT completo...');

      // 2. GENERAR JSON SUNAT COMPLETO
      const sunatJson = await this.sunatDocumentService.generateSunatJson(
        receiptId,
      );
      result.sunatJson = {
        documentType: sunatJson.tipoDoc,
        series: sunatJson.serie,
        correlativo: sunatJson.correlativo,
        total: sunatJson.mtoImpVenta,
        clientType: sunatJson.metadata.clientType,
      };
      console.log('✅ PASO 2 completado: JSON SUNAT generado');

      console.log('📋 PASO 3: Generando XML UBL 2.1...');

      // 3. GENERAR XML UBL 2.1
      const xmlData = await this.sunatDocumentService.generateSunatXml(
        receiptId,
      );
      result.xmlData = {
        documentId: xmlData.documentId,
        total: xmlData.total,
        xmlLength: xmlData.xml.length,
        hashGenerated: !!xmlData.hashBase,
      };
      console.log('✅ PASO 3 completado: XML UBL 2.1 generado');

      console.log('🚀 PASO 4: Emitiendo a SUNAT (firma + envío)...');

      // 4. EMISIÓN COMPLETA A SUNAT (FIRMA + ENVÍO)
      const emissionResult =
        await this.sunatDocumentService.generateAndEmitToSunat(receiptId);
      result.emissionResult = {
        cpeDocumentId: emissionResult.cpeDocumentId,
        documentId: emissionResult.documentId,
        status: emissionResult.status,
        description: emissionResult.description,
        hash: emissionResult.hash,
      };
      console.log('✅ PASO 4 completado: Documento emitido a SUNAT');

      console.log('🎉 SECUENCIA SUNAT AUTOMÁTICA COMPLETADA EXITOSAMENTE');

      return {
        step1_prepare: true,
        step2_json: true,
        step3_xml: true,
        step4_emit: true,
        result,
        errors,
      };
    } catch (error) {
      const errorMessage = `Error en secuencia SUNAT: ${error.message}`;
      errors.push(errorMessage);
      console.error('❌', errorMessage);

      return {
        step1_prepare: errors.length === 0,
        step2_json: result.sunatJson !== undefined,
        step3_xml: result.xmlData !== undefined,
        step4_emit: result.emissionResult !== undefined,
        result,
        errors,
      };
    }
  }

  /**
   * Genera una nota de venta para impresión
   */
  async generateNotaVenta(saleId: string) {
    // Buscar la venta con todas las relaciones necesarias
    const sale = await this.saleRepository.findOne({
      where: { id: saleId },
      relations: ['customer', 'creator', 'items', 'items.product'],
    });

    if (!sale) {
      throw new NotFoundException(`Venta con ID ${saleId} no encontrada`);
    }

    // Buscar el receipt asociado
    const receipt = await this.salesReceiptRepository.findOne({
      where: { sale_id: saleId },
    });

    // Buscar configuración de la empresa
    const companySettings = await this.companySettingsRepository.findOne({
      where: { is_active: true },
    });

    if (!companySettings) {
      throw new NotFoundException('Configuración de empresa no encontrada');
    }

    // Crear número de correlativo usando el receipt o simulando
    const correlativo = receipt
      ? receipt.sequence_number
      : Math.floor(Math.random() * 1000) + 1;
    const serie = receipt?.series || 'NV01';
    // ✅ Formato uniforme con padding de 8 dígitos (igual que en BD)
    const numeroDocumento =
      receipt?.receipt_number ||
      `${serie}-${correlativo.toString().padStart(8, '0')}`;

    // Mapear items con conversión a número para evitar problemas de precisión
    const items = sale.items.map((item, index) => ({
      numero: index + 1,
      sku: item.product?.sku || item.product_code || 'N/A',
      descripcion: item.product?.name || item.description || 'Producto',
      unidad: item.product?.unit,
      cantidad: Number(item.quantity),
      precioUnitario: Number(item.unit_price),
      subtotal: Number(item.total_price),
    }));

    // Formatear fecha y hora en zona horaria de Perú (America/Lima, UTC-5)
    const fechaEmision = sale.created_at.toLocaleDateString('es-PE', {
      timeZone: 'America/Lima',
    });
    const horaEmision = sale.created_at.toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      // Información del documento
      tipoDocumento: 'NOTA DE VENTA',
      serie: serie,
      correlativo: correlativo,
      numeroDocumento: numeroDocumento,

      // Información de la empresa
      empresaRuc: companySettings.ruc,
      empresaNombre:
        companySettings.trade_name || companySettings.business_name,

      // Información temporal
      fechaEmision: fechaEmision,
      horaEmision: horaEmision,

      // Información del cliente
      clienteNombre:
        receipt?.customer_name || sale.customer?.display_name || 'Cliente',

      // Información de pago
      metodoPago: this.formatPaymentMethod(sale.payment_method),

      // Personal que atendió
      vendedor: sale.creator?.full_name || 'N/A',

      // Items
      items: items,

      // Totales - Convertir a número con 2 decimales para evitar problemas de precisión
      totalVenta: Number(Number(sale.total_amount).toFixed(2)),

      // Información adicional
      saleId: sale.id,
      receiptId: receipt?.id || null,
    };
  }

  /**
   * Formatea el método de pago para mostrar
   */
  private formatPaymentMethod(paymentMethod: string): string {
    const methodMap = {
      cash: 'EFECTIVO',
      card: 'TARJETA',
      transfer: 'TRANSFERENCIA',
      credit: 'CRÉDITO',
    };

    return methodMap[paymentMethod] || paymentMethod.toUpperCase();
  }

  /**
   * Obtiene solo el logo de la empresa en base64
   */
  async getCompanyLogo(): Promise<{ logo: string | null }> {
    const companySettings = await this.companySettingsRepository.findOne({
      where: { is_active: true },
      select: ['logo_base64'],
    });

    return {
      logo: companySettings?.logo_base64 || null,
    };
  }
}
