import { IsOptional, IsString, Length } from 'class-validator';

export class PartyDto {
  @IsString()
  docType: string; // 6 RUC, 1 DNI

  @IsString()
  @Length(8, 15)
  docNumber: string;

  @IsString()
  name: string; // legal name or full name

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  ubigeo?: string;

  @IsOptional()
  @IsString()
  distrito?: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsString()
  departamento?: string;
}
