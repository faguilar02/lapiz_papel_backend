import { IsNumber, IsPositive, Min, IsString } from 'class-validator';

export class CreateBulkPriceDto {
  @IsNumber()
  @IsPositive()
  @Min(1)
  min_quantity: number;

  @IsNumber()
  @IsPositive()
  sale_bundle_total: string;

  @IsNumber()
  @IsPositive()
  cost_bundle_total: string;

  @IsString()
  pricing_mode: string = 'bundle_exact';
}

export class CreateProductBulkPricesDto {
  bulk_prices: CreateBulkPriceDto[];
}
