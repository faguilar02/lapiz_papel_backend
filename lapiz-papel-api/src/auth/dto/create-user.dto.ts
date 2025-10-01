import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../models/enums';

export class CreateUserDto {
  @IsString()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @Matches(/(?:^(?=.*\d)(?![.\n])(?=.*[a-z]).*$)/, {
    message: 'The password must have a lowercase letter and a number',
  })
  password: string;

  @IsString()
  @MinLength(1)
  full_name: string;

  @IsEnum(UserRole)
  @IsString()
  @IsOptional()
  role?: UserRole;
}
