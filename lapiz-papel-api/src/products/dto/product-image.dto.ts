import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsUUID,
} from 'class-validator';

export class CreateProductImageDto {
  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsString()
  alt_text?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}

export class UpdateProductImageDto {
  @IsOptional()
  @IsString()
  alt_text?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}
