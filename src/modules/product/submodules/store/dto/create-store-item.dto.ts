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
import { Transform, TransformFnParams } from 'class-transformer';
import { DiscountType } from 'src/database/schema';

const transformToBoolean = ({ value }: TransformFnParams) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return Boolean(value);
};

const transformToIsoString = ({ value }: TransformFnParams) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value === '') {
    return null;
  }
  return value;
};

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
  @Transform(transformToBoolean)
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(transformToBoolean)
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
  @Transform(transformToBoolean)
  discountActive?: boolean;

  @IsOptional()
  @IsISO8601()
  @Transform(transformToIsoString)
  discountStart?: string | null;

  @IsOptional()
  @IsISO8601()
  @Transform(transformToIsoString)
  discountEnd?: string | null;

  @IsOptional()
  @IsBoolean()
  @Transform(transformToBoolean)
  preOrderEnabled?: boolean;

  @IsOptional()
  @IsISO8601()
  @Transform(transformToIsoString)
  preOrderStart?: string | null;

  @IsOptional()
  @IsISO8601()
  @Transform(transformToIsoString)
  preOrderEnd?: string | null;

  @IsOptional()
  @IsISO8601()
  @Transform(transformToIsoString)
  preOrderFulfillmentDate?: string | null;

  @IsOptional()
  @IsBoolean()
  @Transform(transformToBoolean)
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
