import { IsEmail, IsString, MinLength } from 'class-validator';

export class ContactFormDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10)
  message: string;
}
