import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsArray, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { CreateStoreItemDto } from './create-store-item.dto';

export class UpdateStoreItemDto extends PartialType(CreateStoreItemDto) {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  existingImages?: string[];
}
