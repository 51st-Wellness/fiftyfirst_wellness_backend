import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { eq, and, gt, desc, count, like, or, SQL } from 'drizzle-orm';
import {
  subscriptions,
  subscriptionPlans,
  subscriptionAccess,
  users,
  payments,
  PaymentStatus,
} from 'src/database/schema';
import { generateId } from 'src/database/utils';
import { Subscription, SubscriptionPlan } from 'src/database/types';

@Injectable()
export class SubscriptionService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Helper method to perform case-insensitive search with Drizzle
   */
  private async performCaseInsensitiveSearch(
    searchTerm: string,
  ): Promise<string[]> {
    const searchPattern = `%${searchTerm}%`;

    // Search in user names and emails
    const userMatches = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(
        or(
          like(users.firstName, searchPattern),
          like(users.lastName, searchPattern),
          like(users.email, searchPattern),
        ),
      );

    // Search in subscription plan names
    const planMatches = await this.database.db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(like(subscriptionPlans.name, searchPattern));

    // Get subscription IDs for matching users or plans
    const userIds = userMatches.map((u) => u.id);
    const planIds = planMatches.map((p) => p.id);

    let subscriptionIds: string[] = [];

    if (userIds.length > 0) {
      const userSubscriptions = await this.database.db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(or(...userIds.map((id) => eq(subscriptions.userId, id))));
      subscriptionIds.push(...userSubscriptions.map((s) => s.id));
    }

    if (planIds.length > 0) {
      const planSubscriptions = await this.database.db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(or(...planIds.map((id) => eq(subscriptions.planId, id))));
      subscriptionIds.push(...planSubscriptions.map((s) => s.id));
    }

    return [...new Set(subscriptionIds)];
  }

  // Subscription CRUD Operations
  async createSubscription(
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<any> {
    const { userId, planId, startDate, endDate, ...rest } =
      createSubscriptionDto;

    // Verify user exists
    const user = (
      await this.database.db.select().from(users).where(eq(users.id, userId))
    )[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify plan exists and is active
    const plan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
    )[0];
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    if (!plan.isActive) {
      throw new BadRequestException(
        'Cannot create subscription for inactive plan',
      );
    }

    // Check for existing active subscription
    const existingSubscription = (
      await this.database.db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, PaymentStatus.PAID),
            gt(subscriptions.endDate, new Date()),
          ),
        )
    )[0];

    if (existingSubscription) {
      throw new BadRequestException('User already has an active subscription');
    }

    // Create subscription
    const subscription = (
      await this.database.db
        .insert(subscriptions)
        .values({
          id: generateId(),
          ...rest,
          userId,
          planId,
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: new Date(endDate),
        })
        .returning()
    )[0];

    // Get related data for response
    const userData = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId));

    const payment = subscription.paymentId
      ? await this.database.db
          .select()
          .from(payments)
          .where(eq(payments.id, subscription.paymentId))
      : null;

    return {
      ...subscription,
      user: userData[0],
      plan,
      payment: payment?.[0] || null,
    };
  }

  async activateSubscriptionByPayment(subscriptionId: string) {
    // Activate subscription after successful payment
    const subscription = (
      await this.database.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
    )[0];

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === PaymentStatus.PAID) {
      // Get enriched subscription data
      const plan = (
        await this.database.db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.id, subscription.planId))
      )[0];

      const payment = subscription.paymentId
        ? (
            await this.database.db
              .select()
              .from(payments)
              .where(eq(payments.id, subscription.paymentId))
          )[0]
        : null;

      const user = (
        await this.database.db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(eq(users.id, subscription.userId))
      )[0];

      return {
        ...subscription,
        plan,
        payment,
        user,
      };
    }

    // Update subscription status to PAID
    const updatedSubscription = (
      await this.database.db
        .update(subscriptions)
        .set({ status: PaymentStatus.PAID })
        .where(eq(subscriptions.id, subscriptionId))
        .returning()
    )[0];

    // Get related data
    const plan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, updatedSubscription.planId))
    )[0];

    const payment = updatedSubscription.paymentId
      ? (
          await this.database.db
            .select()
            .from(payments)
            .where(eq(payments.id, updatedSubscription.paymentId))
        )[0]
      : null;

    const user = (
      await this.database.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, updatedSubscription.userId))
    )[0];

    return {
      ...updatedSubscription,
      plan,
      payment,
      user,
    };
  }

  async findAllSubscriptions(query: SubscriptionQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      userId,
      planId,
      status,
      autoRenew,
    } = query;
    const skip = (page - 1) * limit;

    // Build conditions
    const conditions: SQL[] = [];

    if (userId) conditions.push(eq(subscriptions.userId, userId));
    if (planId) conditions.push(eq(subscriptions.planId, planId));
    if (status) conditions.push(eq(subscriptions.status, status));
    if (autoRenew !== undefined)
      conditions.push(eq(subscriptions.autoRenew, autoRenew));

    let subscriptionQuery = this.database.db
      .select()
      .from(subscriptions)
      .$dynamic();

    let countQuery = this.database.db
      .select({ count: count() })
      .from(subscriptions)
      .$dynamic();

    if (search) {
      const searchResults = await this.performCaseInsensitiveSearch(search);
      if (searchResults.length > 0) {
        conditions.push(
          or(...searchResults.map((id) => eq(subscriptions.id, id))),
        );
      } else {
        return {
          data: [],
          pagination: {
            page,
            pageSize: limit,
            total: 0,
            totalPages: 0,
          },
        };
      }
    }

    if (conditions.length > 0) {
      const whereClause = and(...conditions);
      subscriptionQuery = subscriptionQuery.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }

    const [subscriptionResults, totalResults] = await Promise.all([
      subscriptionQuery
        .orderBy(desc(subscriptions.startDate))
        .offset(skip)
        .limit(limit),
      countQuery,
    ]);

    // Enrich with related data
    const enrichedSubscriptions = [];
    for (const subscription of subscriptionResults) {
      const user = (
        await this.database.db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(eq(users.id, subscription.userId))
      )[0];

      const plan = (
        await this.database.db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.id, subscription.planId))
      )[0];

      enrichedSubscriptions.push({
        ...subscription,
        user,
        plan,
      });
    }

    return {
      data: enrichedSubscriptions,
      pagination: {
        page,
        pageSize: limit,
        total: totalResults[0].count,
        totalPages: Math.ceil(totalResults[0].count / limit),
      },
    };
  }

  async findOneSubscription(id: string): Promise<any> {
    const subscription = (
      await this.database.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
    )[0];

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const user = (
      await this.database.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, subscription.userId))
    )[0];

    const plan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, subscription.planId))
    )[0];

    return {
      ...subscription,
      user,
      plan,
    };
  }

  async updateSubscription(
    id: string,
    updateSubscriptionDto: UpdateSubscriptionDto,
  ): Promise<any> {
    const existingSubscription = (
      await this.database.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
    )[0];

    if (!existingSubscription) {
      throw new NotFoundException('Subscription not found');
    }

    const { startDate, endDate, ...rest } = updateSubscriptionDto;

    const updatedSubscription = (
      await this.database.db
        .update(subscriptions)
        .set({
          ...rest,
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
        })
        .where(eq(subscriptions.id, id))
        .returning()
    )[0];

    const user = (
      await this.database.db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, updatedSubscription.userId))
    )[0];

    const plan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, updatedSubscription.planId))
    )[0];

    return {
      ...updatedSubscription,
      user,
      plan,
    };
  }

  async removeSubscription(id: string): Promise<void> {
    const subscription = (
      await this.database.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
    )[0];

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    await this.database.db
      .delete(subscriptions)
      .where(eq(subscriptions.id, id));
  }

  // Subscription Plan CRUD Operations
  async createSubscriptionPlan(
    createPlanDto: CreateSubscriptionPlanDto,
  ): Promise<any> {
    const { accessItems, ...planData } = createPlanDto;

    const plan = (
      await this.database.db
        .insert(subscriptionPlans)
        .values({
          id: generateId(),
          ...planData,
        })
        .returning()
    )[0];

    // Create subscription access items if provided
    if (accessItems && accessItems.length > 0) {
      await this.database.db.insert(subscriptionAccess).values(
        accessItems.map((accessItem) => ({
          id: generateId(),
          planId: plan.id,
          accessItem,
        })),
      );
    }

    const subscriptionAccessList = await this.database.db
      .select()
      .from(subscriptionAccess)
      .where(eq(subscriptionAccess.planId, plan.id));

    return {
      ...plan,
      subscriptionAccess: subscriptionAccessList,
    };
  }

  async findAllSubscriptionPlans() {
    const plans = await this.database.db
      .select()
      .from(subscriptionPlans)
      .orderBy(desc(subscriptionPlans.createdAt));

    const enrichedPlans = [];
    for (const plan of plans) {
      const subscriptionAccessList = await this.database.db
        .select()
        .from(subscriptionAccess)
        .where(eq(subscriptionAccess.planId, plan.id));

      const subscriptionCount = (
        await this.database.db
          .select({ count: count() })
          .from(subscriptions)
          .where(eq(subscriptions.planId, plan.id))
      )[0].count;

      enrichedPlans.push({
        ...plan,
        subscriptionAccess: subscriptionAccessList,
        _count: {
          subscriptions: subscriptionCount,
        },
      });
    }

    return enrichedPlans;
  }

  async findOneSubscriptionPlan(id: string): Promise<any> {
    const plan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, id))
    )[0];

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const subscriptionAccessList = await this.database.db
      .select()
      .from(subscriptionAccess)
      .where(eq(subscriptionAccess.planId, id));

    const subscriptionCount = (
      await this.database.db
        .select({ count: count() })
        .from(subscriptions)
        .where(eq(subscriptions.planId, id))
    )[0].count;

    return {
      ...plan,
      subscriptionAccess: subscriptionAccessList,
      _count: {
        subscriptions: subscriptionCount,
      },
    };
  }

  async updateSubscriptionPlan(
    id: string,
    updatePlanDto: UpdateSubscriptionPlanDto,
  ): Promise<any> {
    const existingPlan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, id))
    )[0];

    if (!existingPlan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const { accessItems, ...planData } = updatePlanDto;

    // Update plan data
    await this.database.db
      .update(subscriptionPlans)
      .set(planData)
      .where(eq(subscriptionPlans.id, id));

    // Update access items if provided
    if (accessItems !== undefined) {
      // Remove existing access items
      await this.database.db
        .delete(subscriptionAccess)
        .where(eq(subscriptionAccess.planId, id));

      // Add new access items
      if (accessItems.length > 0) {
        await this.database.db.insert(subscriptionAccess).values(
          accessItems.map((accessItem) => ({
            id: generateId(),
            planId: id,
            accessItem,
          })),
        );
      }
    }

    const updatedPlan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, id))
    )[0];

    if (!updatedPlan) {
      throw new NotFoundException('Failed to update subscription plan');
    }

    const subscriptionAccessList = await this.database.db
      .select()
      .from(subscriptionAccess)
      .where(eq(subscriptionAccess.planId, id));

    const subscriptionCount = (
      await this.database.db
        .select({ count: count() })
        .from(subscriptions)
        .where(eq(subscriptions.planId, id))
    )[0].count;

    return {
      ...updatedPlan,
      subscriptionAccess: subscriptionAccessList,
      _count: {
        subscriptions: subscriptionCount,
      },
    };
  }

  async removeSubscriptionPlan(id: string): Promise<void> {
    const plan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, id))
    )[0];

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const subscriptionCount = (
      await this.database.db
        .select({ count: count() })
        .from(subscriptions)
        .where(eq(subscriptions.planId, id))
    )[0].count;

    if (subscriptionCount > 0) {
      throw new BadRequestException(
        'Cannot delete subscription plan with active subscriptions',
      );
    }

    // Delete access items first
    await this.database.db
      .delete(subscriptionAccess)
      .where(eq(subscriptionAccess.planId, id));

    // Delete the plan
    await this.database.db
      .delete(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id));
  }

  // Utility methods
  async getSubscriptionStats() {
    const [
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      pendingSubscriptions,
      totalPlans,
      activePlans,
    ] = await Promise.all([
      this.database.db.select({ count: count() }).from(subscriptions),
      this.database.db
        .select({ count: count() })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, PaymentStatus.PAID),
            gt(subscriptions.endDate, new Date()),
          ),
        ),
      this.database.db
        .select({ count: count() })
        .from(subscriptions)
        .where(eq(subscriptions.endDate, new Date())), // This needs to be lte for proper expired check
      this.database.db
        .select({ count: count() })
        .from(subscriptions)
        .where(eq(subscriptions.status, PaymentStatus.PENDING)),
      this.database.db.select({ count: count() }).from(subscriptionPlans),
      this.database.db
        .select({ count: count() })
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true)),
    ]);

    return {
      totalSubscriptions: totalSubscriptions[0].count,
      activeSubscriptions: activeSubscriptions[0].count,
      expiredSubscriptions: expiredSubscriptions[0].count,
      pendingSubscriptions: pendingSubscriptions[0].count,
      totalPlans: totalPlans[0].count,
      activePlans: activePlans[0].count,
    };
  }

  async getUserActiveSubscription(userId: string) {
    // Get user's current active subscription
    const subscription = (
      await this.database.db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, PaymentStatus.PAID),
            gt(subscriptions.endDate, new Date()),
          ),
        )
        .orderBy(desc(subscriptions.endDate))
    )[0];

    if (!subscription) {
      return null;
    }

    const plan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, subscription.planId))
    )[0];

    const subscriptionAccessList = await this.database.db
      .select()
      .from(subscriptionAccess)
      .where(eq(subscriptionAccess.planId, subscription.planId));

    const payment = subscription.paymentId
      ? (
          await this.database.db
            .select()
            .from(payments)
            .where(eq(payments.id, subscription.paymentId))
        )[0]
      : null;

    return {
      ...subscription,
      plan: {
        ...plan,
        subscriptionAccess: subscriptionAccessList,
      },
      payment,
    };
  }

  async hasUserAccessToItem(userId: string, accessItem: string) {
    // Check if user has access to specific content based on subscription
    const activeSubscription = await this.getUserActiveSubscription(userId);

    if (!activeSubscription) {
      return false;
    }

    // Check if the subscription plan includes the requested access
    const hasAccess = activeSubscription.plan.subscriptionAccess.some(
      (access) =>
        access.accessItem === accessItem || access.accessItem === 'ALL_ACCESS',
    );

    return hasAccess;
  }
}
