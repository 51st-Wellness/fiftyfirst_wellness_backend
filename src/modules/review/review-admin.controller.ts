import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/schema';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ResponseDto } from 'src/util/dto/response.dto';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';
import { AdminReviewDto } from './dto/review-response.dto';

// ReviewAdminController exposes moderation-focused endpoints
@Controller('admin/reviews')
@UseGuards(RolesGuard)
export class ReviewAdminController {
  constructor(private readonly reviewService: ReviewService) {}

  // listReviews returns paginated reviews for moderators
  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async listReviews(
    @Query(new ValidationPipe({ transform: true }))
    query: ReviewQueryDto,
  ): Promise<
    ResponseDto<{
      reviews: AdminReviewDto[];
      pagination: { total: number; page: number; pageSize: number };
    }>
  > {
    const result = await this.reviewService.getAdminReviews(query);
    return ResponseDto.createSuccessResponse(
      'Reviews retrieved successfully',
      result,
    );
  }

  // updateStatus moderates a review
  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReviewStatusDto,
  ): Promise<ResponseDto<{ review: AdminReviewDto }>> {
    const review = await this.reviewService.updateReviewStatus(id, dto);
    return ResponseDto.createSuccessResponse('Review updated', { review });
  }

  // deleteReview removes a review permanently
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async deleteReview(@Param('id') id: string): Promise<ResponseDto<null>> {
    await this.reviewService.deleteReview(id);
    return ResponseDto.createSuccessResponse('Review deleted successfully');
  }
}
