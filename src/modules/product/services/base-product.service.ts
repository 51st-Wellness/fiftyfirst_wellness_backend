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

    // Get the latest subscription for the user (transaction history approach)
    const latestSubscription = (
      await this.database.db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1)
    )[0];

    // Check if user has any subscription
    if (!latestSubscription) {
      return false;
    }

    // Check if the latest subscription is active
    const isActive =
      latestSubscription.status === PaymentStatus.PAID &&
      latestSubscription.startDate <= now &&
      latestSubscription.endDate >= now;

    if (!isActive) {
      return false;
    }

    // Check if the subscription plan provides the required access
    const plan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, latestSubscription.planId))
    )[0];

    if (!plan) {
      return false;
    }

    const planAccess = await this.database.db
      .select()
      .from(subscriptionAccess)
      .where(eq(subscriptionAccess.planId, plan.id));

    const hasRequiredAccess = planAccess.some(
      (access) =>
        access.accessItem === requiredAccess ||
        access.accessItem === AccessItem.ALL_ACCESS,
    );

    return hasRequiredAccess;
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
