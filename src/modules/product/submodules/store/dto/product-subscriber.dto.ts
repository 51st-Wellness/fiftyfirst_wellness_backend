import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductSubscriberStatus } from '@/database/schema';

export class CreateProductSubscriberDto {
  @IsString()
  productId: string;
}

export class UpdateProductSubscriberDto {
  @IsOptional()
  @IsEnum(ProductSubscriberStatus)
  status?: keyof typeof ProductSubscriberStatus;
}

export class ProductSubscriberQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(ProductSubscriberStatus)
  status?: keyof typeof ProductSubscriberStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class BulkEmailDto {
  @IsString()
  productId: string;

  @IsString()
  subject: string;

  @IsString()
  message: string;
}

export class SingleEmailDto {
  @IsString()
  subscriberId: string;

  @IsString()
  subject: string;

  @IsString()
  message: string;
}
