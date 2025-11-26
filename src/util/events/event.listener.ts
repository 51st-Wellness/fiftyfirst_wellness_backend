import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from './events.enum';
import { EmailService } from 'src/modules/notification/email/email.service';
import { EmailPayloadDto } from 'src/modules/notification/email/dto/email-payload.dto';
import { OrderService } from 'src/modules/user/submodules/order/order.service';
import { EmailType } from 'src/modules/notification/email/constants/email.enum';

@Injectable()
export class EventsListeners {
  private logger = new Logger(EventsListeners.name);

  constructor(
    private readonly emailService: EmailService,
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

    // Emit email notification based on status
    let emailType: EmailType | null = null;

    switch (data.newStatus) {
      case 'TRANSIT':
        emailType = EmailType.ORDER_IN_TRANSIT;
        break;
      case 'DELIVERED':
        emailType = EmailType.ORDER_DELIVERED;
        break;
      case 'EXCEPTION':
      case 'UNDELIVERED':
        emailType = EmailType.ORDER_EXCEPTION;
        break;
      case 'INFORECEIVED':
        emailType = EmailType.ORDER_DISPATCHED;
        break;
    }

    if (emailType) {
      // Note: Actual email sending would need order details and user email
      // This would be implemented with proper email template and data fetching
      this.logger.log(
        `Would send ${emailType} email for order ${data.orderId}`,
      );
    }
  }
}
