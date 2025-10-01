import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchCategoriesDto {
  @IsOptional()
  @IsString()
  search?: string; // Buscar por nombre

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}
