import { Transform } from 'class-transformer/types/decorators/transform.decorator';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from 'src/database/schema';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
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
