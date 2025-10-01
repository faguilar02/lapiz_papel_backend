import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReceiptStatus } from '../entities/sale-receipt.entity';

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
