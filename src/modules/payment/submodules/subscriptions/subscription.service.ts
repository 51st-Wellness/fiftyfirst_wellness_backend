import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { Subscription, SubscriptionPlan, Prisma } from '@prisma/client';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper method to perform case-insensitive search using SQLite COLLATE NOCASE
   * This is necessary because SQLite doesn't support case-insensitive string comparison natively
   */
  private async performCaseInsensitiveSearch(
    table: string,
    searchFields: string[],
    searchTerm: string,
    additionalWhere?: string,
  ): Promise<string[]> {
    const searchPattern = `%${searchTerm}%`;
    const whereConditions = searchFields
      .map((field) => `${field} COLLATE NOCASE LIKE ?`)
      .join(' OR ');

    const additionalCondition = additionalWhere
      ? ` AND (${additionalWhere})`
      : '';

    const query = `
      SELECT id 
      FROM ${table} 
      WHERE (${whereConditions})${additionalCondition}
    `;

    // Create array of parameters (searchPattern for each field)
    const params = searchFields.map(() => searchPattern);

    const results = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      query,
      ...params,
    );
    return results.map((result) => result.id);
  }

  // Subscription CRUD Operations
  async createSubscription(
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    const { userId, planId, startDate, endDate, ...rest } =
      createSubscriptionDto;

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify plan exists and is active
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    if (!plan.isActive) {
      throw new BadRequestException(
        'Cannot create subscription for inactive plan',
      );
    }

    // Check for existing active subscription
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'PAID',
        endDate: {
          gt: new Date(),
        },
      },
    });

    if (existingSubscription) {
      throw new BadRequestException('User already has an active subscription');
    }

    return this.prisma.subscription.create({
      data: {
        ...rest,
        userId,
        planId,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: new Date(endDate),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        plan: true,
        payment: true,
      },
    });
  }

  async activateSubscriptionByPayment(subscriptionId: string) {
    // Activate subscription after successful payment
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, payment: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === 'PAID') {
      return subscription; // Already activated
    }

    // Update subscription status to PAID
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'PAID' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        plan: true,
        payment: true,
      },
    });
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

    const where: Prisma.SubscriptionWhereInput = {};

    if (search) {
      // Use raw SQL for case-insensitive search with SQLite
      const searchPattern = `%${search}%`;
      const searchResults = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT s.id 
        FROM Subscription s
        LEFT JOIN User u ON s.userId = u.id
        LEFT JOIN SubscriptionPlan sp ON s.planId = sp.id
        WHERE 
          u.firstName COLLATE NOCASE LIKE ${searchPattern} OR
          u.lastName COLLATE NOCASE LIKE ${searchPattern} OR
          u.email COLLATE NOCASE LIKE ${searchPattern} OR
          sp.name COLLATE NOCASE LIKE ${searchPattern}
      `;

      const subscriptionIds = searchResults.map((result) => result.id);
      if (subscriptionIds.length > 0) {
        where.id = { in: subscriptionIds };
      } else {
        // If no results found, return empty result
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

    if (userId) where.userId = userId;
    if (planId) where.planId = planId;
    if (status) where.status = status;
    if (autoRenew !== undefined) where.autoRenew = autoRenew;

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          plan: true,
        },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data: subscriptions,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneSubscription(id: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async updateSubscription(
    id: string,
    updateSubscriptionDto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    const existingSubscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!existingSubscription) {
      throw new NotFoundException('Subscription not found');
    }

    const { startDate, endDate, ...rest } = updateSubscriptionDto;

    return this.prisma.subscription.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        plan: true,
      },
    });
  }

  async removeSubscription(id: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.subscription.delete({
      where: { id },
    });
  }

  // Subscription Plan CRUD Operations
  async createSubscriptionPlan(
    createPlanDto: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const { accessItems, ...planData } = createPlanDto;

    const plan = await this.prisma.subscriptionPlan.create({
      data: planData,
    });

    // Create subscription access items if provided
    if (accessItems && accessItems.length > 0) {
      await this.prisma.subscriptionAccess.createMany({
        data: accessItems.map((accessItem) => ({
          planId: plan.id,
          accessItem,
        })),
      });
    }

    const createdPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: plan.id },
      include: {
        subscriptionAccess: true,
      },
    });

    if (!createdPlan) {
      throw new NotFoundException('Failed to create subscription plan');
    }

    return createdPlan;
  }

  async findAllSubscriptionPlans() {
    return this.prisma.subscriptionPlan.findMany({
      include: {
        subscriptionAccess: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneSubscriptionPlan(id: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        subscriptionAccess: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return plan;
  }

  async updateSubscriptionPlan(
    id: string,
    updatePlanDto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const existingPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const { accessItems, ...planData } = updatePlanDto;

    // Update plan data
    await this.prisma.subscriptionPlan.update({
      where: { id },
      data: planData,
    });

    // Update access items if provided
    if (accessItems !== undefined) {
      // Remove existing access items
      await this.prisma.subscriptionAccess.deleteMany({
        where: { planId: id },
      });

      // Add new access items
      if (accessItems.length > 0) {
        await this.prisma.subscriptionAccess.createMany({
          data: accessItems.map((accessItem) => ({
            planId: id,
            accessItem,
          })),
        });
      }
    }

    const updatedPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        subscriptionAccess: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!updatedPlan) {
      throw new NotFoundException('Failed to update subscription plan');
    }

    return updatedPlan;
  }

  async removeSubscriptionPlan(id: string): Promise<void> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (plan._count.subscriptions > 0) {
      throw new BadRequestException(
        'Cannot delete subscription plan with active subscriptions',
      );
    }

    // Delete access items first
    await this.prisma.subscriptionAccess.deleteMany({
      where: { planId: id },
    });

    // Delete the plan
    await this.prisma.subscriptionPlan.delete({
      where: { id },
    });
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
      this.prisma.subscription.count(),
      this.prisma.subscription.count({
        where: {
          status: 'PAID',
          endDate: { gt: new Date() },
        },
      }),
      this.prisma.subscription.count({
        where: {
          endDate: { lte: new Date() },
        },
      }),
      this.prisma.subscription.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.subscriptionPlan.count(),
      this.prisma.subscriptionPlan.count({
        where: { isActive: true },
      }),
    ]);

    return {
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      pendingSubscriptions,
      totalPlans,
      activePlans,
    };
  }

  async getUserActiveSubscription(userId: string) {
    // Get user's current active subscription
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'PAID',
        endDate: { gt: new Date() },
      },
      include: {
        plan: {
          include: { subscriptionAccess: true },
        },
        payment: true,
      },
      orderBy: { endDate: 'desc' },
    });
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
