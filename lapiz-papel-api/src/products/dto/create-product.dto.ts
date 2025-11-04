import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsPositive,
  IsInt,
  IsIn,
  IsUrl,
  Min,
} from 'class-validator';
import { TransformEmptyToNull } from '../../common/decorators/transform-empty-to-null.decorator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsUUID()
  @TransformEmptyToNull()
  category_id?: string | null;

  @IsOptional()
  @IsString()
  unit?: string = 'unit';

  @IsNumber()
  @IsPositive()
  sale_price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_price?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock_quantity?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimum_stock?: number = 0;

  @IsOptional()
  @IsUrl()
  image_url?: string;
}
