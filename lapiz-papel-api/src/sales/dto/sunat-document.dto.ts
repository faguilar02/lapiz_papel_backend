import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateReceiptForSunatDto {
  @IsOptional()
  @IsString()
  @IsIn(['01', '03', '07', '08'], {
    message:
      'Tipo de documento debe ser 01(Factura), 03(Boleta), 07(Nota Crédito) o 08(Nota Débito)',
  })
  forceDocumentType?: string;

  @IsOptional()
  clientData?: {
    docType?: string;
    docNumber?: string;
    address?: string;
  };
}

export class SunatResponseDto {
  @IsString()
  receiptId: string;

  @IsString()
  statusCode: string;

  @IsString()
  statusMessage: string;

  @IsOptional()
  @IsString()
  cdrContent?: string;
}

export class MarkAsSentDto {
  @IsString()
  receiptId: string;

  @IsString()
  ticket: string;
}
