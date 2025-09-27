import { IsOptional, IsBoolean, IsString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from 'src/lib/dto/pagination.dto';

export class StoreItemQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}
