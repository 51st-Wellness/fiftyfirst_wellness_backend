import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { CategoryService } from 'src/database/schema';

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
