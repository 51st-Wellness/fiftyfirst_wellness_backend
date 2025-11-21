import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { eq, desc, like, or, and, count, SQL, sql } from 'drizzle-orm';
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
    try {
      // Use Drizzle select with custom SQL for productIngredients to handle invalid JSON
      const result = await this.database.db
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
          preOrderStart: storeItems.preOrderStart,
          preOrderEnd: storeItems.preOrderEnd,
          preOrderFulfillmentDate: storeItems.preOrderFulfillmentDate,
          preOrderDepositRequired: storeItems.preOrderDepositRequired,
          preOrderDepositAmount: storeItems.preOrderDepositAmount,
          reservedPreOrderQuantity: storeItems.reservedPreOrderQuantity,
          createdAt: storeItems.createdAt,
          updatedAt: storeItems.updatedAt,
        })
        .from(storeItems)
        .where(eq(storeItems.productId, id))
        .limit(1);

      if (result[0]) {
        return this.sanitizeStoreItem(result[0]);
      }
      return null;
    } catch (error: any) {
      console.error('Error finding store item by ID:', error);
      throw error;
    }
  }

  // Sanitize store item to ensure JSON fields are valid
  private sanitizeStoreItem(item: any): StoreItem {
    // Ensure productIngredients is valid JSON or null
    if (
      item.productIngredients !== null &&
      item.productIngredients !== undefined
    ) {
      if (typeof item.productIngredients === 'string') {
        try {
          item.productIngredients = JSON.parse(item.productIngredients);
        } catch {
          item.productIngredients = null;
        }
      }
    } else {
      item.productIngredients = null;
    }
    return item as StoreItem;
  }

  // Find all store items with pagination and filters
  async findAll(
    skip?: number,
    take?: number,
    filters?: {
      isPublished?: boolean;
      isFeatured?: boolean;
      search?: string;
      category?: string;
    },
  ): Promise<StoreItem[]> {
    try {
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
      if (filters?.category) {
        conditions.push(like(storeItems.categories, `%${filters.category}%`));
      }

      // Build query with custom SQL for productIngredients to handle invalid JSON
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
          preOrderStart: storeItems.preOrderStart,
          preOrderEnd: storeItems.preOrderEnd,
          preOrderFulfillmentDate: storeItems.preOrderFulfillmentDate,
          preOrderDepositRequired: storeItems.preOrderDepositRequired,
          preOrderDepositAmount: storeItems.preOrderDepositAmount,
          reservedPreOrderQuantity: storeItems.reservedPreOrderQuantity,
          createdAt: storeItems.createdAt,
          updatedAt: storeItems.updatedAt,
        })
        .from(storeItems)
        .$dynamic();

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      if (skip !== undefined) {
        query = query.offset(skip);
      }

      if (take !== undefined) {
        query = query.limit(take);
      }

      const results = await query.orderBy(desc(storeItems.createdAt));
      return results.map((item) => this.sanitizeStoreItem(item));
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
    if (filters?.category) {
      conditions.push(like(storeItems.categories, `%${filters.category}%`));
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
    const results = await this.database.db
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
        preOrderStart: storeItems.preOrderStart,
        preOrderEnd: storeItems.preOrderEnd,
        preOrderFulfillmentDate: storeItems.preOrderFulfillmentDate,
        preOrderDepositRequired: storeItems.preOrderDepositRequired,
        preOrderDepositAmount: storeItems.preOrderDepositAmount,
        reservedPreOrderQuantity: storeItems.reservedPreOrderQuantity,
        createdAt: storeItems.createdAt,
        updatedAt: storeItems.updatedAt,
      })
      .from(storeItems)
      .where(
        and(eq(storeItems.isFeatured, true), eq(storeItems.isPublished, true)),
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
        preOrderStart: storeItems.preOrderStart,
        preOrderEnd: storeItems.preOrderEnd,
        preOrderFulfillmentDate: storeItems.preOrderFulfillmentDate,
        preOrderDepositRequired: storeItems.preOrderDepositRequired,
        preOrderDepositAmount: storeItems.preOrderDepositAmount,
        reservedPreOrderQuantity: storeItems.reservedPreOrderQuantity,
        createdAt: storeItems.createdAt,
        updatedAt: storeItems.updatedAt,
      })
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
          like(storeItems.name, `%${query}%`),
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
