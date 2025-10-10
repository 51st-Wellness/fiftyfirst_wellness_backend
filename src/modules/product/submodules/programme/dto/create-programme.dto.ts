import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class CreateProgrammeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsString()
  categories: string[];

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class UpdateProgramme {
  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

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

export class CreateProgrammeDraftDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}

export class UpdateProgrammeDetailsDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
