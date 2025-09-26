import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, like, count, SQL } from 'drizzle-orm';
import { DatabaseService } from 'src/database/database.service';
import { categories, CategoryService } from 'src/database/schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { generateId } from 'src/database/utils';

@Injectable()
export class CategoryServiceProvider {
  constructor(private readonly databaseService: DatabaseService) {}

  // Create a new category
  async create(createCategoryDto: CreateCategoryDto) {
    const id = generateId();

    const [category] = await this.databaseService.db
      .insert(categories)
      .values({
        id,
        ...createCategoryDto,
      })
      .returning();

    return category;
  }

  // Get all categories with optional filtering
  async findAll(query: CategoryQueryDto) {
    const { search, service, page = '1', limit = '20' } = query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build the where condition
    const conditions: SQL[] = [];

    if (search) {
      conditions.push(like(categories.name, `%${search}%`));
    }

    if (service) {
      conditions.push(eq(categories.service, service));
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Get categories
    const categoriesResult = await this.databaseService.db
      .select()
      .from(categories)
      .where(whereCondition)
      .limit(limitNum)
      .offset(offset)
      .orderBy(categories.name);

    // Get total count
    const [{ total }] = await this.databaseService.db
      .select({ total: count() })
      .from(categories)
      .where(whereCondition);

    return {
      data: categoriesResult,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  // Get categories by service
  async findByService(service: CategoryService) {
    return await this.databaseService.db
      .select()
      .from(categories)
      .where(eq(categories.service, service))
      .orderBy(categories.name);
  }

  // Get category by ID
  async findOne(id: string) {
    const [category] = await this.databaseService.db
      .select()
      .from(categories)
      .where(eq(categories.id, id));

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  // Update category
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const existingCategory = await this.findOne(id);

    const [updatedCategory] = await this.databaseService.db
      .update(categories)
      .set({
        ...updateCategoryDto,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();

    return updatedCategory;
  }

  // Delete category
  async remove(id: string) {
    const existingCategory = await this.findOne(id);

    await this.databaseService.db
      .delete(categories)
      .where(eq(categories.id, id));

    return { message: 'Category deleted successfully' };
  }

  // Check if category name exists for a service
  async categoryNameExists(
    name: string,
    service: CategoryService,
    excludeId?: string,
  ) {
    const conditions = [
      eq(categories.name, name),
      eq(categories.service, service),
    ];

    if (excludeId) {
      conditions.push(eq(categories.id, excludeId));
    }

    const [existingCategory] = await this.databaseService.db
      .select()
      .from(categories)
      .where(and(...conditions));

    return !!existingCategory;
  }
}
