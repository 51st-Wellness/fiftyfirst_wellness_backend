import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, like, or, SQL, sql } from 'drizzle-orm';
import { DatabaseService } from 'src/database/database.service';
import {
  orders,
  orderItems,
  products,
  ProductType,
  reviews,
  ReviewStatus,
  users,
} from 'src/database/schema';
import { generateId } from 'src/database/utils';
import {
  AdminReviewDto,
  ProductReviewDto,
  ReviewSummaryDto,
} from './dto/review-response.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ProductReviewQueryDto } from './dto/product-review-query.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { StructuredLoggerService } from 'src/lib/logging';
import { buildRatingBreakdown, buildReviewSummary } from './review.utils';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';
import { Review, User } from 'src/database/types';

type ReviewRow = {
  review: Review;
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
};

// ReviewService encapsulates review creation, moderation, and query workflows
@Injectable()
export class ReviewService {
  constructor(
    private readonly database: DatabaseService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.logger.setContext(ReviewService.name);
  }

  // createReview persists a review linked to a purchased order item
  async createReview(
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ProductReviewDto> {
    const orderItemRecord = await this.fetchOrderItem(dto.orderItemId);

    if (!orderItemRecord) {
      throw new NotFoundException('Order item not found');
    }

    if (orderItemRecord.order.userId !== userId) {
      throw new ForbiddenException(
        'You can only review products you purchased',
      );
    }

    if (
      !['PAID', 'REFUNDED'].includes(orderItemRecord.order.status ?? 'PENDING')
    ) {
      throw new BadRequestException(
        'Only fulfilled orders can be reviewed at this time',
      );
    }

    if (orderItemRecord.product?.type !== ProductType.STORE) {
      throw new BadRequestException('Only store items support reviews today');
    }

    const existing = await this.database.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.orderItemId, dto.orderItemId));

    if (existing.length > 0) {
      throw new BadRequestException(
        'You already submitted a review for this item',
      );
    }

    const reviewId = generateId();
    const timestamp = new Date();

    await this.database.db.insert(reviews).values({
      id: reviewId,
      productId: orderItemRecord.item.productId,
      userId,
      orderId: orderItemRecord.order.id,
      orderItemId: dto.orderItemId,
      rating: dto.rating,
      comment: dto.comment.trim(),
      status: 'PENDING',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    this.logger.log('Queued review for moderation', {
      reviewId,
      productId: orderItemRecord.item.productId,
    });

    return this.fetchReviewById(reviewId);
  }

  // getProductReviews returns approved reviews plus aggregated summary
  async getProductReviews(
    productId: string,
    query: ProductReviewQueryDto,
  ): Promise<{
    reviews: ProductReviewDto[];
    summary: ReviewSummaryDto;
    pagination: { total: number; page: number; pageSize: number };
  }> {
    const pagination = this.resolvePagination(query.page, query.limit);
    const where = and(
      eq(reviews.productId, productId),
      eq(reviews.status, 'APPROVED'),
    );

    const [rows, counts] = await Promise.all([
      this.database.db
        .select({
          review: reviews,
          user: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
        })
        .from(reviews)
        .leftJoin(users, eq(users.id, reviews.userId))
        .where(where)
        .orderBy(desc(reviews.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.database.db
        .select({
          rating: reviews.rating,
          count: sql<number>`COUNT(${reviews.id})`,
        })
        .from(reviews)
        .where(where)
        .groupBy(reviews.rating),
    ]);

    const breakdown = buildRatingBreakdown(
      counts.reduce<Record<number, number>>((acc, current) => {
        acc[current.rating] = Number(current.count ?? 0);
        return acc;
      }, {}),
    );
    const summary = buildReviewSummary(breakdown);

    return {
      reviews: rows.map((row) => this.mapToProductReview(row)),
      summary,
      pagination: {
        total: summary.reviewCount,
        page: pagination.page,
        pageSize: pagination.limit,
      },
    };
  }

  // getAdminReviews lists reviews with moderation filters applied
  async getAdminReviews(query: ReviewQueryDto): Promise<{
    reviews: AdminReviewDto[];
    pagination: { total: number; page: number; pageSize: number };
  }> {
    const pagination = this.resolvePagination(query.page, query.limit);
    const conditions = this.buildAdminWhere(query);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const reviewQuery = this.database.db
      .select({
        review: reviews,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(users.id, reviews.userId))
      .orderBy(
        query.sortDirection === 'OLDEST'
          ? asc(reviews.createdAt)
          : desc(reviews.createdAt),
      )
      .limit(pagination.limit)
      .offset(pagination.offset);

    const countQuery = this.database.db
      .select({ count: sql<number>`COUNT(${reviews.id})` })
      .from(reviews)
      .leftJoin(users, eq(users.id, reviews.userId));

    const [rows, totalResult] = await Promise.all([
      whereClause ? reviewQuery.where(whereClause) : reviewQuery,
      whereClause ? countQuery.where(whereClause) : countQuery,
    ]);

    const total = Number(totalResult[0]?.count ?? 0);

    return {
      reviews: rows.map((row) => this.mapToAdminReview(row)),
      pagination: {
        total,
        page: pagination.page,
        pageSize: pagination.limit,
      },
    };
  }

  // updateReviewStatus moderates a review and returns the updated payload
  async updateReviewStatus(
    id: string,
    dto: UpdateReviewStatusDto,
  ): Promise<AdminReviewDto> {
    const existing = await this.database.db
      .select({ id: reviews.id, status: reviews.status })
      .from(reviews)
      .where(eq(reviews.id, id));

    if (existing.length === 0) {
      throw new NotFoundException('Review not found');
    }

    await this.database.db
      .update(reviews)
      .set({
        status: dto.status,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id));

    this.logger.log('Updated review status', { id, status: dto.status });
    return this.fetchAdminReviewById(id);
  }

  // deleteReview removes a review permanently
  async deleteReview(id: string): Promise<void> {
    const deleted = await this.database.db
      .delete(reviews)
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id });

    if (deleted.length === 0) {
      throw new NotFoundException('Review not found');
    }

    this.logger.warn('Deleted review', { id });
  }

  // getReviewStatsForProducts aggregates ratings for multiple products
  async getReviewStatsForProducts(
    productIds: string[],
  ): Promise<Map<string, { averageRating: number; reviewCount: number }>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const rows = await this.database.db
      .select({
        productId: reviews.productId,
        reviewCount: sql<number>`COUNT(${reviews.id})`,
        averageRating: sql<number>`AVG(${reviews.rating})`,
      })
      .from(reviews)
      .where(
        and(
          inArray(reviews.productId, productIds),
          eq(reviews.status, 'APPROVED'),
        ),
      )
      .groupBy(reviews.productId);

    return rows.reduce<
      Map<string, { averageRating: number; reviewCount: number }>
    >((acc, row) => {
      acc.set(row.productId, {
        averageRating: Number(row.averageRating ?? 0),
        reviewCount: Number(row.reviewCount ?? 0),
      });
      return acc;
    }, new Map());
  }

  // getReviewMapForOrderItems fetches reviews tied to specific order items
  async getReviewMapForOrderItems(
    orderItemIds: string[],
  ): Promise<Map<string, ProductReviewDto>> {
    if (orderItemIds.length === 0) {
      return new Map();
    }

    const rows = await this.database.db
      .select({
        review: reviews,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(users.id, reviews.userId))
      .where(inArray(reviews.orderItemId, orderItemIds));

    return rows.reduce<Map<string, ProductReviewDto>>((acc, row) => {
      acc.set(row.review.orderItemId, this.mapToProductReview(row));
      return acc;
    }, new Map());
  }

  // getReviewSummaryForProduct returns summary stats for a single product
  async getReviewSummaryForProduct(
    productId: string,
  ): Promise<ReviewSummaryDto> {
    const where = and(
      eq(reviews.productId, productId),
      eq(reviews.status, 'APPROVED'),
    );

    const counts = await this.database.db
      .select({
        rating: reviews.rating,
        count: sql<number>`COUNT(${reviews.id})`,
      })
      .from(reviews)
      .where(where)
      .groupBy(reviews.rating);

    const breakdown = buildRatingBreakdown(
      counts.reduce<Record<number, number>>((acc, current) => {
        acc[current.rating] = Number(current.count ?? 0);
        return acc;
      }, {}),
    );

    return buildReviewSummary(breakdown);
  }

  // getReviewSummariesForProducts returns summaries for multiple products
  async getReviewSummariesForProducts(
    productIds: string[],
  ): Promise<Record<string, ReviewSummaryDto>> {
    if (productIds.length === 0) {
      return {};
    }

    const where = and(
      inArray(reviews.productId, productIds),
      eq(reviews.status, 'APPROVED'),
    );

    const counts = await this.database.db
      .select({
        productId: reviews.productId,
        rating: reviews.rating,
        count: sql<number>`COUNT(${reviews.id})`,
      })
      .from(reviews)
      .where(where)
      .groupBy(reviews.productId, reviews.rating);

    const groupedByProduct = counts.reduce<
      Record<string, Record<number, number>>
    >((acc, row) => {
      if (!acc[row.productId]) {
        acc[row.productId] = {};
      }
      acc[row.productId][row.rating] = Number(row.count ?? 0);
      return acc;
    }, {});

    const result: Record<string, ReviewSummaryDto> = {};
    for (const productId of productIds) {
      const breakdown = buildRatingBreakdown(groupedByProduct[productId] ?? {});
      result[productId] = buildReviewSummary(breakdown);
    }

    return result;
  }

  // checkUserReviewForOrderItem checks if a user has reviewed a specific order item
  async checkUserReviewForOrderItem(
    userId: string,
    orderItemId: string,
  ): Promise<boolean> {
    const existing = await this.database.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(
        and(eq(reviews.orderItemId, orderItemId), eq(reviews.userId, userId)),
      )
      .limit(1);

    return existing.length > 0;
  }

  // fetchOrderItem pulls the order item with related metadata
  private async fetchOrderItem(orderItemId: string) {
    const rows = await this.database.db
      .select({
        item: orderItems,
        order: orders,
        product: products,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.id, orderItemId))
      .limit(1);

    return rows[0];
  }

  // fetchReviewById hydrates a review + author details
  private async fetchReviewById(id: string): Promise<ProductReviewDto> {
    const rows = await this.database.db
      .select({
        review: reviews,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(users.id, reviews.userId))
      .where(eq(reviews.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('Review not found');
    }

    return this.mapToProductReview(rows[0]);
  }

  // fetchAdminReviewById hydrates a review for admin usage
  private async fetchAdminReviewById(id: string): Promise<AdminReviewDto> {
    const rows = await this.database.db
      .select({
        review: reviews,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(users.id, reviews.userId))
      .where(eq(reviews.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('Review not found');
    }

    return this.mapToAdminReview(rows[0]);
  }

  // mapToProductReview converts raw rows to DTO form
  private mapToProductReview(row: ReviewRow): ProductReviewDto {
    const authorName = this.buildAuthorName(row.user);
    return {
      id: row.review.id,
      productId: row.review.productId,
      orderId: row.review.orderId,
      orderItemId: row.review.orderItemId,
      rating: row.review.rating,
      comment: row.review.comment ?? '',
      status: row.review.status as ReviewStatus,
      createdAt: new Date(row.review.createdAt),
      updatedAt: new Date(row.review.updatedAt),
      author: {
        id: row.user?.id ?? 'anonymous',
        name: authorName,
        initials: this.buildInitials(authorName),
      },
    };
  }

  // mapToAdminReview enriches the DTO with moderator metadata
  private mapToAdminReview(row: ReviewRow): AdminReviewDto {
    const productReview = this.mapToProductReview(row);
    return {
      ...productReview,
      author: {
        ...productReview.author,
        email: row.user?.email ?? null,
      },
      userId: row.user?.id ?? 'anonymous',
    };
  }

  // buildAuthorName composes a fallback name for reviewers
  private buildAuthorName(user: ReviewRow['user']): string {
    if (!user) {
      return 'Community Member';
    }
    return (
      [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member'
    );
  }

  // buildInitials derives two-letter initials from a name
  private buildInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length === 0) {
      return 'FF';
    }
    const [first, second] = parts;
    return (
      (first?.[0] ?? 'F') + (second?.[0] ?? parts[parts.length - 1]?.[0] ?? 'W')
    ).toUpperCase();
  }

  // resolvePagination normalizes pagination inputs
  private resolvePagination(page = 1, limit = 10) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return {
      page: safePage,
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
    };
  }

  // buildAdminWhere constructs moderation filters
  private buildAdminWhere(query: ReviewQueryDto): SQL[] {
    const clauses: SQL[] = [];

    if (query.status) {
      clauses.push(eq(reviews.status, query.status));
    }

    if (query.productId) {
      clauses.push(eq(reviews.productId, query.productId));
    }

    if (query.rating) {
      clauses.push(eq(reviews.rating, query.rating));
    }

    if (query.search?.trim()) {
      const searchTerm = `%${query.search.trim()}%`;
      clauses.push(
        or(
          like(reviews.comment, searchTerm),
          like(users.firstName, searchTerm),
          like(users.lastName, searchTerm),
          like(users.email, searchTerm),
        ) as SQL,
      );
    }

    return clauses;
  }
}
