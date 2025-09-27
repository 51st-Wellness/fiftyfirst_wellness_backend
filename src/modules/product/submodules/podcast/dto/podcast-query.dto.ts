import { Transform } from 'class-transformer';
import { PaginationQueryDto } from 'src/lib/dto/pagination.dto';
import { IsOptional, IsBoolean, IsString, IsArray } from 'class-validator';

export class PodcastQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isFeatured?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((item) => item.trim())
      : value,
  )
  categories?: string[];
}
