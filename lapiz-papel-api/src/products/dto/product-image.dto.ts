import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductImageDto {
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsString()
  alt_text?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  is_primary?: boolean;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return Number(value);
  })
  sort_order?: number;
}

export class UpdateProductImageDto {
  @IsOptional()
  @IsString()
  alt_text?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  is_primary?: boolean;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return Number(value);
  })
  sort_order?: number;
}
