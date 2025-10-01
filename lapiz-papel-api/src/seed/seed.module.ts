import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';

// Modules
import { SalesModule } from '../sales/sales.module';

// Entities
import { User } from '../auth/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Product } from '../products/entities/product.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { PurchaseItem } from '../purchases/entities/purchase-item.entity';
import { Sale } from '../sales/entities/sale.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { SalesReceipt } from '../sales/entities/sales-receipt.entity';
import { CompanySettings } from '../common/entities/company-settings.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';

@Module({
  imports: [
    SalesModule,
    TypeOrmModule.forFeature([
      User,
      Category,
      Customer,
      Supplier,
      Product,
      ProductImage,
      Purchase,
      PurchaseItem,
      Sale,
      SaleItem,
      SalesReceipt,
      CompanySettings,
      InventoryMovement,
    ]),
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
