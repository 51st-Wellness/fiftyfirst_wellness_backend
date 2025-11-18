import { IsEnum } from 'class-validator';
import { ReviewStatus } from 'src/database/schema';

// UpdateReviewStatusDto validates status changes triggered by admins
export class UpdateReviewStatusDto {
  @IsEnum(ReviewStatus)
  status: ReviewStatus;
}
