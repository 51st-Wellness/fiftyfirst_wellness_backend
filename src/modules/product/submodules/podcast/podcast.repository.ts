import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { eq, desc, like, or, and, count, SQL, sql } from 'drizzle-orm';
import { podcasts } from 'src/database/schema';
import { Podcast } from 'src/database/types';

@Injectable()
export class PodcastRepository {
  constructor(private readonly database: DatabaseService) {}

  async findById(id: string): Promise<Podcast | null> {
    const result = await this.database.db
      .select()
      .from(podcasts)
      .where(eq(podcasts.productId, id));
    return result[0] || null;
  }

  async findAll(
    skip?: number,
    take?: number,
    filters?: {
      isPublished?: boolean;
      isFeatured?: boolean;
      categories?: string[];
    },
  ): Promise<Podcast[]> {
    const conditions: SQL[] = [];
    if (filters?.isPublished !== undefined) {
      conditions.push(eq(podcasts.isPublished, filters.isPublished));
    }
    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(podcasts.isFeatured, filters.isFeatured));
    }

    if (filters?.categories && filters.categories.length > 0) {
      const categoryConditions = filters.categories.map(
        (category) =>
          sql`${podcasts.categories} @> ${JSON.stringify([category])}`,
      );
      conditions.push(or(...categoryConditions) as any);
    }

    let query = this.database.db.select().from(podcasts).$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    if (skip !== undefined) {
      query = query.offset(skip);
    }
    if (take !== undefined) {
      query = query.limit(take);
    }

    return await query.orderBy(desc(podcasts.createdAt));
  }

  async count(filters?: {
    isPublished?: boolean;
    isFeatured?: boolean;
    categories?: string[];
  }): Promise<number> {
    const conditions: SQL[] = [];
    if (filters?.isPublished !== undefined) {
      conditions.push(eq(podcasts.isPublished, filters.isPublished));
    }
    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(podcasts.isFeatured, filters.isFeatured));
    }

    if (filters?.categories && filters.categories.length > 0) {
      const categoryConditions = filters.categories.map(
        (category) =>
          sql`${podcasts.categories} @> ${JSON.stringify([category])}`,
      );
      conditions.push(or(...categoryConditions) as any);
    }

    let query = this.database.db
      .select({ count: count() })
      .from(podcasts)
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    return result[0].count;
  }
}
