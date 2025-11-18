import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

// ProductReviewQueryDto validates pagination for public review listing
export class ProductReviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 6;
}

// ProductReviewSummaryQueryDto validates request for multiple product summaries
export class ProductReviewSummaryQueryDto {
  @IsArray()
  @IsUUID('4', { each: true })
  productIds: string[];
}
