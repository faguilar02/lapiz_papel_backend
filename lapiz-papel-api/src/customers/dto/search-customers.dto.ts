import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentType } from '../entities/customer.entity';

export class SearchCustomersDto {
  @IsOptional()
  @IsString()
  search?: string; // Buscar por display_name, email, phone o document_number

  @IsOptional()
  @IsString()
  document_number?: string; // Búsqueda específica por número de documento

  @IsOptional()
  @IsEnum(DocumentType)
  document_type?: DocumentType; // Tipo de documento (DNI o RUC)

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}
