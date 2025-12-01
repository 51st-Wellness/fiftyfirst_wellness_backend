import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { DatabaseService } from 'src/database/database.service';
import { orders, OrderStatus, users } from 'src/database/schema';
import { eq, and, isNotNull, or, inArray, sql, not } from 'drizzle-orm';
import { ClickDropService } from './royal-mail/click-drop.service';
import { RoyalMailTrackingService } from './royal-mail/royal-mail-tracking.service';
import { QUEUE_NAMES } from 'src/config/queues.config';
import { TrackingStatusDto } from './dto/tracking-response.dto';
import { EventsEmitter } from 'src/util/events/events.emitter';
import { EVENTS } from 'src/util/events/events.enum';
import { EmailType } from 'src/modules/notification/email/constants/email.enum';

@Injectable()
export class TrackingService implements OnModuleInit {
  private readonly logger = new Logger(TrackingService.name);
  private readonly trackingInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor(
    @InjectQueue(QUEUE_NAMES.TRACKING)
    private readonly trackingQueue: Queue,
    private readonly database: DatabaseService,
    private readonly clickDropService: ClickDropService,
    private readonly royalMailTrackingService: RoyalMailTrackingService,
    private readonly eventsEmitter: EventsEmitter,
  ) {}

  // Initialize repeatable job for hourly tracking checks
  async onModuleInit() {
    // Schedule hourly tracking check (for testing - can be adjusted later)
    // Using BullMQ repeatable jobs instead of @nestjs/schedule
    // await this.trackingQueue.add(
    //   'check-tracking',
    //   {},
    //   {
    //     repeat: {
    //       // pattern: '0 * * * *', // Cron pattern: Every hour at minute 0
    //       every: this.trackingInterval,
    //     },
    //     jobId: 'hourly-tracking-check', // Unique ID to prevent duplicates
    //   },
    // );
    // this.logger.log(
    //   'Scheduled hourly Click & Drop tracking check (every 1 hour)',
    // );
  }

  // Enhance status using Royal Mail Tracking API when a tracking number exists
  private async royalMailTracking(
    trackingNumber: string,
    currentStatus: OrderStatus,
  ): Promise<OrderStatus> {
    if (!this.royalMailTrackingService.isConfigured()) {
      return currentStatus;
    }

    try {
      const summaryResponse = await this.royalMailTrackingService.getSummary([
        trackingNumber,
      ]);

      const mailPiece = summaryResponse.mailPieces?.[0];
      const summary = mailPiece?.summary;

      if (!summary) {
        this.logger.warn(
          `No summary found for tracking number: ${trackingNumber}`,
        );
        return currentStatus;
      }

      const statusCategory = summary.statusCategory || '';
      const normalized = statusCategory.toUpperCase();

      switch (normalized) {
        case 'DELIVERED':
          return OrderStatus.DELIVERED;
        case 'IN TRANSIT':
          return OrderStatus.TRANSIT;
        case 'NOT FOUND':
          return OrderStatus.NOTFOUND;
        case 'EXCEPTION':
          return OrderStatus.EXCEPTION;
        default:
          return currentStatus;
      }
    } catch (error) {
      this.logger.error(
        `Error enhancing status with Royal Mail Tracking API for ${trackingNumber}:`,
        error,
      );
      // Fallback to current status on any error
      return currentStatus;
    }
  }

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
        userId: orders.userId,
        clickDropOrderIdentifier: orders.clickDropOrderIdentifier,
        status: orders.status,
        trackingNumber: orders.trackingNumber,
      })
      .from(orders)
      .where(
        and(
          isNotNull(orders.clickDropOrderIdentifier),
          not(inArray(orders.status, finalStatuses)),
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
      // .filter((id): id is number => id !== null)
      // todo: testing tracking for a specific order
      .filter((id): id is number => id !== null && id === 1002)
      .join(';');

    try {
      this.logger.log(`Checking ${ordersToCheck.length} Click & Drop orders`);

      // Fetch order info from Click & Drop API
      const clickDropOrders =
        await this.clickDropService.getOrdersByIdentifiers(orderIdentifiers);

      // Handle case where API returns fewer orders than requested
      if (clickDropOrders.length < ordersToCheck.length) {
        const foundIdentifiers = new Set(
          clickDropOrders.map((o) => o.orderIdentifier),
        );
        const missing = ordersToCheck.filter(
          (o) => !foundIdentifiers.has(o.clickDropOrderIdentifier!),
        );
        this.logger.warn(
          `${missing.length} orders not found in Click & Drop API (may have been deleted or not yet created)`,
        );
      }

      // Update each order with latest info
      for (const cdOrder of clickDropOrders) {
        // todo: use a map to make this faster
        const localOrder = ordersToCheck.find(
          (o) => o.clickDropOrderIdentifier === cdOrder.orderIdentifier,
        );

        console.log('Local Order:', JSON.stringify(localOrder, null, 2));
        if (!localOrder) continue;

        // Use the correct status mapping method
        let newStatus = this.mapClickDropStatusToOrderStatus(cdOrder);
        const previousStatus = localOrder.status;

        console.log('New Status:', newStatus);

        // If the order has been shipped and we have a tracking number,
        // if (cdOrder.shippedOn && cdOrder.trackingNumber) {
        // TODO: testing tracking for a specific order
        if (localOrder.trackingNumber) {
          console.log(
            'Using Royal Mail Tracking API to get more accurate status',
          );
          newStatus = await this.royalMailTracking(
            localOrder.trackingNumber,
            newStatus,
          );
        }

        const statusChanged = newStatus !== previousStatus;
        const now = new Date();

        // Get current order details for status history and tracking updates
        const currentOrder = await this.database.db
          .select()
          .from(orders)
          .where(eq(orders.id, localOrder.id))
          .limit(1);

        if (!currentOrder || currentOrder.length === 0) continue;

        const existingOrder = currentOrder[0];
        const statusHistory = (existingOrder.statusHistory as any[]) || [];

        // Add status change to history if status changed
        if (statusChanged) {
          statusHistory.push({
            status: newStatus,
            timestamp: now.toISOString(),
            note: `Updated from Click & Drop API`,
            clickDropData: {
              orderIdentifier: cdOrder.orderIdentifier,
              trackingNumber: cdOrder.trackingNumber,
              printedOn: cdOrder.printedOn,
              manifestedOn: cdOrder.manifestedOn,
              shippedOn: cdOrder.shippedOn,
            },
          });

          this.logger.log(
            `Order ${localOrder.id} status changed from ${previousStatus} to ${newStatus}`,
          );

          // Emit event for notifications
          this.eventsEmitter.emit(EVENTS.ORDER_STATUS_CHANGED, {
            orderId: localOrder.id,
            oldStatus: previousStatus,
            newStatus,
            trackingNumber: cdOrder.trackingNumber,
          });

          // Send simple email notification about new status
          await this.sendTrackingStatusUpdateEmail(localOrder.userId, {
            orderId: localOrder.id,
            previousStatus,
            newStatus,
            trackingReference: cdOrder.trackingNumber || '',
            events: [],
          });
        }

        // Update order in database with latest status and tracking number
        await this.database.db
          .update(orders)
          .set({
            status: newStatus,
            trackingNumber:
              cdOrder.trackingNumber ?? (existingOrder as any).trackingNumber,
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

    // Start with Click & Drop based status
    let newStatus = this.mapClickDropStatusToOrderStatus(cdOrder);

    // If shipped and we have a tracking number, enhance with Royal Mail Tracking API
    if (cdOrder.shippedOn && cdOrder.trackingNumber) {
      newStatus = await this.royalMailTracking(
        cdOrder.trackingNumber,
        newStatus,
      );
    }

    const statusChanged = previousStatus !== newStatus;

    const now = new Date();

    // Get current status history
    const statusHistory = (existingOrder.statusHistory as any[]) || [];
    if (statusChanged) {
      statusHistory.push({
        status: newStatus,
        timestamp: now.toISOString(),
        note: `Manually refreshed from Click & Drop API`,
        clickDropData: {
          orderIdentifier: cdOrder.orderIdentifier,
          trackingNumber: cdOrder.trackingNumber,
          printedOn: cdOrder.printedOn,
          manifestedOn: cdOrder.manifestedOn,
          shippedOn: cdOrder.shippedOn,
        },
      });
    }

    // Update order with latest information including tracking number
    await this.database.db
      .update(orders)
      .set({
        status: newStatus,
        trackingNumber:
          cdOrder.trackingNumber ?? (existingOrder as any).trackingNumber,
        statusHistory,
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
      trackingStatus: newStatus,
      isTrackingActive: this.isTrackingActive(newStatus),
    };
  }

  // Map Click & Drop order status to our OrderStatus enum
  // Based on Click & Drop API lifecycle: printedOn -> manifestedOn -> shippedOn
  private mapClickDropStatusToOrderStatus(cdOrder: any): OrderStatus {
    // Check in reverse order of lifecycle (most advanced status first)
    if (cdOrder.shippedOn) {
      // We'll use TRANSIT for shipped orders
      return OrderStatus.TRANSIT;
    }
    if (cdOrder.manifestedOn) {
      // manifestedOn means order info received and manifested
      return OrderStatus.DISPATCHED;
    }
    if (cdOrder.printedOn) {
      // printedOn means label has been printed
      return OrderStatus.PROCESSING;
    }
    // No dates set means order is still pending
    return OrderStatus.PROCESSING;
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

  // Check if tracking is still active based on order status
  private isTrackingActive(orderStatus: OrderStatus): boolean {
    const finalStatuses: OrderStatus[] = [
      OrderStatus.DELIVERED,
      OrderStatus.UNDELIVERED,
      OrderStatus.EXCEPTION,
      OrderStatus.EXPIRED,
    ];
    return !finalStatuses.includes(orderStatus);
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

    // Prefer stored tracking number, fallback to Click & Drop if needed
    let trackingNumber: string | null =
      (existingOrder as any).trackingNumber || null;

    if (!trackingNumber && existingOrder.clickDropOrderIdentifier) {
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
      trackingStatus: existingOrder.status,
      isTrackingActive: this.isTrackingActive(existingOrder.status),
    };
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
    const descriptions: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'Your order is being prepared',
      [OrderStatus.PROCESSING]: 'Your order is being processed',
      [OrderStatus.DISPATCHED]: 'Your order has been dispatched',
      [OrderStatus.TRANSIT]: 'Your order is in transit',
      [OrderStatus.PICKUP]: 'Ready for pickup',
      [OrderStatus.UNDELIVERED]: 'Delivery attempt unsuccessful',
      [OrderStatus.DELIVERED]: 'Your order has been delivered',
      [OrderStatus.EXCEPTION]: 'An exception occurred during delivery',
      [OrderStatus.EXPIRED]: 'Tracking information has expired',
      [OrderStatus.NOTFOUND]: 'Tracking information not found',
    };

    return descriptions[status as OrderStatus] || 'Status update';
  }
}
