import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { eq, like, or, and, count, desc, SQL } from 'drizzle-orm';
import {
  users,
  passwordResetOTPs,
  orders,
  aiConversations,
} from 'src/database/schema';
import { User, NewUser, UserWithRelations } from 'src/database/types';
import { generateId } from 'src/database/utils';

@Injectable()
export class UserRepository {
  constructor(private readonly database: DatabaseService) {}

  // Create a new user
  async create(
    data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<User> {
    const newUser: NewUser = {
      id: generateId(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.database.db
      .insert(users)
      .values(newUser)
      .returning();
    return result[0];
  }

  // Find user by ID
  async findById(id: string): Promise<User | null> {
    const result = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, id));
    return result[0] || null;
  }

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return result[0] || null;
  }

  // Find user by Google ID
  async findByGoogleId(googleId: string): Promise<User | null> {
    const result = await this.database.db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId));
    return result[0] || null;
  }

  // Find all users with optional pagination
  async findAll(skip?: number, take?: number): Promise<User[]> {
    let query = this.database.db.select().from(users).$dynamic();

    if (skip !== undefined) {
      query = query.offset(skip);
    }

    if (take !== undefined) {
      query = query.limit(take);
    }

    return await query.orderBy(desc(users.createdAt));
  }

  // Update user by ID
  async update(
    id: string,
    data: Partial<Omit<NewUser, 'id' | 'createdAt'>>,
  ): Promise<User> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };

    const result = await this.database.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // Delete user by ID
  async delete(id: string): Promise<User> {
    const result = await this.database.db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // Find user by ID with related data
  async findByIdWithRelations(id: string): Promise<UserWithRelations | null> {
    const user = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, id));

    if (user.length === 0) {
      return null;
    }

    const userOrders = await this.database.db
      .select()
      .from(orders)
      .where(eq(orders.userId, id));
    const userConversations = await this.database.db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.userId, id));

    return {
      ...user[0],
      orders: userOrders,
      aiConversations: userConversations,
    };
  }

  // Store password reset OTP (upsert to handle existing OTP)
  async storePasswordResetOTP(
    userId: string,
    otp: string,
    expiresAt: Date,
  ): Promise<void> {
    // Check if OTP exists
    const existing = await this.database.db
      .select()
      .from(passwordResetOTPs)
      .where(eq(passwordResetOTPs.userId, userId));

    if (existing.length > 0) {
      // Update existing OTP
      await this.database.db
        .update(passwordResetOTPs)
        .set({ otp, expiresAt })
        .where(eq(passwordResetOTPs.userId, userId));
    } else {
      // Create new OTP
      await this.database.db.insert(passwordResetOTPs).values({
        id: generateId(),
        userId,
        otp,
        expiresAt,
        createdAt: new Date(),
      });
    }
  }

  // Verify password reset OTP
  async verifyPasswordResetOTP(userId: string, otp: string): Promise<boolean> {
    const otpRecord = await this.database.db
      .select()
      .from(passwordResetOTPs)
      .where(eq(passwordResetOTPs.userId, userId));

    if (otpRecord.length === 0) {
      return false;
    }

    // Check if OTP matches and hasn't expired
    const isValid =
      otpRecord[0].otp === otp && otpRecord[0].expiresAt > new Date();
    return isValid;
  }

  // Reset password and clear OTP
  async resetPassword(userId: string, hashedPassword: string): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      // Update password
      await tx
        .update(users)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(users.id, userId));

      // Delete the OTP record
      await tx
        .delete(passwordResetOTPs)
        .where(eq(passwordResetOTPs.userId, userId));
    });
  }

  // Find users with pagination and filters
  async findManyWithFilters(
    page: number = 1,
    pageSize: number = 10,
    filters: {
      search?: string;
      role?: string;
      isActive?: boolean;
    } = {},
  ): Promise<{ users: User[]; total: number }> {
    const skip = (page - 1) * pageSize;

    // Build where conditions
    const conditions: SQL[] = [];

    // Apply filters
    if (filters.role) {
      conditions.push(eq(users.role, filters.role as any));
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(users.isActive, filters.isActive));
    }

    if (filters.search) {
      const searchCondition = or(
        like(users.email, `%${filters.search}%`),
        like(users.firstName, `%${filters.search}%`),
        like(users.lastName, `%${filters.search}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Build queries step by step using dynamic query builders
    let userQuery = this.database.db.select().from(users).$dynamic();
    let countQuery = this.database.db
      .select({ count: count() })
      .from(users)
      .$dynamic();

    if (conditions.length > 0) {
      const whereClause = and(...conditions);
      userQuery = userQuery.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }

    userQuery = userQuery
      .orderBy(desc(users.createdAt))
      .offset(skip)
      .limit(pageSize);

    // Execute queries in parallel
    const [userResults, totalResults] = await Promise.all([
      userQuery,
      countQuery,
    ]);

    return {
      users: userResults,
      total: totalResults[0].count,
    };
  }

  // Toggle user active status
  async toggleUserStatus(userId: string, isActive: boolean): Promise<User> {
    const result = await this.database.db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }
}
