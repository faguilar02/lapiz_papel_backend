import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { SalesReceipt } from './entities/sales-receipt.entity';
import { CompanySettings } from '../common/entities/company-settings.entity';
import { SunatDocumentService } from './services/sunat-document.service';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CustomersModule } from '../customers/customers.module';
import { CpeModule } from '../cpe/cpe.module';

@Module({
  controllers: [SalesController],
  providers: [SalesService, SunatDocumentService],
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, SalesReceipt, CompanySettings]),
    AuthModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    CpeModule,
  ],
  exports: [SalesService, SunatDocumentService, TypeOrmModule],
})
export class SalesModule {}
