import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { PartyDto } from './party.dto';
import { CpeItemDto } from './cpe-item.dto';

export class InvoiceDto {
  @ValidateNested()
  @Type(() => PartyDto)
  customer: PartyDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CpeItemDto)
  items: CpeItemDto[];

  @IsString()
  currency: string; // PEN

  @IsBoolean()
  includesIgv: boolean; // según tu venta

  @IsOptional()
  @IsString()
  saleId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string; // fecha de vencimiento

  @IsOptional()
  @IsString()
  paymentType?: string; // forma de pago

  @IsOptional()
  @IsString()
  notes?: string; // notas o comentarios

  @IsOptional()
  @IsNumber()
  currencyId?: number; // 1=USD, 2=PEN
}
