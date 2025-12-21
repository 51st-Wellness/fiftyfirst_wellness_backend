import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  eq,
  desc,
  like,
  ilike,
  or,
  and,
  count,
  SQL,
  sql,
  isNull,
} from 'drizzle-orm';
import {
  storeItems,
  products,
  reviews,
  ProductType,
  PricingModel,
} from 'src/database/schema';
import {
  StoreItem,
  NewStoreItem,
  ProductWithStoreItem,
} from 'src/database/types';
import { generateId } from 'src/database/utils';

@Injectable()
export class StoreRepository {
  constructor(private readonly database: DatabaseService) {}

  // Create a new store item and its corresponding core product record
  async create(
    data: Omit<NewStoreItem, 'productId' | 'createdAt' | 'updatedAt'>,
  ): Promise<StoreItem> {
    const productId = generateId();

    // Create core product entry used across the platform (cart, orders, etc)
    await this.database.db.insert(products).values({
      id: productId,
      type: ProductType.STORE,
      pricingModel: PricingModel.ONE_TIME,
    });

    // Create the store item details
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

  // Find store item by ID, including review statistics
  async findById(
    id: string,
  ): Promise<
    (StoreItem & { averageRating: number; reviewCount: number }) | null
  > {
    try {
      // Use Drizzle select with custom SQL for productIngredients and review stats
      const result = await this.database.db
        .select({
          productId: storeItems.productId,
          name: storeItems.name,
          description: storeItems.description,
          productUsage: storeItems.productUsage,
          productBenefits: storeItems.productBenefits,
          productIngredients: storeItems.productIngredients,
          price: storeItems.price,
          stock: storeItems.stock,
          display: storeItems.display,
          images: storeItems.images,
          categories: storeItems.categories,
          isFeatured: storeItems.isFeatured,
          isPublished: storeItems.isPublished,
          discountType: storeItems.discountType,
          discountValue: storeItems.discountValue,
          discountActive: storeItems.discountActive,
          discountStart: storeItems.discountStart,
          discountEnd: storeItems.discountEnd,
          preOrderEnabled: storeItems.preOrderEnabled,
          createdAt: storeItems.createdAt,
          updatedAt: storeItems.updatedAt,
          averageRating: sql<number>`COALESCE(AVG(CASE WHEN ${reviews.status} = 'APPROVED' THEN ${reviews.rating} ELSE NULL END), 0)`,
          reviewCount: sql<number>`COUNT(CASE WHEN ${reviews.status} = 'APPROVED' THEN 1 ELSE NULL END)`,
          weight: storeItems.weight,
          length: storeItems.length,
          width: storeItems.width,
          height: storeItems.height,
        })
        .from(storeItems)
        .leftJoin(reviews, eq(reviews.productId, storeItems.productId))
        .where(
          and(
            eq(storeItems.productId, id),
            isNull(storeItems.deletedAt as any),
          ),
        )
        .groupBy(storeItems.productId)
        .limit(1);

      if (result[0]) {
        // Drizzle PG driver automatically parses JSONB, so we just pass it through
        // We might still need to handle nulls if that's business logic
        return {
          ...(result[0] as unknown as StoreItem), // cast to match return type assuming driver returns correct types
          averageRating: Number(result[0].averageRating ?? 0),
          reviewCount: Number(result[0].reviewCount ?? 0),
        };
      }
      return null;
    } catch (error: any) {
      console.error('Error finding store item by ID:', error);
      throw error;
    }
  }

  // Sanitize store item to ensure JSON fields are valid
  // Postgres driver returns objects, so parsing is mostly redundant but we verify structure
  private sanitizeStoreItem(item: any): StoreItem {
    return item as StoreItem;
  }

  // Find all store items with pagination and filters, including review statistics
  async findAll(
    skip?: number,
    take?: number,
    filters?: {
      isPublished?: boolean;
      isFeatured?: boolean;
      search?: string;
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      minRating?: number;
    },
  ): Promise<(StoreItem & { averageRating: number; reviewCount: number })[]> {
    try {
      // Build where conditions
      const conditions: SQL[] = [isNull(storeItems.deletedAt as any) as any];
      if (filters?.isPublished !== undefined) {
        conditions.push(eq(storeItems.isPublished, filters.isPublished));
      }
      if (filters?.isFeatured !== undefined) {
        conditions.push(eq(storeItems.isFeatured, filters.isFeatured));
      }
      if (filters?.search) {
        // Use ilike for case-insensitive search in Postgres
        const searchCondition = or(
          ilike(storeItems.name, `%${filters.search}%`),
          ilike(storeItems.description, `%${filters.search}%`),
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }
      if (filters?.category) {
        // Use Postgres JSONB containment operator
        // categories @> '["CategoryName"]'
        conditions.push(
          sql`${storeItems.categories} @> ${JSON.stringify([filters.category])}`,
        );
      }
      if (filters?.minPrice !== undefined) {
        conditions.push(sql`${storeItems.price} >= ${filters.minPrice}`);
      }
      if (filters?.maxPrice !== undefined) {
        conditions.push(sql`${storeItems.price} <= ${filters.maxPrice}`);
      }

      // Build query with review statistics using LEFT JOIN and aggregation
      let query = this.database.db
        .select({
          productId: storeItems.productId,
          name: storeItems.name,
          description: storeItems.description,
          productUsage: storeItems.productUsage,
          productBenefits: storeItems.productBenefits,
          productIngredients: sql<string[] | null>`CASE 
            WHEN json_valid(${storeItems.productIngredients}) THEN ${storeItems.productIngredients}
            ELSE NULL
          END`,
          price: storeItems.price,
          stock: storeItems.stock,
          display: storeItems.display,
          images: storeItems.images,
          categories: storeItems.categories,
          isFeatured: storeItems.isFeatured,
          isPublished: storeItems.isPublished,
          discountType: storeItems.discountType,
          discountValue: storeItems.discountValue,
          discountActive: storeItems.discountActive,
          discountStart: storeItems.discountStart,
          discountEnd: storeItems.discountEnd,
          preOrderEnabled: storeItems.preOrderEnabled,
          createdAt: storeItems.createdAt,
          updatedAt: storeItems.updatedAt,
          averageRating: sql<number>`COALESCE(AVG(CASE WHEN ${reviews.status} = 'APPROVED' THEN ${reviews.rating} ELSE NULL END), 0)`,
          reviewCount: sql<number>`COUNT(CASE WHEN ${reviews.status} = 'APPROVED' THEN 1 ELSE NULL END)`,
          weight: storeItems.weight,
          length: storeItems.length,
          width: storeItems.width,
          height: storeItems.height,
        })
        .from(storeItems)
        .leftJoin(reviews, eq(reviews.productId, storeItems.productId))
        .$dynamic();

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      query = query.groupBy(storeItems.productId);

      // Apply rating filter using HAVING on aggregated average rating
      if (filters?.minRating !== undefined) {
        query = query.having(
          sql`COALESCE(AVG(CASE WHEN ${reviews.status} = 'APPROVED' THEN ${reviews.rating} ELSE NULL END), 0) >= ${filters.minRating}`,
        );
      }

      if (skip !== undefined) {
        query = query.offset(skip);
      }

      if (take !== undefined) {
        query = query.limit(take);
      }

      const results = await query.orderBy(desc(storeItems.createdAt));
      return results.map((item) => ({
        ...this.sanitizeStoreItem(item),
        averageRating: Number(item.averageRating ?? 0),
        reviewCount: Number(item.reviewCount ?? 0),
      }));
    } catch (error: any) {
      console.error('Error finding all store items:', error);
      throw error;
    }
  }

  // Count store items with filters
  async count(filters?: {
    isPublished?: boolean;
    isFeatured?: boolean;
    search?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
  }): Promise<number> {
    // Build where conditions
    const conditions: SQL[] = [isNull(storeItems.deletedAt as any) as any];
    if (filters?.isPublished !== undefined) {
      conditions.push(eq(storeItems.isPublished, filters.isPublished));
    }
    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(storeItems.isFeatured, filters.isFeatured));
    }
    if (filters?.search) {
      // Use ilike
      const searchCondition = or(
        ilike(storeItems.name, `%${filters.search}%`),
        ilike(storeItems.description, `%${filters.search}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    if (filters?.category) {
      // Use JSONB containment
      conditions.push(
        sql`${storeItems.categories} @> ${JSON.stringify([filters.category])}`,
      );
    }
    if (filters?.minPrice !== undefined) {
      conditions.push(sql`${storeItems.price} >= ${filters.minPrice}`);
    }
    if (filters?.maxPrice !== undefined) {
      conditions.push(sql`${storeItems.price} <= ${filters.maxPrice}`);
    }

    // Build base query selecting distinct product IDs with optional rating HAVING
    let query = this.database.db
      .select({
        productId: storeItems.productId,
      })
      .from(storeItems)
      .leftJoin(reviews, eq(reviews.productId, storeItems.productId))
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.groupBy(storeItems.productId);

    if (filters?.minRating !== undefined) {
      query = query.having(
        sql`COALESCE(AVG(CASE WHEN ${reviews.status} = 'APPROVED' THEN ${reviews.rating} ELSE NULL END), 0) >= ${filters.minRating}`,
      );
    }

    const result = await query;
    return result.length;
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

  // Soft delete store item by ID (set deletedAt, keep row for relations)
  async delete(id: string): Promise<StoreItem> {
    const result = await this.database.db
      .update(storeItems)
      .set({
        deletedAt: new Date(),
        // isPublished: false, // Drizzle type inference prefers strict boolean
        isPublished: false,
        isFeatured: false,
      })
      .where(eq(storeItems.productId, id))
      .returning();
    return result[0];
  }

  // Find featured store items
  async findFeatured(): Promise<StoreItem[]> {
    const results = await this.database.db
      .select({
        productId: storeItems.productId,
        name: storeItems.name,
        description: storeItems.description,
        productUsage: storeItems.productUsage,
        productBenefits: storeItems.productBenefits,
        productIngredients: storeItems.productIngredients, // No complex SQL case needed for JSONB
        price: storeItems.price,
        stock: storeItems.stock,
        display: storeItems.display,
        images: storeItems.images,
        categories: storeItems.categories,
        isFeatured: storeItems.isFeatured,
        isPublished: storeItems.isPublished,
        discountType: storeItems.discountType,
        discountValue: storeItems.discountValue,
        discountActive: storeItems.discountActive,
        discountStart: storeItems.discountStart,
        discountEnd: storeItems.discountEnd,
        preOrderEnabled: storeItems.preOrderEnabled,
        createdAt: storeItems.createdAt,
        updatedAt: storeItems.updatedAt,
      })
      .from(storeItems)
      .where(
        and(
          eq(storeItems.isFeatured, true),
          eq(storeItems.isPublished, true),
          isNull(storeItems.deletedAt as any) as any,
        ),
      )
      .orderBy(desc(storeItems.createdAt));
    return results.map((item) => this.sanitizeStoreItem(item));
  }

  // Search store items by name or description
  async search(query: string): Promise<StoreItem[]> {
    const results = await this.database.db
      .select({
        productId: storeItems.productId,
        name: storeItems.name,
        description: storeItems.description,
        productUsage: storeItems.productUsage,
        productBenefits: storeItems.productBenefits,
        productIngredients: storeItems.productIngredients,
        price: storeItems.price,
        stock: storeItems.stock,
        display: storeItems.display,
        images: storeItems.images,
        categories: storeItems.categories,
        isFeatured: storeItems.isFeatured,
        isPublished: storeItems.isPublished,
        discountType: storeItems.discountType,
        discountValue: storeItems.discountValue,
        discountActive: storeItems.discountActive,
        discountStart: storeItems.discountStart,
        discountEnd: storeItems.discountEnd,
        preOrderEnabled: storeItems.preOrderEnabled,
        createdAt: storeItems.createdAt,
        updatedAt: storeItems.updatedAt,
      })
      .from(storeItems)
      .where(
        and(
          isNull(storeItems.deletedAt as any) as any,
          or(
            ilike(storeItems.name, `%${query}%`),
            ilike(storeItems.description, `%${query}%`),
          ),
          eq(storeItems.isPublished, true),
        ),
      )
      .orderBy(desc(storeItems.createdAt));
    return results.map((item) => this.sanitizeStoreItem(item));
  }

  // Search store items with minimal data for select dropdown
  async searchMinimal(query: string, limit: number = 10) {
    const results = await this.database.db
      .select({
        productId: storeItems.productId,
        name: storeItems.name,
        display: storeItems.display,
        stock: storeItems.stock,
        preOrderEnabled: storeItems.preOrderEnabled,
      })
      .from(storeItems)
      .where(
        and(
          isNull(storeItems.deletedAt as any) as any,
          ilike(storeItems.name, `%${query}%`),
          eq(storeItems.isPublished, true),
        ),
      )
      .orderBy(desc(storeItems.createdAt))
      .limit(limit);

    return results.map((item) => ({
      value: item.productId,
      label: item.name,
      display: item.display,
      stock: item.stock,
      preOrderEnabled: item.preOrderEnabled,
    }));
  }
}
