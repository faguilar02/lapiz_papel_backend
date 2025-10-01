import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService],
  imports: [
    TypeOrmModule.forFeature([Purchase, PurchaseItem]),
    AuthModule,
    ProductsModule,
    InventoryModule,
  ],
  exports: [PurchasesService, TypeOrmModule],
})
export class PurchasesModule {}
