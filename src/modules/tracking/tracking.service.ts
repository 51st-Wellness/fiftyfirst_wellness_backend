import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { DatabaseService } from 'src/database/database.service';
import { orders, OrderStatus, users } from 'src/database/schema';
import { eq } from 'drizzle-orm';
import { RoyalMailService } from './royal-mail/royal-mail.service';
import { QUEUE_NAMES } from 'src/config/queues.config';
import { AddTrackingDto } from './dto/add-tracking.dto';
import { TrackingStatusDto } from './dto/tracking-response.dto';
import { RoyalMailTrackingStatus } from './royal-mail/royal-mail.types';
import { EventsEmitter } from 'src/util/events/events.emitter';
import { EmailType } from 'src/modules/notification/email/constants/email.enum';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly TRACKING_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor(
    @InjectQueue(QUEUE_NAMES.TRACKING)
    private readonly trackingQueue: Queue,
    private readonly database: DatabaseService,
    private readonly royalMailService: RoyalMailService,
    private readonly eventsEmitter: EventsEmitter,
  ) {}

  // Add or update tracking reference for an order
  async addTrackingReference(
    orderId: string,
    dto: AddTrackingDto,
  ): Promise<void> {
    const order = await this.database.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || order.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const existingOrder = order[0];

    // If there's an existing tracking job, remove it
    if (existingOrder.trackingJobId) {
      try {
        const existingJob = await this.trackingQueue.getJob(
          existingOrder.trackingJobId,
        );
        if (existingJob) {
          await existingJob.remove();
        }
      } catch (error) {
        this.logger.warn(
          `Failed to remove existing tracking job ${existingOrder.trackingJobId}:`,
          error,
        );
      }
    }

    // Fetch initial tracking status
    const trackingData = await this.royalMailService.getTrackingStatus(
      dto.trackingReference,
    );

    // Map Royal Mail status to OrderStatus
    const orderStatus = this.mapTrackingStatusToOrderStatus(
      trackingData.status,
    );

    // Create recurring job for tracking checks
    const job = await this.trackingQueue.add(
      'check-tracking',
      {
        orderId,
        trackingReference: dto.trackingReference,
      },
      {
        jobId: `tracking-${orderId}`,
        repeat: {
          every: this.TRACKING_INTERVAL, // Repeat every 24 hours
        },
      },
    );

    // Update order with tracking information
    await this.database.db
      .update(orders)
      .set({
        trackingReference: dto.trackingReference,
        trackingStatus: trackingData.status.toUpperCase(),
        trackingLastChecked: new Date(),
        trackingStatusUpdated: new Date(),
        trackingEvents: trackingData.events,
        trackingJobId: job.id,
        status: orderStatus,
      })
      .where(eq(orders.id, orderId));

    this.logger.log(
      `Tracking reference ${dto.trackingReference} added for order ${orderId}`,
    );
  }

  // Manually refresh tracking status
  async refreshTrackingStatus(
    orderId: string,
    userId?: string,
  ): Promise<TrackingStatusDto> {
    const order = await this.database.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || order.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const existingOrder = order[0];

    // Verify order ownership if userId is provided
    if (userId && existingOrder.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    if (!existingOrder.trackingReference) {
      throw new NotFoundException('No tracking reference found for this order');
    }

    // Fetch latest tracking status
    const trackingData = await this.royalMailService.getTrackingStatus(
      existingOrder.trackingReference,
    );

    const previousStatus = existingOrder.trackingStatus;
    const newStatus = trackingData.status.toUpperCase();
    const statusChanged = previousStatus !== newStatus;

    // Map Royal Mail status to OrderStatus
    const orderStatus = this.mapTrackingStatusToOrderStatus(
      trackingData.status,
    );

    // Update order with latest tracking information
    await this.database.db
      .update(orders)
      .set({
        trackingStatus: newStatus,
        trackingLastChecked: new Date(),
        trackingStatusUpdated: statusChanged
          ? new Date()
          : existingOrder.trackingStatusUpdated,
        trackingEvents: trackingData.events,
        status: orderStatus,
      })
      .where(eq(orders.id, orderId));

    // If status is final (delivered, etc.), stop the recurring job
    if (this.royalMailService.isFinalStatus(trackingData.status)) {
      await this.stopTrackingJob(orderId);
    }

    return {
      orderId: existingOrder.id,
      trackingReference: existingOrder.trackingReference,
      trackingStatus: trackingData.status,
      trackingLastChecked: new Date(),
      trackingStatusUpdated: statusChanged
        ? new Date()
        : existingOrder.trackingStatusUpdated,
      trackingEvents: trackingData.events,
      isTrackingActive: !this.royalMailService.isFinalStatus(
        trackingData.status,
      ),
    };
  }

  // Process tracking check job (called by consumer)
  async processTrackingCheck(job: Job): Promise<void> {
    const { orderId, trackingReference } = job.data;

    this.logger.log(
      `Processing tracking check for order ${orderId} with reference ${trackingReference}`,
    );

    try {
      const order = await this.database.db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order || order.length === 0) {
        this.logger.warn(`Order ${orderId} not found, removing job`);
        await job.remove();
        return;
      }

      const existingOrder = order[0];

      // If tracking reference was removed, stop the job
      if (!existingOrder.trackingReference) {
        this.logger.log(
          `Tracking reference removed for order ${orderId}, stopping job`,
        );
        await this.stopTrackingJob(orderId);
        return;
      }

      // Fetch latest tracking status
      const trackingData = await this.royalMailService.getTrackingStatus(
        existingOrder.trackingReference,
      );

      const previousStatus = existingOrder.trackingStatus;
      const newStatus = trackingData.status.toUpperCase();
      const statusChanged = previousStatus !== newStatus;

      // Map Royal Mail status to OrderStatus
      const orderStatus = this.mapTrackingStatusToOrderStatus(
        trackingData.status,
      );

      // Update order with latest tracking information
      await this.database.db
        .update(orders)
        .set({
          trackingStatus: newStatus,
          trackingLastChecked: new Date(),
          trackingStatusUpdated: statusChanged
            ? new Date()
            : existingOrder.trackingStatusUpdated,
          trackingEvents: trackingData.events,
          status: orderStatus,
        })
        .where(eq(orders.id, orderId));

      // If status changed, send notification email
      if (statusChanged) {
        await this.sendTrackingStatusUpdateEmail(existingOrder.userId, {
          orderId,
          previousStatus,
          newStatus: trackingData.status,
          trackingReference: existingOrder.trackingReference,
          events: trackingData.events,
        });
      }

      // If status is final, stop the recurring job
      if (this.royalMailService.isFinalStatus(trackingData.status)) {
        this.logger.log(
          `Final status reached for order ${orderId}, stopping tracking job`,
        );
        await this.stopTrackingJob(orderId);
      }
    } catch (error) {
      this.logger.error(
        `Error processing tracking check for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  // Stop tracking job for an order
  async stopTrackingJob(orderId: string): Promise<void> {
    const order = await this.database.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || order.length === 0 || !order[0].trackingJobId) {
      return;
    }

    try {
      const job = await this.trackingQueue.getJob(order[0].trackingJobId);
      if (job) {
        await job.remove();
        this.logger.log(`Stopped tracking job for order ${orderId}`);
      }

      // Clear job ID from order
      await this.database.db
        .update(orders)
        .set({ trackingJobId: null })
        .where(eq(orders.id, orderId));
    } catch (error) {
      this.logger.error(
        `Error stopping tracking job for order ${orderId}:`,
        error,
      );
    }
  }

  // Get tracking status for an order
  async getTrackingStatus(
    orderId: string,
    userId?: string,
  ): Promise<TrackingStatusDto> {
    const order = await this.database.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || order.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const existingOrder = order[0];

    // Verify order ownership if userId is provided
    if (userId && existingOrder.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    return {
      orderId: existingOrder.id,
      trackingReference: existingOrder.trackingReference || null,
      trackingStatus: existingOrder.trackingStatus
        ? (existingOrder.trackingStatus.toLowerCase() as RoyalMailTrackingStatus)
        : null,
      trackingLastChecked: existingOrder.trackingLastChecked || null,
      trackingStatusUpdated: existingOrder.trackingStatusUpdated || null,
      trackingEvents: existingOrder.trackingEvents
        ? (existingOrder.trackingEvents as any[])
        : null,
      isTrackingActive: !!existingOrder.trackingJobId,
    };
  }

  // Map Royal Mail tracking status to OrderStatus enum
  private mapTrackingStatusToOrderStatus(
    trackingStatus: RoyalMailTrackingStatus,
  ): OrderStatus {
    const statusMap: Record<RoyalMailTrackingStatus, OrderStatus> = {
      pending: OrderStatus.PENDING,
      notfound: OrderStatus.NOTFOUND,
      inforeceived: OrderStatus.INFORECEIVED,
      transit: OrderStatus.TRANSIT,
      pickup: OrderStatus.PICKUP,
      undelivered: OrderStatus.UNDELIVERED,
      delivered: OrderStatus.DELIVERED,
      exception: OrderStatus.EXCEPTION,
      expired: OrderStatus.EXPIRED,
    };

    return statusMap[trackingStatus] || OrderStatus.PENDING;
  }

  // Send tracking status update email
  private async sendTrackingStatusUpdateEmail(
    userId: string,
    data: {
      orderId: string;
      previousStatus: string | null;
      newStatus: string;
      trackingReference: string;
      events: any[];
    },
  ): Promise<void> {
    try {
      // Get user details
      const user = await this.database.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || user.length === 0 || !user[0].email) {
        this.logger.warn(`User ${userId} not found or has no email`);
        return;
      }

      const userData = user[0];
      const latestEvent =
        data.events && data.events.length > 0
          ? data.events[data.events.length - 1]
          : null;

      // Send email notification
      this.eventsEmitter.sendEmail({
        to: userData.email,
        type: EmailType.TRACKING_STATUS_UPDATE,
        context: {
          firstName: userData.firstName || 'Customer',
          lastName: userData.lastName || '',
          orderId: data.orderId,
          trackingReference: data.trackingReference,
          previousStatus: data.previousStatus || 'Unknown',
          newStatus: data.newStatus,
          statusDescription: this.getStatusDescription(data.newStatus),
          latestEvent: latestEvent
            ? {
                timestamp: latestEvent.timestamp || new Date().toISOString(),
                location: latestEvent.location || '',
                description: latestEvent.description || 'Status update',
              }
            : {
                timestamp: new Date().toISOString(),
                location: '',
                description: 'No recent updates available',
              },
        },
      });

      this.logger.log(
        `Tracking status update email sent to ${userData.email} for order ${data.orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending tracking status update email for order ${data.orderId}:`,
        error,
      );
    }
  }

  // Get human-readable status description
  private getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      pending: 'Your order is being prepared',
      notfound: 'Tracking information not found',
      inforeceived: 'Shipping information received',
      transit: 'Your order is in transit',
      pickup: 'Ready for pickup',
      undelivered: 'Delivery attempt unsuccessful',
      delivered: 'Your order has been delivered',
      exception: 'An exception occurred during delivery',
      expired: 'Tracking information has expired',
    };

    return descriptions[status.toLowerCase()] || 'Status update';
  }
}
