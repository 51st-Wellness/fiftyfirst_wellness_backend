import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { DatabaseService } from 'src/database/database.service';
import { orders, OrderStatus, users } from 'src/database/schema';
import { eq, and, isNotNull, or, inArray, sql } from 'drizzle-orm';
import { ClickDropService } from './royal-mail/click-drop.service';
import { QUEUE_NAMES } from 'src/config/queues.config';
import { TrackingStatusDto } from './dto/tracking-response.dto';
import { RoyalMailTrackingStatus } from './royal-mail/royal-mail.types';
import { EventsEmitter } from 'src/util/events/events.emitter';
import { EVENTS } from 'src/util/events/events.enum';
import { EmailType } from 'src/modules/notification/email/constants/email.enum';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly TRACKING_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor(
    @InjectQueue(QUEUE_NAMES.TRACKING)
    private readonly trackingQueue: Queue,
    private readonly database: DatabaseService,
    private readonly clickDropService: ClickDropService,
    private readonly eventsEmitter: EventsEmitter,
  ) {}

  // Check Click & Drop orders and update status
  async checkClickDropOrders(): Promise<void> {
    // Get all orders with Click & Drop order identifiers that aren't in final status
    const finalStatuses = [
      OrderStatus.DELIVERED,
      OrderStatus.UNDELIVERED,
      OrderStatus.EXPIRED,
    ];

    const ordersToCheck = await this.database.db
      .select({
        id: orders.id,
        clickDropOrderIdentifier: orders.clickDropOrderIdentifier,
        status: orders.status,
      })
      .from(orders)
      .where(
        and(
          isNotNull(orders.clickDropOrderIdentifier),
          sql`${orders.status} NOT IN (${sql.join(finalStatuses, sql`, `)})`,
        ),
      )
      .limit(100); // Process up to 100 orders per batch (API limit)

    if (ordersToCheck.length === 0) {
      this.logger.log('No Click & Drop orders to check');
      return;
    }

    // Group orders by Click & Drop order identifier (semicolon-separated for API)
    const orderIdentifiers = ordersToCheck
      .map((o) => o.clickDropOrderIdentifier)
      .join(';');

    try {
      this.logger.log(`Checking ${ordersToCheck.length} Click & Drop orders`);

      // Fetch order info from Click & Drop API
      const clickDropOrders =
        await this.clickDropService.getOrdersByIdentifiers(orderIdentifiers);

      // Update each order with latest info
      for (const cdOrder of clickDropOrders) {
        const localOrder = ordersToCheck.find(
          (o) => o.clickDropOrderIdentifier === cdOrder.orderIdentifier,
        );

        if (!localOrder) continue;

        // Determine status based on Click & Drop order state
        let newStatus = localOrder.status;
        const now = new Date();

        if (cdOrder.manifestedOn) {
          newStatus = OrderStatus.TRANSIT;
        }
        if (cdOrder.shippedOn) {
          newStatus = OrderStatus.DELIVERED;
        }

        // Get current status history
        const currentOrder = await this.database.db
          .select()
          .from(orders)
          .where(eq(orders.id, localOrder.id))
          .limit(1);

        const statusHistory = (currentOrder[0]?.statusHistory as any[]) || [];

        // Add status change to history if status changed
        if (newStatus !== localOrder.status) {
          statusHistory.push({
            status: newStatus,
            timestamp: now.toISOString(),
            note: `Updated from Click & Drop API`,
            clickDropData: {
              manifestedOn: cdOrder.manifestedOn,
              shippedOn: cdOrder.shippedOn,
              printedOn: cdOrder.printedOn,
            },
          });

          this.logger.log(
            `Order ${localOrder.id} status changed from ${localOrder.status} to ${newStatus}`,
          );

          // Emit event for notifications
          this.eventsEmitter.emit(EVENTS.ORDER_STATUS_CHANGED, {
            orderId: localOrder.id,
            oldStatus: localOrder.status,
            newStatus,
            trackingNumber: cdOrder.trackingNumber,
          });
        }

        // Update order in database
        await this.database.db
          .update(orders)
          .set({
            status: newStatus,
            trackingLastChecked: now,
            trackingStatusUpdated:
              newStatus !== localOrder.status ? now : undefined,
            statusHistory,
          })
          .where(eq(orders.id, localOrder.id));
      }

      this.logger.log(
        `Successfully updated ${clickDropOrders.length} orders from Click & Drop`,
      );
    } catch (error) {
      this.logger.error('Error checking Click & Drop orders:', error);
      // Don't throw - we'll retry on next scheduled run
    }
  }

  // Manually refresh tracking status via Click & Drop
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

    if (!existingOrder.clickDropOrderIdentifier) {
      throw new NotFoundException(
        'No Click & Drop order found for this order. Order may not have been submitted yet.',
      );
    }

    // Fetch latest status from Click & Drop
    const clickDropOrders = await this.clickDropService.getOrdersByIdentifiers(
      existingOrder.clickDropOrderIdentifier.toString(),
    );

    if (!clickDropOrders || clickDropOrders.length === 0) {
      throw new NotFoundException(
        'Unable to fetch tracking information from Click & Drop',
      );
    }

    const cdOrder = clickDropOrders[0];
    const previousStatus = existingOrder.status;
    const newStatus = this.mapClickDropStatusToOrderStatus(cdOrder);
    const statusChanged = previousStatus !== newStatus;

    const now = new Date();

    // Update order with latest information
    await this.database.db
      .update(orders)
      .set({
        status: newStatus,
        trackingLastChecked: now,
        trackingStatusUpdated: statusChanged
          ? now
          : existingOrder.trackingStatusUpdated,
      })
      .where(eq(orders.id, orderId));

    // Emit event if status changed
    if (statusChanged) {
      this.eventsEmitter.emit(EVENTS.ORDER_STATUS_CHANGED, {
        orderId: existingOrder.id,
        oldStatus: previousStatus,
        newStatus,
        trackingNumber: cdOrder.trackingNumber,
      });
    }

    return {
      orderId: existingOrder.id,
      trackingReference: cdOrder.trackingNumber || null,
      trackingStatus: newStatus.toLowerCase() as any,
      trackingLastChecked: now,
      trackingStatusUpdated: statusChanged
        ? now
        : existingOrder.trackingStatusUpdated,
      trackingEvents: existingOrder.trackingEvents
        ? (existingOrder.trackingEvents as any[])
        : null,
      isTrackingActive: this.isTrackingActive(newStatus),
    };
  }

  // Map Click & Drop order status to our OrderStatus enum
  private mapClickDropStatusToOrderStatus(cdOrder: any): OrderStatus {
    // Map based on Click & Drop order lifecycle
    if (cdOrder.shippedOn) {
      return OrderStatus.TRANSIT;
    }
    if (cdOrder.manifestedOn) {
      return OrderStatus.INFORECEIVED;
    }
    if (cdOrder.printedOn) {
      return OrderStatus.PROCESSING;
    }
    return OrderStatus.PENDING;
  }

  // Process tracking check job (called by consumer) - now checks all Click & Drop orders
  async processTrackingCheck(job: Job): Promise<void> {
    this.logger.log('Processing Click & Drop tracking check job');

    try {
      // Check all Click & Drop orders (batch processing)
      await this.checkClickDropOrders();
    } catch (error) {
      this.logger.error(
        `Error processing tracking check for order ${job.data.orderId}:`,
        error,
      );
      throw error;
    }
  }

  // Check if tracking is still active based on tracking status (not order status)
  private isTrackingActive(trackingStatus: string | null): boolean {
    if (!trackingStatus) {
      return true; // No tracking status yet, consider active
    }

    // Use the same logic as RoyalMailService.isFinalStatus for consistency
    const finalTrackingStatuses = [
      'delivered',
      'undelivered',
      'exception',
      'expired',
    ];
    return !finalTrackingStatuses.includes(trackingStatus.toLowerCase());
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

    // Get tracking number from Click & Drop if available
    let trackingNumber: string | null = null;
    if (existingOrder.clickDropOrderIdentifier) {
      try {
        const clickDropOrders =
          await this.clickDropService.getOrdersByIdentifiers(
            existingOrder.clickDropOrderIdentifier.toString(),
          );
        if (clickDropOrders && clickDropOrders.length > 0) {
          trackingNumber = clickDropOrders[0].trackingNumber || null;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch tracking number from Click & Drop for order ${orderId}`,
        );
      }
    }

    return {
      orderId: existingOrder.id,
      trackingReference: trackingNumber,
      trackingStatus: existingOrder.trackingStatus
        ? (existingOrder.trackingStatus.toLowerCase() as RoyalMailTrackingStatus)
        : null,
      trackingLastChecked: existingOrder.trackingLastChecked || null,
      trackingStatusUpdated: existingOrder.trackingStatusUpdated || null,
      trackingEvents: existingOrder.trackingEvents
        ? (existingOrder.trackingEvents as any[])
        : null,
      // FIXED: Check trackingStatus instead of order status for consistency
      isTrackingActive: this.isTrackingActive(existingOrder.trackingStatus),
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
