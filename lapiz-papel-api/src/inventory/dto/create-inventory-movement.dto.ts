import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsPositive,
  IsIn,
} from 'class-validator';

export class CreateInventoryMovementDto {
  @IsUUID()
  product_id: string;

  @IsIn(['entry', 'exit', 'adjustment'])
  movement_type: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsUUID()
  reference_id?: string;

  @IsOptional()
  @IsString()
  reference_type?: string;
}
