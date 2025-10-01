import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';

export class CalculateIGVDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsBoolean()
  includes_igv: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  igv_rate?: number = 0.18; // Default 18%
}
