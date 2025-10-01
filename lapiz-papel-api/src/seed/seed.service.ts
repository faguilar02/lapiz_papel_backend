import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

// Services
import { SalesService } from '../sales/sales.service';

// Entities
import { User } from '../auth/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { Customer, DocumentType } from '../customers/entities/customer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Product } from '../products/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { PurchaseItem } from '../purchases/entities/purchase-item.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';

// Enums
import { UserRole } from '../auth/models/enums';
import { PaymentMethod } from '../auth/models/enums';
import { ReceiptType } from '../sales/entities/sale.entity';

// Seed Data
import { seedData } from './data/seed-data';

@Injectable()
export class SeedService {
  private readonly logger = new Logger('SeedService');

  constructor(
    private readonly salesService: SalesService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepository: Repository<PurchaseItem>,
    @InjectRepository(InventoryMovement)
    private readonly inventoryMovementRepository: Repository<InventoryMovement>,
  ) {}

  async runSeed() {
    this.logger.log('🌱 Starting database seed...');

    // Clean database first
    await this.cleanDatabase();

    // Seed in order (considering foreign key dependencies)
    // await this.companySettingsSeeder.seedCompanySettings();
    const users = await this.seedUsers();
    const categories = await this.seedCategories();
    const customers = await this.seedCustomers();
    const suppliers = await this.seedSuppliers();
    const products = await this.seedProducts(categories);
    const purchases = await this.seedPurchases(suppliers, products, users);
    const sales = await this.seedSales(customers, products, users);
    await this.seedInventoryMovements(products, users);

    this.logger.log('✅ Database seed completed successfully!');

    return {
      message: 'Database seeded successfully',
      data: {
        users: users.length,
        categories: categories.length,
        customers: customers.length,
        suppliers: suppliers.length,
        products: products.length,
        purchases: purchases.length,
        sales: sales.length,
      },
    };
  }

  private async cleanDatabase() {
    this.logger.log('🧹 Cleaning database...');

    const queryRunner =
      this.userRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // For PostgreSQL, we'll use individual DELETE statements to handle missing tables gracefully
      const tablesToClean = [
        'inventory_movements',
        'sales_receipts',
        'sale_items',
        'sales',
        'purchase_items',
        'purchases',
        'products',
        'suppliers',
        'customers',
        'categories',
        'profiles',
      ];

      for (const table of tablesToClean) {
        try {
          await queryRunner.query(`DELETE FROM ${table}`);
          this.logger.log(`✅ Cleaned table: ${table}`);
        } catch (error) {
          this.logger.warn(
            `⚠️ Table ${table} does not exist or could not be cleaned: ${error.message}`,
          );
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log('✅ Database cleaning completed');
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Error during database cleanup:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async seedUsers() {
    this.logger.log('👥 Seeding users...');

    const users = [];
    for (const userData of seedData.users) {
      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(userData.password, 10),
      });
      users.push(await this.userRepository.save(user));
    }

    this.logger.log(`✅ Created ${users.length} users`);
    return users;
  }

  private async seedCategories() {
    this.logger.log('📂 Seeding categories...');

    const categories = [];
    for (const categoryData of seedData.categories) {
      const category = this.categoryRepository.create(categoryData);
      categories.push(await this.categoryRepository.save(category));
    }

    this.logger.log(`✅ Created ${categories.length} categories`);
    return categories;
  }

  private async seedCustomers() {
    this.logger.log('👥 Seeding customers...');

    const customers = [];
    for (const customerData of seedData.customers) {
      const customer = this.customerRepository.create({
        display_name: customerData.display_name,
        document_type: customerData.document_type as DocumentType,
        document_number: customerData.document_number,
        email: customerData.email,
        phone: customerData.phone,
        address: customerData.address,
        status: customerData.status,
        condition: customerData.condition,
      });
      customers.push(await this.customerRepository.save(customer));
    }

    this.logger.log(`✅ Created ${customers.length} customers`);
    return customers;
  }

  private async seedSuppliers() {
    this.logger.log('🏭 Seeding suppliers...');

    const suppliers = [];
    for (const supplierData of seedData.suppliers) {
      const supplier = this.supplierRepository.create(supplierData);
      suppliers.push(await this.supplierRepository.save(supplier));
    }

    this.logger.log(`✅ Created ${suppliers.length} suppliers`);
    return suppliers;
  }

  private async seedProducts(categories: Category[]) {
    this.logger.log('📦 Seeding products...');

    const electronicsCategory = categories.find((c) =>
      c.name.includes('Electrónicos'),
    );
    const homeCategory = categories.find((c) => c.name.includes('Hogar'));
    const officeCategory = categories.find((c) => c.name.includes('Oficina'));
    const sportsCategory = categories.find((c) => c.name.includes('Deportes'));

    const products = [];

    // Create electronics products
    for (const productData of seedData.products.electronics) {
      const product = this.productRepository.create({
        ...productData,
        category: electronicsCategory,
      });
      products.push(await this.productRepository.save(product));
    }

    // Create home products
    for (const productData of seedData.products.home) {
      const product = this.productRepository.create({
        ...productData,
        category: homeCategory,
      });
      products.push(await this.productRepository.save(product));
    }

    // Create office products
    for (const productData of seedData.products.office) {
      const product = this.productRepository.create({
        ...productData,
        category: officeCategory,
      });
      products.push(await this.productRepository.save(product));
    }

    // Create sports products
    for (const productData of seedData.products.sports) {
      const product = this.productRepository.create({
        ...productData,
        category: sportsCategory,
      });
      products.push(await this.productRepository.save(product));
    }

    this.logger.log(`✅ Created ${products.length} products`);
    return products;
  }

  private async seedPurchases(
    suppliers: Supplier[],
    products: Product[],
    users: User[],
  ) {
    this.logger.log('🛒 Seeding purchases...');

    const purchases = [];

    for (const purchaseData of seedData.purchases) {
      const supplier = suppliers.find(
        (s) => s.name === purchaseData.supplierName,
      );
      const user = users.find((u) => u.role === purchaseData.userRole);

      const purchase = this.purchaseRepository.create({
        supplier_id: supplier.id,
        created_by: user.id,
        total_amount: purchaseData.total_amount.toString(),
        notes: purchaseData.notes,
      });
      const savedPurchase = await this.purchaseRepository.save(purchase);

      // Create purchase items
      for (const itemData of purchaseData.items) {
        const product = products.find((p) => p.sku === itemData.productSku);

        const purchaseItem = this.purchaseItemRepository.create({
          purchase_id: savedPurchase.id,
          product_id: product.id,
          quantity: itemData.quantity,
          unit_cost: itemData.unit_cost.toString(),
          total_cost: (itemData.quantity * itemData.unit_cost).toString(),
          price_source: 'base',
        });
        await this.purchaseItemRepository.save(purchaseItem);

        // Update product stock
        product.stock_quantity += itemData.quantity;
        await this.productRepository.save(product);
      }

      purchases.push(savedPurchase);
    }

    this.logger.log(`✅ Created ${purchases.length} purchases`);
    return purchases;
  }

  private async seedSales(
    customers: Customer[],
    products: Product[],
    users: User[],
  ) {
    this.logger.log('💰 Seeding sales...');

    const sales = [];

    for (const saleData of seedData.sales) {
      const customer = saleData.customerName
        ? customers.find((c) => c.display_name === saleData.customerName)
        : null;
      const user = users.find((u) => u.role === saleData.userRole);

      // Build CreateSaleDto format
      const createSaleDto = {
        customer_id: customer?.id,
        subtotal: saleData.subtotal,
        discount_amount: saleData.discount_amount,
        includes_igv: saleData.includes_igv || false,
        igv_rate: saleData.igv_rate || 0.18,
        igv_amount: saleData.igv_amount || 0,
        total_amount: saleData.total_amount,
        payment_method: this.convertToPaymentMethod(saleData.payment_method),
        receipt_type: this.convertToReceiptType(saleData.receipt_type),
        notes: saleData.notes,
        items: saleData.items.map((itemData) => {
          const product = products.find((p) => p.sku === itemData.productSku);
          return {
            product_id: product.id,
            quantity: itemData.quantity,
            unit_price: itemData.unit_price,
          };
        }),
        // Receipt configuration
        receipt_series: 'SEED',
        receipt_customer_name: customer?.display_name || 'Cliente Anónimo',
        receipt_customer_phone: customer?.phone || null,
        receipt_notes: 'Recibo generado por seed de datos',
      };

      // Use SalesService to create sale (this will automatically create the receipt)
      const createdSale = await this.salesService.create(createSaleDto, user);
      sales.push(createdSale);
    }

    this.logger.log(`✅ Created ${sales.length} sales with automatic receipts`);
    return sales;
  }

  private async seedInventoryMovements(products: Product[], users: User[]) {
    this.logger.log('📋 Seeding inventory movements...');

    const movements = [];

    for (const movementData of seedData.inventoryMovements) {
      const product = products.find((p) => p.sku === movementData.productSku);
      const user = users.find((u) => u.role === movementData.userRole);

      const movement = this.inventoryMovementRepository.create({
        product_id: product.id,
        movement_type: movementData.movement_type,
        quantity: movementData.quantity,
        reason: movementData.reason,
        created_by: user.id,
      });
      movements.push(await this.inventoryMovementRepository.save(movement));

      // Update product stock
      product.stock_quantity += movementData.quantity;
      await this.productRepository.save(product);
    }

    this.logger.log(`✅ Created ${movements.length} inventory movements`);
    return movements;
  }

  // Helper method to convert string payment method to PaymentMethod enum
  private convertToPaymentMethod(paymentMethodString: string): PaymentMethod {
    switch (paymentMethodString?.toLowerCase()) {
      case 'cash':
      case 'efectivo':
        return PaymentMethod.CASH;
      case 'yape':
        return PaymentMethod.YAPE;
      case 'card':
      case 'tarjeta':
      case 'credit_card':
      case 'debit_card':
        return PaymentMethod.CARD;
      case 'transfer':
      case 'transferencia':
      case 'bank_transfer':
        return PaymentMethod.TRANSFER;
      default:
        this.logger.warn(
          `Unknown payment method: ${paymentMethodString}, defaulting to CASH`,
        );
        return PaymentMethod.CASH;
    }
  }

  // Helper method to convert string receipt type to ReceiptType enum
  private convertToReceiptType(receiptTypeString: string): ReceiptType {
    switch (receiptTypeString?.toLowerCase()) {
      case 'nota':
        return ReceiptType.NOTA;
      case 'boleta':
        return ReceiptType.BOLETA;
      case 'factura':
        return ReceiptType.FACTURA;
      default:
        this.logger.warn(
          `Unknown receipt type: ${receiptTypeString}, defaulting to BOLETA`,
        );
        return ReceiptType.BOLETA;
    }
  }
}
