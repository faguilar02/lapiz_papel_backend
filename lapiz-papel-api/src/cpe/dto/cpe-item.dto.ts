import { IsNumber, IsString, IsBoolean, IsOptional } from 'class-validator';

export class CpeItemDto {
  @IsString()
  description: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unitCode: string; // NIU, ZZ, etc

  @IsNumber()
  unitPrice: number; // precio unitario incluido IGV si sale.includesIgv true

  @IsString()
  taxAffectation: string; // 10 gravado, etc.

  @IsBoolean()
  includesIgv: boolean; // por si item difiere (en MVP lo igualamos al global)

  @IsOptional()
  @IsString()
  productCode?: string; // código interno del producto

  @IsOptional()
  @IsString()
  sunatCode?: string; // código SUNAT del producto
}
