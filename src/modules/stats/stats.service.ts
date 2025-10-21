import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { eq, and, count, sql } from 'drizzle-orm';
import {
  products,
  programmes,
  users,
  orders,
  payments,
  PaymentStatus,
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

  // Get comprehensive overview statistics
  async getOverviewStats(): Promise<OverviewStatsDto> {
    const [programmeStats, totalUsers, totalOrders, totalRevenue] =
      await Promise.all([
        this.getProgrammeStats(),

        // Total users
        this.database.db.select({ count: count() }).from(users),

        // Total orders
        this.database.db.select({ count: count() }).from(orders),

        // Total revenue (sum of successful payments)
        this.database.db
          .select({
            total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
          })
          .from(payments)
          .where(eq(payments.status, PaymentStatus.PAID)),
      ]);

    return {
      ...programmeStats,
      totalUsers: totalUsers[0]?.count || 0,
      totalOrders: totalOrders[0]?.count || 0,
      totalRevenue: Number(totalRevenue[0]?.total) || 0,
    };
  }
}
