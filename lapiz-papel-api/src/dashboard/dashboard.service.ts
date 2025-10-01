import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Between } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
  ) {}

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Count of products with low stock
    const lowStockCount = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock_quantity <= product.minimum_stock')
      .andWhere('product.is_active = :isActive', { isActive: true })
      .getCount();

    // Today's sales count and revenue
    const todaySalesData = await this.saleRepository
      .createQueryBuilder('sale')
      .select([
        'COUNT(sale.id) as sales_count',
        'COALESCE(SUM(sale.total_amount), 0) as total_revenue',
      ])
      .where('sale.created_at >= :today', { today })
      .andWhere('sale.created_at < :tomorrow', { tomorrow })
      .andWhere('sale.is_active = :isActive', { isActive: true })
      .getRawOne();

    // Recent sales (last 5)
    const recentSales = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.receipts', 'receipt')
      .select([
        'sale.id',
        'sale.total_amount',
        'sale.created_at',
        'customer.display_name',
        'receipt.receipt_number',
      ])
      .where('sale.is_active = :isActive', { isActive: true })
      .orderBy('sale.created_at', 'DESC')
      .take(5)
      .getMany();

    // Products with low stock (detailed list - max 5)
    const lowStockProducts = await this.productRepository
      .createQueryBuilder('product')
      .select([
        'product.id',
        'product.name',
        'product.sku',
        'product.stock_quantity',
        'product.minimum_stock',
      ])
      .where('product.stock_quantity <= product.minimum_stock')
      .andWhere('product.is_active = :isActive', { isActive: true })
      .orderBy('product.stock_quantity', 'ASC')
      .take(5)
      .getMany();

    return {
      summary: {
        low_stock_count: lowStockCount,
        today_sales_count: parseInt(todaySalesData.sales_count) || 0,
        today_revenue: parseFloat(todaySalesData.total_revenue) || 0,
      },
      recent_sales: recentSales.map((sale) => ({
        id: sale.id,
        receipt_number: sale.receipts?.[0]?.receipt_number || 'N/A',
        customer_name: sale.customer?.display_name || 'Cliente Anónimo',
        total_amount: sale.total_amount,
        created_at: sale.created_at,
      })),
      low_stock_products: lowStockProducts.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        current_stock: product.stock_quantity,
        minimum_stock: product.minimum_stock,
      })),
    };
  }

  async getLowStockProducts(limit = 20) {
    return await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.stock_quantity <= product.minimum_stock')
      .andWhere('product.is_active = :isActive', { isActive: true })
      .orderBy('product.stock_quantity', 'ASC')
      .take(limit)
      .getMany();
  }

  async getTodaySalesDetails() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sales = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.creator', 'creator')
      .leftJoinAndSelect('sale.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('sale.created_at >= :today', { today })
      .andWhere('sale.created_at < :tomorrow', { tomorrow })
      .orderBy('sale.created_at', 'DESC')
      .getMany();

    const totalRevenue = sales.reduce(
      (sum, sale) => sum + Number(sale.total_amount),
      0,
    );
    const totalSales = sales.length;

    return {
      count: totalSales,
      total_revenue: totalRevenue,
      sales: sales.map((sale) => ({
        id: sale.id,
        customer_name: sale.customer?.display_name || 'Cliente Anónimo',
        total_amount: sale.total_amount,
        payment_method: sale.payment_method,
        cashier: sale.creator?.full_name,
        items: sale.items?.map((item) => ({
          product_name: item.product?.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })),
        created_at: sale.created_at,
      })),
    };
  }
}
