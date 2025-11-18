import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DiscountType } from 'src/database/types';

const DiscountTypeEnum: DiscountType[] = ['NONE', 'PERCENTAGE', 'FLAT'];

export class UpdateGlobalDiscountDto {
  @IsBoolean()
  isActive: boolean;

  @IsEnum(DiscountTypeEnum)
  type: DiscountType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderTotal?: number;

  @IsOptional()
  @IsString()
  label?: string;
}
