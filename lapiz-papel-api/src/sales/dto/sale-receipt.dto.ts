import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReceiptStatus } from '../entities/sale-receipt.entity';

export class CreateSaleReceiptDto {
  @IsUUID()
  sale_id: string;

  @IsString()
  series: string; // E.g., "NV-001"

  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSaleReceiptDto {
  @IsOptional()
  @IsEnum(ReceiptStatus)
  status?: ReceiptStatus;

  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
