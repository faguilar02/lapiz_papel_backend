import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, DeepPartial } from 'typeorm';
import { Purchase, PurchaseStatus } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import {
  CreatePurchaseDto,
  UpdatePurchaseDto,
  SearchPurchasesDto,
} from './dto';
import { PaginationDto } from '../auth/dto';
import { ProductsService } from '../products/products.service';
import { InventoryService } from '../inventory/inventory.service';
import { User } from '../auth/entities/user.entity';
import { PaginatedResponse } from '../auth/interfaces/paginated-response.interface';
import { createPaginatedResponse } from '../auth/utils/pagination.helper';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepository: Repository<PurchaseItem>,
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createPurchaseDto: CreatePurchaseDto,
    user: User,
  ): Promise<Purchase> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Calcular precios y validar productos
      const itemsWithPrices = await Promise.all(
        createPurchaseDto.items.map(async (item) => {
          // Si ya viene un unit_cost, usarlo directamente
          if (item.unit_cost) {
            return {
              ...item,
              unit_cost: Number(item.unit_cost),
              total_cost: Number(item.unit_cost) * item.quantity,
              price_source: 'manual',
              tier_id: null, // Explícitamente establecer tier_id como null
            };
          }

          // Si no viene unit_cost, buscar precio por volumen
          const priceInfo = await this.productsService.getApplicableBulkPrice(
            item.product_id,
            item.quantity,
          );

          const unit_cost = Number(
            priceInfo.tier_applied
              ? (
                  Number(priceInfo.tier_applied.cost_bundle_total) /
                  item.quantity
                ).toFixed(2)
              : priceInfo.base_prices.cost_unit_price,
          );

          return {
            ...item,
            unit_cost,
            total_cost: Number(priceInfo.totals.cost_total),
            price_source: priceInfo.price_source,
            tier_id: priceInfo.tier_applied?.id || null, // Asegurar que siempre haya un valor (null si no hay tier)
          };
        }),
      );

      // Calcular total_amount
      const total_amount = itemsWithPrices.reduce(
        (sum, item) => sum + Number(item.total_cost),
        0,
      );

      // Create purchase
      const purchaseData = {
        supplier_id: createPurchaseDto.supplier_id,
        total_amount: total_amount.toFixed(2),
        notes: createPurchaseDto.notes,
        status: createPurchaseDto.status || 'pending',
        created_by: user.id,
        is_active: true,
      } as DeepPartial<Purchase>;

      const purchase = this.purchaseRepository.create(purchaseData);
      const savedPurchase = await queryRunner.manager.save(purchase);

      // Crear items de compra con precios calculados
      const purchaseItems = itemsWithPrices.map((item) =>
        this.purchaseItemRepository.create({
          product_id: item.product_id,
          purchase_id: savedPurchase.id,
          quantity: item.quantity,
          unit_cost: item.unit_cost.toString(),
          total_cost: item.total_cost.toString(),
          price_source: item.price_source,
          tier_id: item.tier_id,
        } as DeepPartial<PurchaseItem>),
      );

      await queryRunner.manager.save(PurchaseItem, purchaseItems);

      // Si la compra se crea como completada, actualizar el stock
      if (savedPurchase.status === 'completed') {
        for (const item of purchaseItems) {
          // Verificar que el producto existe y está activo
          const product = await this.productsService.findOne(item.product_id);
          if (!product.is_active) {
            throw new BadRequestException(
              `Product ${product.name} (${product.sku}) is not active`,
            );
          }

          await this.productsService.updateStock(
            item.product_id,
            Number(item.quantity),
          );
          await this.inventoryService.create(
            {
              product_id: item.product_id,
              movement_type: 'entry',
              quantity: item.quantity,
              reason: 'Purchase created as completed',
              reference_id: savedPurchase.id,
              reference_type: 'purchase',
            },
            { id: savedPurchase.created_by } as User,
          );
        }
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedPurchase.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<Purchase>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const [data, total] = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.supplier', 'supplier')
      .leftJoinAndSelect('purchase.creator', 'creator')
      .addSelect('purchase.is_active')
      .orderBy('purchase.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return createPaginatedResponse(data, total, limit, offset);
  }

  async findOne(id: string): Promise<Purchase> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id },
      relations: ['supplier', 'creator', 'items', 'items.product'],
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  async update(
    id: string,
    updatePurchaseDto: UpdatePurchaseDto,
  ): Promise<Purchase> {
    const purchase = await this.findOne(id);
    const oldStatus = purchase.status;

    // Si el estado no cambia, retornar la compra actual (idempotencia)
    if (updatePurchaseDto.status && updatePurchaseDto.status === oldStatus) {
      return purchase;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      Object.assign(purchase, updatePurchaseDto);

      // Si el status cambió, manejar la actualización de stock
      if (oldStatus !== purchase.status) {
        switch (purchase.status) {
          case 'completed':
            // Al completar la compra, aumentar stock
            for (const item of purchase.items) {
              // Verificar que el producto existe y está activo
              const product = await this.productsService.findOne(
                item.product_id,
              );
              if (!product.is_active) {
                throw new BadRequestException(
                  `Product ${product.name} (${product.sku}) is not active`,
                );
              }

              await this.productsService.updateStock(
                item.product_id,
                item.quantity,
              );
              await this.inventoryService.create(
                {
                  product_id: item.product_id,
                  movement_type: 'entry',
                  quantity: item.quantity,
                  reason: `Purchase completed from ${oldStatus}`,
                  reference_id: purchase.id,
                  reference_type: 'purchase',
                },
                { id: purchase.created_by } as User,
              );
            }
            break;

          case 'pending':
            // Solo restar stock si venía de completed
            if (oldStatus === 'completed') {
              for (const item of purchase.items) {
                await this.productsService.updateStock(
                  item.product_id,
                  -item.quantity,
                );
                await this.inventoryService.create(
                  {
                    product_id: item.product_id,
                    movement_type: 'exit',
                    quantity: item.quantity,
                    reason: 'Purchase reverted to pending from completed',
                    reference_id: purchase.id,
                    reference_type: 'purchase',
                  },
                  { id: purchase.created_by } as User,
                );
              }
            }
            break;
        }
      }

      const savedPurchase = await queryRunner.manager.save(Purchase, purchase);
      await queryRunner.commitTransaction();
      return this.findOne(savedPurchase.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const purchase = await this.findOne(id);

      // Si la compra estaba completada, revertir el stock
      if (purchase.status === 'completed') {
        for (const item of purchase.items) {
          await this.productsService.updateStock(
            item.product_id,
            -item.quantity,
          );
          await this.inventoryService.create(
            {
              product_id: item.product_id,
              movement_type: 'exit',
              quantity: item.quantity,
              reason: 'Purchase cancelled (set inactive)',
              reference_id: purchase.id,
              reference_type: 'purchase',
            },
            { id: purchase.created_by } as User,
          );
        }
      }

      purchase.is_active = false;
      await queryRunner.manager.save(purchase);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async activate(id: string): Promise<Purchase> {
    const purchase = await this.findOne(id);
    purchase.is_active = true;
    return await this.purchaseRepository.save(purchase);
  }

  async deactivate(id: string): Promise<Purchase> {
    const purchase = await this.findOne(id);

    // Si la compra estaba completada, revertir el stock antes de desactivar
    if (purchase.status === 'completed') {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        for (const item of purchase.items) {
          await this.productsService.updateStock(
            item.product_id,
            -item.quantity,
          );
          await this.inventoryService.create(
            {
              product_id: item.product_id,
              movement_type: 'exit',
              quantity: item.quantity,
              reason: 'Purchase deactivated (stock reverted)',
              reference_id: purchase.id,
              reference_type: 'purchase',
            },
            { id: purchase.created_by } as User,
          );
        }

        purchase.is_active = false;
        const savedPurchase = await queryRunner.manager.save(purchase);
        await queryRunner.commitTransaction();
        return savedPurchase;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } else {
      purchase.is_active = false;
      return await this.purchaseRepository.save(purchase);
    }
  }

  async getPurchasesReport(startDate: Date, endDate: Date): Promise<any> {
    const result = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .select([
        'COUNT(purchase.id) as total_purchases',
        'COUNT(CASE WHEN purchase.is_active = true THEN 1 END) as active_purchases',
        'SUM(CASE WHEN purchase.is_active = true THEN purchase.total_amount ELSE 0 END) as total_cost',
        'AVG(CASE WHEN purchase.is_active = true THEN purchase.total_amount END) as average_purchase',
        'DATE(purchase.created_at) as purchase_date',
      ])
      .where('purchase.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('DATE(purchase.created_at)')
      .orderBy('purchase_date', 'DESC')
      .getRawMany();

    return result;
  }

  async search(
    searchDto: SearchPurchasesDto,
  ): Promise<PaginatedResponse<Purchase>> {
    const {
      search,
      start_date,
      end_date,
      status,
      limit = 20,
      offset = 0,
    } = searchDto;

    console.log('🔍 Purchases Service: search called with:', searchDto);

    const queryBuilder = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.supplier', 'supplier')
      .leftJoinAndSelect('purchase.creator', 'creator')
      .leftJoinAndSelect('purchase.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .addSelect('purchase.is_active')
      .orderBy('purchase.created_at', 'DESC');

    // Búsqueda general por proveedor
    if (search) {
      queryBuilder.andWhere(
        '(supplier.name ILIKE :search OR creator.full_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Filtro por status
    if (status) {
      queryBuilder.andWhere('purchase.status = :status', { status });
    }

    // Filtro por rango de fechas - Ajustado para zona horaria de Peru (UTC-5)
    if (start_date && end_date) {
      // Crear fechas en zona horaria local de Peru (UTC-5)
      const startDate = new Date(start_date + 'T05:00:00.000Z'); // 00:00 Peru = 05:00 UTC
      const endDate = new Date(end_date + 'T23:59:59.999-05:00'); // 23:59:59 Peru (final del día)

      queryBuilder.andWhere(
        'purchase.created_at BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    } else if (start_date) {
      const startDate = new Date(start_date + 'T05:00:00.000Z'); // 00:00 Peru = 05:00 UTC
      queryBuilder.andWhere('purchase.created_at >= :startDate', { startDate });
    } else if (end_date) {
      const endDate = new Date(end_date + 'T23:59:59.999-05:00'); // 23:59:59 Peru (final del día)
      queryBuilder.andWhere('purchase.created_at <= :endDate', { endDate });
    }

    const [data, total] = await queryBuilder
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    console.log('🔍 Purchases Service: found', total, 'purchases');
    return createPaginatedResponse(data, total, limit, offset);
  }
}
