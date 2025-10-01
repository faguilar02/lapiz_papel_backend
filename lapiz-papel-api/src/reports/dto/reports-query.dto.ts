import { IsOptional, IsDateString, IsIn } from 'class-validator';

export class ReportsQueryDto {
  @IsOptional()
  @IsIn(['7days', '30days', '3months', '6months', '1year', 'custom'])
  period?: string = '7days';

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;
}
