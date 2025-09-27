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
import { eq, and, gte, lte } from 'drizzle-orm';

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

    // Find active subscriptions for the user
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
      );

    // Check if any active subscription provides the required access
    for (const subscription of activeSubscriptions) {
      const plan = (
        await this.database.db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.id, subscription.planId))
      )[0];

      if (plan) {
        const planAccess = await this.database.db
          .select()
          .from(subscriptionAccess)
          .where(eq(subscriptionAccess.planId, plan.id));

        const hasRequiredAccess = planAccess.some(
          (access) =>
            access.accessItem === requiredAccess ||
            access.accessItem === AccessItem.ALL_ACCESS,
        );

        if (hasRequiredAccess) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Generates a signed Mux playback token for secure content access
   */
  protected async generateSignedPlaybackToken(
    playbackId: string,
    userId: string,
  ): Promise<string> {
    try {
      // Generate signed playback token with 5 hours expiry
      const expirationTime = Math.floor(Date.now() / 1000) + 5 * 60 * 60; // 5 hours from now

      const token = await this.muxClient.jwt.signPlaybackId(playbackId, {
        keyId: this.configService.get(ENV.MUX_SIGNING_KEY_ID),
        keySecret: this.configService.get(ENV.MUX_SIGNING_KEY_PRIVATE),
        expiration: expirationTime.toString(),
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


