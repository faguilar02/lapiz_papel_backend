import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsPositive,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsEnum,
  IsBoolean,
  Max,
} from 'class-validator';
import { PaymentMethod } from '../../auth/models/enums';
import { ReceiptType } from '../entities/sale.entity';
import { DocumentType } from '../../customers/entities/customer.entity';

export class CreateSaleItemDto {
  @IsUUID()
  product_id: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  unit_price: number;
}

export class CustomerDataDto {
  @IsString()
  @IsNotEmpty()
  display_name: string;

  @IsEnum(DocumentType)
  document_type: DocumentType;

  @IsString()
  @IsNotEmpty()
  document_number: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  status?: string; // For RUC

  @IsOptional()
  @IsString()
  condition?: string; // For RUC
}

export class CreateSaleDto {
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsNumber()
  @IsPositive()
  subtotal: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number = 0;

  @IsOptional()
  @IsBoolean()
  includes_igv?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  igv_rate?: number = 0.18; // Default 18%

  @IsOptional()
  @IsNumber()
  @Min(0)
  igv_amount?: number = 0;

  @IsNumber()
  @IsPositive()
  total_amount: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method?: PaymentMethod = PaymentMethod.CASH;

  @IsOptional()
  @IsEnum(ReceiptType)
  receipt_type?: ReceiptType = ReceiptType.BOLETA;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  // Optional customer data for new customers
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDataDto)
  customer_data?: CustomerDataDto;

  // Optional receipt configuration fields
  @IsOptional()
  @IsString()
  receipt_series?: string; // If not provided, defaults to 'NV-001'

  @IsOptional()
  @IsString()
  receipt_customer_name?: string; // Customer name for the receipt

  @IsOptional()
  @IsString()
  receipt_customer_phone?: string; // Customer phone for the receipt

  @IsOptional()
  @IsString()
  receipt_notes?: string; // Additional notes for the receipt
}
