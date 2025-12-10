import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { eq, and, count, sql, gte, isNull, ne } from 'drizzle-orm';
import {
  products,
  programmes,
  users,
  orders,
  payments,
  PaymentStatus,
  reviews,
  UserRole,
  OrderStatus,
} from 'src/database/schema';
import { OverviewStatsDto, ProgrammeStatsDto } from './dto/stats.dto';

@Injectable()
export class StatsService {
  constructor(private readonly database: DatabaseService) {}

  // Get programme-specific statistics
  async getProgrammeStats(): Promise<ProgrammeStatsDto> {
    const [totalResult, publishedResult, draftResult, featuredResult] =
      await Promise.all([
        // Total programmes
        this.database.db
          .select({ count: count() })
          .from(programmes)
          .innerJoin(products, eq(programmes.productId, products.id)),

        // Published programmes
        this.database.db
          .select({ count: count() })
          .from(programmes)
          .innerJoin(products, eq(programmes.productId, products.id))
          .where(eq(programmes.isPublished, true)),

        // Draft programmes
        this.database.db
          .select({ count: count() })
          .from(programmes)
          .innerJoin(products, eq(programmes.productId, products.id))
          .where(eq(programmes.isPublished, false)),

        // Featured programmes
        this.database.db
          .select({ count: count() })
          .from(programmes)
          .innerJoin(products, eq(programmes.productId, products.id))
          .where(eq(programmes.isFeatured, true)),
      ]);

    return {
      totalProgrammes: totalResult[0]?.count || 0,
      publishedProgrammes: publishedResult[0]?.count || 0,
      draftProgrammes: draftResult[0]?.count || 0,
      featuredProgrammes: featuredResult[0]?.count || 0,
    };
  }

  // Helper to get user growth over last 30 days
  async getUserGrowthStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userSignups = await this.database.db
      .select({
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          gte(users.createdAt, thirtyDaysAgo),
          eq(users.role, UserRole.USER),
          isNull(users.deletedAt),
        ),
      );

    // Group by date
    const growthMap = new Map<string, number>();
    // Initialize last 30 days with 0
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      growthMap.set(dateStr, 0);
    }

    userSignups.forEach((u) => {
      if (u.createdAt) {
        const dateStr = u.createdAt.toISOString().split('T')[0];
        if (growthMap.has(dateStr)) {
          growthMap.set(dateStr, (growthMap.get(dateStr) || 0) + 1);
        }
      }
    });

    // Convert to array and sort by date
    return Array.from(growthMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Get comprehensive overview statistics
  async getOverviewStats(): Promise<OverviewStatsDto> {
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday as start

    const [
      programmeStats,
      totalUsers,
      totalOrders,
      totalRevenue,
      reviewsThisWeek,
      totalPreOrders,
      userGrowth,
    ] = await Promise.all([
      this.getProgrammeStats(),

      // Total users (active and not deleted, excluding admins)
      this.database.db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            isNull(users.deletedAt),
            eq(users.role, UserRole.USER),
            eq(users.isActive, true),
          ),
        ),

      // Total orders (exclude failed/cancelled)
      this.database.db
        .select({ count: count() })
        .from(orders)
        .where(
          and(
            ne(orders.status, OrderStatus.FAILED),
            ne(orders.status, OrderStatus.NOTFOUND),
            ne(orders.status, OrderStatus.EXPIRED),
          ),
        ),

      // Total revenue (sum of successful payments)
      this.database.db
        .select({
          total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
        })
        .from(payments)
        .where(eq(payments.status, PaymentStatus.PAID)),

      // Reviews this week
      this.database.db
        .select({ count: count() })
        .from(reviews)
        .where(
          gte(
            reviews.createdAt,
            new Date(new Date().setDate(new Date().getDate() - 7)),
          ),
        ),

      // Total Pre-orders
      this.database.db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.isPreOrder, true)),

      // User Growth Data
      this.getUserGrowthStats(),
    ]);

    return {
      ...programmeStats,
      totalUsers: totalUsers[0]?.count || 0,
      totalOrders: totalOrders[0]?.count || 0,
      totalRevenue: Number(totalRevenue[0]?.total) || 0,
      reviewsThisWeek: reviewsThisWeek[0]?.count || 0,
      totalPreOrders: totalPreOrders[0]?.count || 0,
      userGrowth,
    };
  }
}
