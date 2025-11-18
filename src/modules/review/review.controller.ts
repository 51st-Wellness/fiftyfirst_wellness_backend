import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { Auth } from 'src/common/decorators/auth.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/database/types';
import { CreateReviewDto } from './dto/create-review.dto';
import { ResponseDto } from 'src/util/dto/response.dto';
import { ProductReviewQueryDto } from './dto/product-review-query.dto';
import { ProductReviewDto, ReviewSummaryDto } from './dto/review-response.dto';

// ReviewController exposes public + authenticated review endpoints
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // createReview lets authenticated customers submit a new review
  @Post()
  @Auth()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async createReview(
    @CurrentUser() user: User,
    @Body() dto: CreateReviewDto,
  ): Promise<ResponseDto<{ review: ProductReviewDto }>> {
    const review = await this.reviewService.createReview(user.id, dto);
    return ResponseDto.createSuccessResponse(
      'Review submitted for moderation',
      { review },
    );
  }

  // getProductReviews returns approved reviews for a product
  @Get('product/:productId')
  async getProductReviews(
    @Param('productId') productId: string,
    @Query(new ValidationPipe({ transform: true }))
    query: ProductReviewQueryDto,
  ): Promise<
    ResponseDto<{
      reviews: ProductReviewDto[];
      summary: ReviewSummaryDto;
      pagination: { total: number; page: number; pageSize: number };
    }>
  > {
    const result = await this.reviewService.getProductReviews(productId, query);
    return ResponseDto.createSuccessResponse(
      'Product reviews retrieved successfully',
      result,
    );
  }
}
