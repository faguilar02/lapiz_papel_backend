import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { PurchaseItem } from '../purchases/entities/purchase-item.entity';
import { ReportsQueryDto } from './dto/reports-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepository: Repository<PurchaseItem>,
  ) {}

  private getDateRange(query: ReportsQueryDto): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    if (query.period === 'custom' && query.start_date && query.end_date) {
      // Ajustar fechas para zona horaria de Peru (UTC-5)
      startDate = new Date(query.start_date + 'T05:00:00.000Z'); // 00:00 Peru = 05:00 UTC
      endDate = new Date(query.end_date + 'T23:59:59.999-05:00'); // 23:59:59 Peru (final del día)
    } else {
      switch (query.period) {
        case '7days':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case '30days':
          startDate = new Date(now.setDate(now.getDate() - 30));
          break;
        case '3months':
          startDate = new Date(now.setMonth(now.getMonth() - 3));
          break;
        case '6months':
          startDate = new Date(now.setMonth(now.getMonth() - 6));
          break;
        case '1year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(now.setDate(now.getDate() - 7));
      }

      // Set start of day for startDate and end of day for endDate
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  }

  async getSalesReport(query: ReportsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    // Total sales revenue
    const salesData = await this.saleRepository
      .createQueryBuilder('sale')
      .select([
        'COUNT(sale.id) as total_sales',
        'COALESCE(SUM(sale.total_amount), 0) as total_revenue',
        'COALESCE(SUM(sale.subtotal), 0) as total_subtotal',
        'COALESCE(SUM(sale.discount_amount), 0) as total_discount',
      ])
      .where('sale.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('sale.is_active = :isActive', { isActive: true })
      .getRawOne();

    // Sales by payment method
    const salesByPaymentMethod = await this.saleRepository
      .createQueryBuilder('sale')
      .select([
        "COALESCE(sale.payment_method, 'cash') as payment_method",
        'COUNT(sale.id) as count',
        'COALESCE(SUM(sale.total_amount), 0) as total',
      ])
      .where('sale.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('sale.is_active = :isActive', { isActive: true })
      .groupBy('sale.payment_method')
      .getRawMany();

    return {
      period: {
        start_date: startDate,
        end_date: endDate,
        period_type: query.period,
      },
      summary: {
        total_sales: parseInt(salesData.total_sales) || 0,
        total_revenue: parseFloat(salesData.total_revenue) || 0,
        total_subtotal: parseFloat(salesData.total_subtotal) || 0,
        total_discount: parseFloat(salesData.total_discount) || 0,
      },
      payment_methods: salesByPaymentMethod.map((item) => ({
        payment_method: item.payment_method,
        count: parseInt(item.count),
        total: parseFloat(item.total),
      })),
    };
  }

  async getPurchasesReport(query: ReportsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    // Total purchases cost
    const purchasesData = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .select([
        'COUNT(purchase.id) as total_purchases',
        'COALESCE(SUM(purchase.total_amount), 0) as total_cost',
      ])
      .where('purchase.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('purchase.is_active = :isActive', { isActive: true })
      .getRawOne();

    // Purchases by supplier
    const purchasesBySupplier = await this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoin('purchase.supplier', 'supplier')
      .select([
        'supplier.name as supplier_name',
        'COUNT(purchase.id) as purchase_count',
        'COALESCE(SUM(purchase.total_amount), 0) as total_amount',
      ])
      .where('purchase.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('supplier.id')
      .addGroupBy('supplier.name')
      .orderBy('total_amount', 'DESC')
      .getRawMany();

    return {
      period: {
        start_date: startDate,
        end_date: endDate,
        period_type: query.period,
      },
      summary: {
        total_purchases: parseInt(purchasesData.total_purchases) || 0,
        total_cost: parseFloat(purchasesData.total_cost) || 0,
      },
      suppliers: purchasesBySupplier.map((item) => ({
        supplier_name: item.supplier_name,
        purchase_count: parseInt(item.purchase_count),
        total_amount: parseFloat(item.total_amount),
      })),
    };
  }

  async getTopSellingProducts(query: ReportsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    const topProducts = await this.saleItemRepository
      .createQueryBuilder('saleItem')
      .leftJoinAndSelect('saleItem.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoin('saleItem.sale', 'sale')
      .select([
        'product.id',
        'product.name',
        'product.sku',
	'product.brand',
        'category.name as category_name',
        'SUM(saleItem.quantity) as total_sold',
        'COALESCE(SUM(saleItem.total_price), 0) as total_revenue',
        'COUNT(DISTINCT sale.id) as sales_count',
      ])
      .where('sale.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('sale.is_active = :isActive', { isActive: true })
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.sku')
	.addGroupBy('product.brand')	
      .addGroupBy('category.name')	
      .orderBy('total_revenue', 'DESC')
      .take(20)
      .getRawMany();

    return {
      period: {
        start_date: startDate,
        end_date: endDate,
        period_type: query.period,
      },
      products: topProducts.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.product_sku,
	brand: item.product_brand,
        category: item.category_name,
        quantity_sold: parseInt(item.total_sold),
        revenue: parseFloat(item.total_revenue),
        sales_count: parseInt(item.sales_count),
      })),
    };
  }

  async getFinancialSummary(query: ReportsQueryDto) {
    const { startDate, endDate } = this.getDateRange(query);

    // Get sales revenue
    const salesData = await this.getSalesReport(query);

    // Get purchases cost (total gastado en compras)
    const purchasesData = await this.getPurchasesReport(query);

    // Calcular el COSTO de los productos vendidos (COGS - Cost of Goods Sold)
    // Esto es: para cada producto vendido, sumar (cantidad_vendida * costo_del_producto)
    const costOfGoodsSold = await this.saleItemRepository
      .createQueryBuilder('sale_item')
      .innerJoin('sale_item.sale', 'sale')
      .innerJoin('sale_item.product', 'product')
      .select(
        'COALESCE(SUM(sale_item.quantity::numeric * product.cost_price::numeric), 0)',
        'total_cogs',
      )
      .where('sale.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('sale.is_active = :isActive', { isActive: true })
      .getRawOne();

    const totalRevenue = salesData.summary.total_revenue;
    const totalPurchasesCost = purchasesData.summary.total_cost; // Gastos en compras
    const totalCOGS = parseFloat(costOfGoodsSold.total_cogs || 0); // Costo de productos vendidos
    const grossProfit = totalRevenue - totalCOGS; // Ganancia bruta = Ingresos - Costo de lo vendido
    const profitMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      period: {
        start_date: startDate,
        end_date: endDate,
        period_type: query.period,
      },
      financial_summary: {
        total_revenue: totalRevenue, // Ingresos por ventas
        total_purchases_cost: totalPurchasesCost, // Gastos en compras
        cost_of_goods_sold: totalCOGS, // Costo de los productos vendidos
        gross_profit: grossProfit, // Ganancia bruta (Ingresos - Costo de vendidos)
        profit_margin_percentage: parseFloat(profitMargin.toFixed(2)),
        total_sales_count: salesData.summary.total_sales,
        total_purchases_count: purchasesData.summary.total_purchases,
      },
    };
  }

  async getCompleteReport(query: ReportsQueryDto) {
    const [salesReport, purchasesReport, topProducts, financialSummary] =
      await Promise.all([
        this.getSalesReport(query),
        this.getPurchasesReport(query),
        this.getTopSellingProducts(query),
        this.getFinancialSummary(query),
      ]);

    return {
      sales: salesReport,
      purchases: purchasesReport,
      top_products: topProducts,
      financial_summary: financialSummary,
    };
  }
}
