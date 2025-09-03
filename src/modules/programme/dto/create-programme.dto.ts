import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateProgrammeDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}

export class UpdateProgrammeMetadataDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
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
