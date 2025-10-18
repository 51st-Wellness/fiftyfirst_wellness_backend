import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ConfigService } from '@nestjs/config';
import Mux from '@mux/mux-node';
import { ENV } from 'src/config/env.enum';
import { AccessItem, PaymentStatus } from 'src/database/schema';
import { User } from 'src/database/types';
import {
  subscriptions,
  subscriptionPlans,
  subscriptionAccess,
} from 'src/database/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

@Injectable()
export abstract class BaseProductService {
  protected muxClient: Mux;

  constructor(
    protected database: DatabaseService,
    protected configService: ConfigService,
  ) {
    // Initialize Mux client with credentials
    const tokenId = this.configService.get(ENV.MUX_TOKEN_ID);
    const tokenSecret = this.configService.get(ENV.MUX_TOKEN_SECRET);

    console.log('Mux Token ID exists:', !!tokenId);
    console.log('Mux Token Secret exists:', !!tokenSecret);

    this.muxClient = new Mux({
      tokenId,
      tokenSecret,
    });
  }

  /**
   * Checks if user has active subscription for accessing content
   */
  protected async hasActiveSubscription(
    userId: string,
    requiredAccess: AccessItem,
  ): Promise<boolean> {
    const now = new Date();

    // Get ALL active subscriptions for the user (not just latest by creation)
    const activeSubscriptions = await this.database.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, PaymentStatus.PAID),
          lte(subscriptions.startDate, now),
          gte(subscriptions.endDate, now),
        ),
      )
      .orderBy(desc(subscriptions.endDate)); // Order by end date to get the longest running subscription first

    // Check if user has any active subscription
    if (!activeSubscriptions || activeSubscriptions.length === 0) {
      return false;
    }

    // Check each active subscription to see if any provides the required access
    for (const subscription of activeSubscriptions) {
      // Get the subscription plan
      const plan = (
        await this.database.db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.id, subscription.planId))
      )[0];

      if (!plan || !plan.isActive) {
        continue; // Skip inactive plans
      }

      // Get plan access permissions
      const planAccess = await this.database.db
        .select()
        .from(subscriptionAccess)
        .where(eq(subscriptionAccess.planId, plan.id));

      // Check if this plan provides the required access
      const hasRequiredAccess = planAccess.some(
        (access) =>
          access.accessItem === requiredAccess ||
          access.accessItem === AccessItem.ALL_ACCESS,
      );

      if (hasRequiredAccess) {
        console.log('User has active subscription with required access', {
          userId,
          requiredAccess,
          plan: plan.name,
          planAccess: planAccess.map((access) => access.accessItem),
        });
        return true; // Found an active subscription with required access
      }
    }

    return false; // No active subscription provides the required access
  }

  /**
   * Get subscription history for a user (for debugging/admin purposes)
   */
  protected async getUserSubscriptionHistory(userId: string) {
    return await this.database.db
      .select({
        id: subscriptions.id,
        planId: subscriptions.planId,
        status: subscriptions.status,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        billingCycle: subscriptions.billingCycle,
        createdAt: subscriptions.createdAt,
        planName: subscriptionPlans.name,
      })
      .from(subscriptions)
      .leftJoin(
        subscriptionPlans,
        eq(subscriptions.planId, subscriptionPlans.id),
      )
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  /**
   * Generates a signed Mux playback token for secure content access
   */
  protected async generateSignedPlaybackToken(
    playbackId: string,
    userId: string,
  ): Promise<string> {
    try {
      // Generate signed playback token with 5 hours expiry (expiration as number, not string)
      const expirationTime = Math.floor(Date.now() / 1000) + 5 * 60 * 60; // 5 hours from now, in Unix timestamp seconds

      const token = await this.muxClient.jwt.signPlaybackId(playbackId, {
        keyId: this.configService.get(ENV.MUX_SIGNING_KEY_ID),
        keySecret: this.configService.get(ENV.MUX_SIGNING_KEY_PRIVATE),
        expiration: expirationTime as any, // pass as number (Unix timestamp)
        params: {
          user_id: userId,
        },
      });

      return token;
    } catch (error) {
      console.error('Failed to generate signed playback token:', error);
      throw new BadRequestException('Failed to generate secure content token');
    }
  }
}
