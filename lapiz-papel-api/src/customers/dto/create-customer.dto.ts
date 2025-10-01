import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { DocumentType } from '../entities/customer.entity';
import { TransformEmptyToNull } from '../../common/decorators/transform-empty-to-null.decorator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  display_name: string;

  @IsEnum(DocumentType)
  @IsNotEmpty()
  document_type: DocumentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(11)
  document_number: string;

  @IsOptional()
  @IsEmail()
  @TransformEmptyToNull()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // Campos específicos para RUC
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  condition?: string;
}
