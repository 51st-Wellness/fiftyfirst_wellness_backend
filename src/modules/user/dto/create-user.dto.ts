import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
} from 'class-validator';
import { UserRole } from 'src/database/schema';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  @IsStrongPassword(undefined, {
    message:
      'Password must contain at least 1 lowercase letter, 1 uppercase letter, 1 number, and 1 symbol',
  })
  password?: string; // Optional for Google OAuth users

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  phone?: string; // Optional for Google OAuth users

  @IsString()
  @IsOptional()
  googleId?: string; // Google OAuth ID

  @IsString()
  @IsOptional()
  profilePicture?: string; // Profile picture URL

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
