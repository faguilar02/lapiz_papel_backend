import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { Supplier } from './entities/supplier.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
  imports: [TypeOrmModule.forFeature([Supplier]), AuthModule],
  exports: [SuppliersService, TypeOrmModule],
})
export class SuppliersModule {}
