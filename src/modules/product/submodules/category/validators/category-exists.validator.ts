import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { CategoryServiceProvider } from '../category.service';
import { CategoryService } from 'src/database/schema';

@ValidatorConstraint({ async: true })
@Injectable()
export class CategoryExistsConstraint {
  constructor(private readonly categoryService: CategoryServiceProvider) {}

  async validate(categoryNames: string[], service: CategoryService) {
    if (!Array.isArray(categoryNames) || categoryNames.length === 0) {
      return true;
    }

    try {
      // Get all categories for the service
      const existingCategories = await this.categoryService.findAll({
        service,
      });
      const existingCategoryNames = existingCategories.data.map(
        (cat) => cat.name,
      );

      console.log('existingCategoryNames', existingCategoryNames);

      // Check if all provided category names exist
      return categoryNames.every((name) =>
        existingCategoryNames.includes(name),
      );
    } catch (error) {
      console.log('error', error);
      return false;
    }
  }

  static defaultMessage(service: CategoryService) {
    return `One or more categories do not exist for ${service} service. Please use existing categories or create new ones first.`;
  }
}
