import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Customer } from './entities/customer.entity';
import { AuthModule } from '../auth/auth.module';
import { DocumentVerificationService } from './services/document-verification.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, DocumentVerificationService],
  imports: [TypeOrmModule.forFeature([Customer]), AuthModule, ConfigModule],
  exports: [CustomersService, TypeOrmModule],
})
export class CustomersModule {}
