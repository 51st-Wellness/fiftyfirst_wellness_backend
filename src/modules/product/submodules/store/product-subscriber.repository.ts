import { Injectable } from '@nestjs/common';
import { eq, and, desc, sql, SQL } from 'drizzle-orm';
import { DatabaseService } from '@/database/database.service';
import {
  productSubscribers,
  users,
  storeItems,
  ProductSubscriberStatus,
} from '@/database/schema';
import { generateId } from '@/database/utils';

@Injectable()
export class ProductSubscriberRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(userId: string, productId: string) {
    const id = generateId();
    const [subscriber] = await this.database.db
      .insert(productSubscribers)
      .values({
        id,
        userId,
        productId,
        status: ProductSubscriberStatus.PENDING,
      })
      .returning();

    return subscriber;
  }

  async findOne(id: string) {
    const [subscriber] = await this.database.db
      .select({
        id: productSubscribers.id,
        userId: productSubscribers.userId,
        productId: productSubscribers.productId,
        status: productSubscribers.status,
        createdAt: productSubscribers.createdAt,
        updatedAt: productSubscribers.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        product: {
          id: storeItems.productId,
          name: storeItems.name,
        },
      })
      .from(productSubscribers)
      .leftJoin(users, eq(productSubscribers.userId, users.id))
      .leftJoin(
        storeItems,
        eq(productSubscribers.productId, storeItems.productId),
      )
      .where(eq(productSubscribers.id, id))
      .limit(1);

    return subscriber;
  }

  async findByUserAndProduct(userId: string, productId: string) {
    const [subscriber] = await this.database.db
      .select()
      .from(productSubscribers)
      .where(
        and(
          eq(productSubscribers.userId, userId),
          eq(productSubscribers.productId, productId),
        ),
      )
      .limit(1);

    return subscriber;
  }

  async findByProduct(productId: string) {
    return await this.database.db
      .select({
        id: productSubscribers.id,
        userId: productSubscribers.userId,
        productId: productSubscribers.productId,
        status: productSubscribers.status,
        createdAt: productSubscribers.createdAt,
        updatedAt: productSubscribers.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(productSubscribers)
      .leftJoin(users, eq(productSubscribers.userId, users.id))
      .where(eq(productSubscribers.productId, productId))
      .orderBy(desc(productSubscribers.createdAt));
  }

  async findAll(filters: {
    productId?: string;
    userId?: string;
    status?: keyof typeof ProductSubscriberStatus;
    page?: number;
    limit?: number;
  }) {
    const { productId, userId, status, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions: SQL<unknown>[] = [];
    if (productId) conditions.push(eq(productSubscribers.productId, productId));
    if (userId) conditions.push(eq(productSubscribers.userId, userId));
    if (status) conditions.push(eq(productSubscribers.status, status));

    const whereClause =
      conditions.length > 0
        ? and(...(conditions as [SQL<unknown>]))
        : undefined;

    const [items, [{ count }]] = await Promise.all([
      this.database.db
        .select({
          id: productSubscribers.id,
          userId: productSubscribers.userId,
          productId: productSubscribers.productId,
          status: productSubscribers.status,
          createdAt: productSubscribers.createdAt,
          updatedAt: productSubscribers.updatedAt,
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          },
          product: {
            id: storeItems.productId,
            name: storeItems.name,
            display: storeItems.display,
          },
        })
        .from(productSubscribers)
        .leftJoin(users, eq(productSubscribers.userId, users.id))
        .leftJoin(
          storeItems,
          eq(productSubscribers.productId, storeItems.productId),
        )
        .where(whereClause)
        .orderBy(desc(productSubscribers.createdAt))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(productSubscribers)
        .where(whereClause),
    ]);

    return {
      items,
      pagination: {
        total: Number(count),
        page,
        pageSize: limit,
        totalPages: Math.ceil(Number(count) / limit),
        hasMore: page * limit < Number(count),
      },
    };
  }

  async update(
    id: string,
    data: { status?: keyof typeof ProductSubscriberStatus },
  ) {
    const [updated] = await this.database.db
      .update(productSubscribers)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(productSubscribers.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    const [deleted] = await this.database.db
      .delete(productSubscribers)
      .where(eq(productSubscribers.id, id))
      .returning();

    return deleted;
  }

  async deleteByUserAndProduct(userId: string, productId: string) {
    const [deleted] = await this.database.db
      .delete(productSubscribers)
      .where(
        and(
          eq(productSubscribers.userId, userId),
          eq(productSubscribers.productId, productId),
        ),
      )
      .returning();

    return deleted;
  }
}
