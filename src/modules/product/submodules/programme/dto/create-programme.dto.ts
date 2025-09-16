import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { AccessItem } from 'src/database/schema';

export class CreateProgrammeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  // @IsEnum(AccessItem)
  // @IsOptional()
  // isPremium?: F;
}

export class UpdateProgramme {
  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class UpdateProgrammeThumbnailDto {
  @IsString()
  @IsNotEmpty()
  productId: string;
}

export class CreateUploadUrlResponseDto {
  uploadUrl: string;
  uploadId: string;
  productId: string;
}
