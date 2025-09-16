import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { eq, desc, like, or, and, count, SQL } from 'drizzle-orm';
import { storeItems, products } from 'src/database/schema';
import {
  StoreItem,
  NewStoreItem,
  ProductWithStoreItem,
} from 'src/database/types';
import { generateId } from 'src/database/utils';

@Injectable()
export class StoreRepository {
  constructor(private readonly database: DatabaseService) {}

  // Create a new store item with corresponding product
  async create(
    data: Omit<NewStoreItem, 'productId' | 'createdAt' | 'updatedAt'>,
  ): Promise<StoreItem> {
    const productId = generateId();

    // Create the store item
    const newStoreItem: NewStoreItem = {
      productId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.database.db
      .insert(storeItems)
      .values(newStoreItem)
      .returning();
    return result[0];
  }

  // Find store item by ID
  async findById(id: string): Promise<StoreItem | null> {
    const result = await this.database.db
      .select()
      .from(storeItems)
      .where(eq(storeItems.productId, id));
    return result[0] || null;
  }

  // Find all store items with pagination and filters
  async findAll(
    skip?: number,
    take?: number,
    filters?: {
      isPublished?: boolean;
      isFeatured?: boolean;
      search?: string;
    },
  ): Promise<StoreItem[]> {
    // Build where conditions
    const conditions: SQL[] = [];
    if (filters?.isPublished !== undefined) {
      conditions.push(eq(storeItems.isPublished, filters.isPublished));
    }
    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(storeItems.isFeatured, filters.isFeatured));
    }
    if (filters?.search) {
      const searchCondition = or(
        like(storeItems.name, `%${filters.search}%`),
        like(storeItems.description, `%${filters.search}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Build query step by step using a dynamic query builder
    let query = this.database.db.select().from(storeItems).$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    if (skip !== undefined) {
      query = query.offset(skip);
    }

    if (take !== undefined) {
      query = query.limit(take);
    }

    return await query.orderBy(desc(storeItems.createdAt));
  }

  // Count store items with filters
  async count(filters?: {
    isPublished?: boolean;
    isFeatured?: boolean;
    search?: string;
  }): Promise<number> {
    // Build where conditions
    const conditions: SQL[] = [];
    if (filters?.isPublished !== undefined) {
      conditions.push(eq(storeItems.isPublished, filters.isPublished));
    }
    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(storeItems.isFeatured, filters.isFeatured));
    }
    if (filters?.search) {
      const searchCondition = or(
        like(storeItems.name, `%${filters.search}%`),
        like(storeItems.description, `%${filters.search}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Build count query step by step using a dynamic query builder
    let query = this.database.db
      .select({ count: count() })
      .from(storeItems)
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query;
    return result[0].count;
  }

  // Update store item by ID
  async update(
    id: string,
    data: Partial<Omit<NewStoreItem, 'productId' | 'createdAt'>>,
  ): Promise<StoreItem> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await this.database.db
      .update(storeItems)
      .set(updateData)
      .where(eq(storeItems.productId, id))
      .returning();
    return result[0];
  }

  // Delete store item by ID
  async delete(id: string): Promise<StoreItem> {
    const result = await this.database.db
      .delete(storeItems)
      .where(eq(storeItems.productId, id))
      .returning();
    return result[0];
  }

  // Find featured store items
  async findFeatured(): Promise<StoreItem[]> {
    return await this.database.db
      .select()
      .from(storeItems)
      .where(
        and(eq(storeItems.isFeatured, true), eq(storeItems.isPublished, true)),
      )
      .orderBy(desc(storeItems.createdAt));
  }

  // Search store items by name or description
  async search(query: string): Promise<StoreItem[]> {
    return await this.database.db
      .select()
      .from(storeItems)
      .where(
        and(
          or(
            like(storeItems.name, `%${query}%`),
            like(storeItems.description, `%${query}%`),
          ),
          eq(storeItems.isPublished, true),
        ),
      )
      .orderBy(desc(storeItems.createdAt));
  }
}
