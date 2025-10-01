import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchSuppliersDto {
  @IsOptional()
  @IsString()
  search?: string; // Buscar por nombre de empresa, contacto, teléfono o RUC

  @IsOptional()
  @IsString()
  ruc?: string; // Búsqueda específica por RUC

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}
