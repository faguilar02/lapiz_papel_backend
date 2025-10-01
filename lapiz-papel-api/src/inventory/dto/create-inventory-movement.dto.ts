import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  IsIn,
} from 'class-validator';

export class CreateInventoryMovementDto {
  @IsUUID()
  product_id: string;

  @IsIn(['entry', 'exit', 'adjustment'])
  movement_type: string;

  @IsInt()
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
