import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { TransformEmptyToNull } from '../../common/decorators/transform-empty-to-null.decorator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @TransformEmptyToNull()
  description?: string | null;
}
