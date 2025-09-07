import { Transform } from 'class-transformer';
import { PaginationQueryDto } from 'src/lib/dto/pagination.dto';
import { IsOptional, IsBoolean, IsString, IsArray } from 'class-validator';

export class ProgrammeQueryDto extends PaginationQueryDto {
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
  tags?: string[];
}
