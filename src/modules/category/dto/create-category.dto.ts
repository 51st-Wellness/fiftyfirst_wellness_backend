import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { CategoryService } from '../../../database/schema';

export class CreateCategoryDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsIn(['store', 'programme', 'podcast'])
  service: CategoryService;
}
