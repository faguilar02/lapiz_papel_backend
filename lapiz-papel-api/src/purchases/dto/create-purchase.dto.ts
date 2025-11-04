import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsPositive,
  IsArray,
  ValidateNested,
  IsInt,
  IsEnum,
} from 'class-validator';
import { PurchaseStatus } from '../entities/purchase.entity';

export class CreatePurchaseItemDto {
  @IsUUID()
  product_id: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  unit_cost?: number;
}

export class CreatePurchaseDto {
  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items: CreatePurchaseItemDto[];
}
