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

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

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
  @IsInt()
  @Min(0)
  stock_quantity?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimum_stock?: number = 0;

  @IsOptional()
  @IsUrl()
  image_url?: string;
}
