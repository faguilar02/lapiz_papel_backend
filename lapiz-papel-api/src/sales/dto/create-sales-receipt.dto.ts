import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateSalesReceiptDto {
  @IsUUID()
  sale_id: string;

  @IsString()
  @IsNotEmpty()
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
