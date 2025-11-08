import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SearchProductsDto {
  @IsOptional()
  @IsString()
  search?: string; // Buscar por nombre, SKU

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsString()
  brand?: string; // Filtrar por marca específica

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  low_stock?: boolean = false; // Filtrar solo productos con stock bajo o crítico

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  include_inactive?: boolean = false;
}
