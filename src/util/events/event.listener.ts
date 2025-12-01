import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from './events.enum';
import { EmailService } from 'src/modules/notification/email/email.service';
import { EmailPayloadDto } from 'src/modules/notification/email/dto/email-payload.dto';
import { DatabaseService } from 'src/database/database.service';
import { EventsEmitter } from './events.emitter';
import { orders, OrderStatus, users } from 'src/database/schema';
import { eq } from 'drizzle-orm';
import { EmailType } from 'src/modules/notification/email/constants/email.enum';
import { OrderService } from 'src/modules/user/submodules/order/order.service';

@Injectable()
export class EventsListeners {
  private logger = new Logger(EventsListeners.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly database: DatabaseService,
    private readonly eventsEmitter: EventsEmitter,
    private readonly orderService: OrderService,
  ) {}

  @OnEvent(EVENTS.NOTIFICATION_EMAIL)
  async handleEmailNotification(emailPayload: EmailPayloadDto) {
    try {
      await this.emailService.sendMail(emailPayload);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${emailPayload.to} with type ${emailPayload.type}:`,
        error,
      );
    }
  }

  @OnEvent(EVENTS.ORDER_PAYMENT_CONFIRMED)
  async handleOrderPaymentConfirmed(data: { orderId: string; userId: string }) {
    this.logger.log(
      `Payment confirmed for order ${data.orderId}, submitting to Click & Drop`,
    );
    try {
      await this.orderService.submitOrderToClickDrop(data.orderId);
    } catch (error) {
      this.logger.error(
        `Failed to submit order ${data.orderId} to Click & Drop:`,
        error,
      );
    }
  }

  @OnEvent(EVENTS.ORDER_STATUS_CHANGED)
  async handleOrderStatusChanged(data: {
    orderId: string;
    oldStatus: string;
    newStatus: string;
    trackingNumber?: string;
  }) {
    this.logger.log(
      `Order ${data.orderId} status changed from ${data.oldStatus} to ${data.newStatus}`,
    );

    try {
      // Get order details including user information
      const orderResult = await this.database.db
        .select({
          order: orders,
          user: users,
        })
        .from(orders)
        .where(eq(orders.id, data.orderId))
        .innerJoin(users, eq(orders.userId, users.id))
        .limit(1);

      if (!orderResult || orderResult.length === 0) {
        this.logger.warn(
          `Order ${data.orderId} not found for status change notification`,
        );
        return;
      }

      const { order, user } = orderResult[0];

      if (!user || !user.email) {
        this.logger.warn(
          `User ${order.userId} not found or has no email for order ${data.orderId}`,
        );
        return;
      }

      // Determine email type based on status
      let emailType: EmailType | null = null;

      switch (data.newStatus) {
        case OrderStatus.TRANSIT:
          emailType = EmailType.ORDER_IN_TRANSIT;
          break;
        case OrderStatus.DELIVERED:
          emailType = EmailType.ORDER_DELIVERED;
          break;
        case OrderStatus.EXCEPTION:
        case OrderStatus.UNDELIVERED:
          emailType = EmailType.ORDER_EXCEPTION;
          break;
        case OrderStatus.DISPATCHED:
          emailType = EmailType.ORDER_DISPATCHED;
          break;
      }

      if (emailType) {
        // Send email notification
        this.eventsEmitter.sendEmail({
          to: user.email,
          type: emailType,
          context: {
            firstName: user.firstName || 'Customer',
            lastName: user.lastName || '',
            orderId: data.orderId,
            trackingReference: data.trackingNumber || '',
            previousStatus: data.oldStatus,
            newStatus: data.newStatus,
            statusDescription: this.getStatusDescription(data.newStatus),
          },
        });

        this.logger.log(
          `Sent ${emailType} email to ${user.email} for order ${data.orderId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling order status change for ${data.orderId}:`,
        error,
      );
    }
  }

  // Get human-readable status description
  private getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      PENDING: 'Your order is being prepared',
      PROCESSING: 'Your order is being processed',
      DISPATCHED: 'Your order has been dispatched',
      TRANSIT: 'Your order is in transit',
      DELIVERED: 'Your order has been delivered',
      UNDELIVERED: 'Delivery attempt unsuccessful',
      EXCEPTION: 'An exception occurred during delivery',
      EXPIRED: 'Tracking information has expired',
    };

    return descriptions[status] || 'Status update';
  }
}
