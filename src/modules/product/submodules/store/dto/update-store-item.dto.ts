import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsArray, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { CreateStoreItemDto } from './create-store-item.dto';

export class UpdateStoreItemDto extends PartialType(CreateStoreItemDto) {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    // Handle undefined, null, or empty string
    if (value === undefined || value === null || value === '') {
      return [];
    }
    // If already an array, return as-is
    if (Array.isArray(value)) {
      return value;
    }
    // Wrap single value in array
    return [value];
  })
  existingImages?: string[];
}
