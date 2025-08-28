import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '../constants';

export class UploadFileDto {
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  bucket?: string;
}
