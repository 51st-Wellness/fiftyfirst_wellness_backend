import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { CategoryServiceProvider } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { Auth } from 'src/common/decorators/auth.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/schema';

@Controller('product/category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryServiceProvider) {}

  @Post()
  @Auth()
  @Roles(UserRole.ADMIN)
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    // Check if category name already exists for this service
    const exists = await this.categoryService.categoryNameExists(
      createCategoryDto.name,
      createCategoryDto.service,
    );

    if (exists) {
      throw new BadRequestException(
        `Category with name "${createCategoryDto.name}" already exists for ${createCategoryDto.service} service`,
      );
    }

    return this.categoryService.create(createCategoryDto);
  }

  @Get()
  async findAll(@Query() query: CategoryQueryDto) {
    return this.categoryService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    // If updating name, check if it already exists for this service
    if (updateCategoryDto.name) {
      const category = await this.categoryService.findOne(id);
      const exists = await this.categoryService.categoryNameExists(
        updateCategoryDto.name,
        updateCategoryDto.service || category.service,
        id,
      );

      if (exists) {
        throw new BadRequestException(
          `Category with name "${updateCategoryDto.name}" already exists for ${updateCategoryDto.service || category.service} service`,
        );
      }
    }

    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @Auth()
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
