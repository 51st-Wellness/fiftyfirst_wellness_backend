import { IsOptional, IsString, IsIn } from 'class-validator';
import { CategoryService } from '../../../../../database/schema';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['store', 'programme', 'podcast'])
  service?: CategoryService;
}
