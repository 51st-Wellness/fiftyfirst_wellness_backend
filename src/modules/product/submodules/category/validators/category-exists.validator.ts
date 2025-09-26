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
export class CategoryExistsConstraint implements ValidatorConstraintInterface {
  constructor(private readonly categoryService: CategoryServiceProvider) {}

  async validate(categoryNames: string[], args: ValidationArguments) {
    if (!Array.isArray(categoryNames) || categoryNames.length === 0) {
      return true; // Allow empty arrays
    }

    const service = args.constraints[0] as CategoryService;
    if (!service) {
      return false;
    }

    try {
      // Get all categories for the service
      const existingCategories =
        await this.categoryService.findByService(service);
      const existingCategoryNames = existingCategories.map((cat) => cat.name);

      // Check if all provided category names exist
      return categoryNames.every((name) =>
        existingCategoryNames.includes(name),
      );
    } catch (error) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    const service = args.constraints[0] as CategoryService;
    return `One or more categories do not exist for ${service} service. Please use existing categories or create new ones first.`;
  }
}

export function CategoryExists(
  service: CategoryService,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [service],
      validator: CategoryExistsConstraint,
    });
  };
}
