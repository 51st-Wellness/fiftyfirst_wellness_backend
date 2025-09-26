import { Module } from '@nestjs/common';
import { CategoryServiceProvider } from './category.service';
import { CategoryController } from './category.controller';
import { DatabaseModule } from '../../database/database.module';
import { CategoryExistsConstraint } from './validators/category-exists.validator';

@Module({
  imports: [DatabaseModule],
  controllers: [CategoryController],
  providers: [CategoryServiceProvider, CategoryExistsConstraint],
  exports: [CategoryServiceProvider, CategoryExistsConstraint],
})
export class CategoryModule {}
