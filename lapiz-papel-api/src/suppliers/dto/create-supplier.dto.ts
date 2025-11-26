import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contact_person?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, {
    message: 'RUC must be exactly 11 digits',
    each: false,
  })
  @ValidateIf((o) => o.ruc !== undefined && o.ruc !== null && o.ruc !== '')
  ruc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
