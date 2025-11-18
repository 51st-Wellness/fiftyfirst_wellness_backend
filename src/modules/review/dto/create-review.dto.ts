import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

// CreateReviewDto validates payload for creating a product review
export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  orderItemId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsNotEmpty()
  comment: string;
}
