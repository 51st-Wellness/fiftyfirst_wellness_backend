import { IsOptional, IsString, IsIn } from 'class-validator';
import { CategoryService } from '../../../database/schema';

export class CategoryQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['store', 'programme', 'podcast'])
  service?: CategoryService;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
