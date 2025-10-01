import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginUserDto {
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
}
