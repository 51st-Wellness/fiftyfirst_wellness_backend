import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { eq, desc, like, or, and, count, SQL } from 'drizzle-orm';
import { programmes } from 'src/database/schema';
import { Programme } from 'src/database/types';

@Injectable()
export class ProgrammeRepository {
  constructor(private readonly database: DatabaseService) {}

  async findById(id: string): Promise<Programme | null> {
    const result = await this.database.db
      .select()
      .from(programmes)
      .where(eq(programmes.productId, id));
    return result[0] || null;
  }

  async findAll(
    skip?: number,
    take?: number,
    filters?: {
      isPublished?: boolean;
      isFeatured?: boolean;
      search?: string;
      categories?: string[];
    },
  ): Promise<Programme[]> {
    const conditions: SQL[] = [];
    if (filters?.isPublished !== undefined) {
      conditions.push(eq(programmes.isPublished, filters.isPublished));
    }
    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(programmes.isFeatured, filters.isFeatured));
    }
    if (filters?.search) {
      const searchCondition = or(
        like(programmes.title, `%${filters.search}%`),
        like(programmes.description, `%${filters.search}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    if (filters?.categories && filters.categories.length > 0) {
      const categoryConditions = filters.categories.map((category) =>
        like(programmes.categories, `%"${category}"%`),
      );
      conditions.push(or(...categoryConditions));
    }

    let query = this.database.db.select().from(programmes).$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    if (skip !== undefined) {
      query = query.offset(skip);
    }
    if (take !== undefined) {
      query = query.limit(take);
    }

    return await query.orderBy(desc(programmes.createdAt));
  }

  async count(filters?: {
    isPublished?: boolean;
    isFeatured?: boolean;
    search?: string;
    categories?: string[];
  }): Promise<number> {
    const conditions: SQL[] = [];
    if (filters?.isPublished !== undefined) {
      conditions.push(eq(programmes.isPublished, filters.isPublished));
    }
    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(programmes.isFeatured, filters.isFeatured));
    }
    if (filters?.search) {
      const searchCondition = or(
        like(programmes.title, `%${filters.search}%`),
        like(programmes.description, `%${filters.search}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    if (filters?.categories && filters.categories.length > 0) {
      const categoryConditions = filters.categories.map((category) =>
        like(programmes.categories, `%"${category}"%`),
      );
      conditions.push(or(...categoryConditions));
    }

    let query = this.database.db
      .select({ count: count() })
      .from(programmes)
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    return result[0].count;
  }
}
