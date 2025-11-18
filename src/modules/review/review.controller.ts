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
import {
  ProductReviewQueryDto,
  ProductReviewSummaryQueryDto,
} from './dto/product-review-query.dto';
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

  // getProductReviewSummary returns summary stats for a product
  @Get('product/:productId/summary')
  async getProductReviewSummary(
    @Param('productId') productId: string,
  ): Promise<ResponseDto<ReviewSummaryDto>> {
    const summary =
      await this.reviewService.getReviewSummaryForProduct(productId);
    return ResponseDto.createSuccessResponse(
      'Review summary retrieved successfully',
      summary,
    );
  }

  // getProductReviewSummaries returns summaries for multiple products
  @Post('products/summaries')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async getProductReviewSummaries(
    @Body() dto: ProductReviewSummaryQueryDto,
  ): Promise<ResponseDto<Record<string, ReviewSummaryDto>>> {
    const summaries = await this.reviewService.getReviewSummariesForProducts(
      dto.productIds,
    );
    return ResponseDto.createSuccessResponse(
      'Review summaries retrieved successfully',
      summaries,
    );
  }

  // checkUserReviewForOrderItem checks if user has reviewed an order item
  @Get('order-item/:orderItemId/check')
  @Auth()
  async checkUserReviewForOrderItem(
    @CurrentUser() user: User,
    @Param('orderItemId') orderItemId: string,
  ): Promise<ResponseDto<{ hasReviewed: boolean }>> {
    const hasReviewed = await this.reviewService.checkUserReviewForOrderItem(
      user.id,
      orderItemId,
    );
    return ResponseDto.createSuccessResponse('Review check completed', {
      hasReviewed,
    });
  }
}
