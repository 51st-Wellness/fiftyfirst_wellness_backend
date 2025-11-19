import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  IsEnum,
  IsISO8601,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { DiscountType } from 'src/database/schema';

export class CreateStoreItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  categories?: string[];

  @IsOptional()
  @IsEnum(['NONE', 'PERCENTAGE', 'FLAT'])
  discountType?: DiscountType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsBoolean()
  discountActive?: boolean;

  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => (value === '' ? undefined : value))
  discountStart?: string;

  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => (value === '' ? undefined : value))
  discountEnd?: string;

  @IsOptional()
  @IsBoolean()
  preOrderEnabled?: boolean;

  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => (value === '' ? undefined : value))
  preOrderStart?: string;

  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => (value === '' ? undefined : value))
  preOrderEnd?: string;

  @IsOptional()
  @IsISO8601()
  @Transform(({ value }) => (value === '' ? undefined : value))
  preOrderFulfillmentDate?: string;

  @IsOptional()
  @IsBoolean()
  preOrderDepositRequired?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preOrderDepositAmount?: number;

  @IsOptional()
  @IsString()
  productUsage?: string;

  @IsOptional()
  @IsString()
  productBenefits?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  productIngredients?: string[];
}
