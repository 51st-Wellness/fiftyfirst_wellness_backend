import { ReviewStatus } from 'src/database/schema';

export interface ReviewAuthorDto {
  id: string;
  name: string;
  initials: string;
  email?: string | null;
}

export interface ProductReviewDto {
  id: string;
  productId: string;
  orderId: string;
  orderItemId: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  author: ReviewAuthorDto;
}

export interface AdminReviewDto extends ProductReviewDto {
  userId: string;
}

export interface ReviewSummaryDto {
  averageRating: number;
  reviewCount: number;
  ratingBreakdown: Record<number, number>;
}
