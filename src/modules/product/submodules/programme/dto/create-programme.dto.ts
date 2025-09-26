import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
} from 'class-validator';
import { AccessItem } from 'src/database/schema';
import { CategoryExists } from '../../../category/validators/category-exists.validator';

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
  @IsArray()
  @IsString({ each: true })
  @CategoryExists('programme', {
    message: 'All tags must be existing programme categories',
  })
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
