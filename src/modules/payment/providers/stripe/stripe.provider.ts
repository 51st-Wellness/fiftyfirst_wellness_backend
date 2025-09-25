import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import {
  PaymentProvider,
  PaymentInitInput,
  PaymentInitResult,
  WebhookResult,
  PaymentCaptureResult,
} from '../payment.types';
import { PaymentStatus } from 'src/database/schema';

// Stripe payment provider implementing initialize/capture/webhook
@Injectable()
export class StripeProvider implements PaymentProvider {
  private stripe: Stripe;
  private webhookSecret?: string;

  constructor(secretKey: string, webhookSecret?: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
    });
    this.webhookSecret = webhookSecret;
  }

  async initializePayment(input: PaymentInitInput): Promise<PaymentInitResult> {
    const isSubscription = Boolean(input.subscriptionId);

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      input.items && input.items.length > 0
        ? input.items.map((it) => ({
            quantity: it.quantity,
            price_data: {
              currency: input.currency.toLowerCase(),
              product_data: { name: it.name },
              unit_amount: Math.round(it.unitPrice * 100),
              ...(isSubscription
                ? { recurring: { interval: 'day', interval_count: 30 } }
                : {}),
            },
          }))
        : [
            {
              quantity: 1,
              price_data: {
                currency: input.currency.toLowerCase(),
                product_data: { name: input.description || 'Payment' },
                unit_amount: Math.round(input.amount * 100),
                ...(isSubscription
                  ? { recurring: { interval: 'day', interval_count: 30 } }
                  : {}),
              },
            },
          ];

    const session = await this.stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      line_items: lineItems,
      success_url: `${process.env.SERVER_URL}/payment/redirect/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SERVER_URL}/payment/redirect/cancel`,
      client_reference_id: input.orderId || input.subscriptionId || undefined,
      metadata: {
        userId: input.userId,
        type: isSubscription ? 'subscription' : 'store_checkout',
        orderId: input.orderId ?? '',
        subscriptionId: input.subscriptionId ?? '',
      },
    });

    return { providerRef: session.id, approvalUrl: session.url || undefined };
  }

  async capturePayment(providerRef: string): Promise<PaymentCaptureResult> {
    const session = await this.stripe.checkout.sessions.retrieve(providerRef, {
      expand: ['payment_intent', 'subscription'],
    });

    // One-time payment
    if (session.mode === 'payment') {
      const paid = session.payment_status === 'paid';
      const paymentIntent =
        session.payment_intent as Stripe.PaymentIntent | null;
      return {
        status: paid ? 'PAID' : 'PENDING',
        transactionId: paymentIntent?.id || undefined,
      };
    }

    // Subscription payment
    if (session.mode === 'subscription') {
      const subscription = session.subscription as Stripe.Subscription | null;
      const active =
        subscription?.status === 'active' ||
        subscription?.status === 'trialing';
      return {
        status: active ? 'PAID' : 'PENDING',
        transactionId: subscription?.id,
      };
    }

    return { status: 'PENDING' };
  }

  async verifyWebhook(
    headers: Record<string, string>,
    body: any,
  ): Promise<boolean> {
    if (!this.webhookSecret) return false;
    const sig = headers['stripe-signature'];
    if (!sig) return false;
    try {
      // Construct event to verify signature
      this.stripe.webhooks.constructEvent(
        Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)),
        sig,
        this.webhookSecret,
      );
      return true;
    } catch {
      return false;
    }
  }

  parseWebhook(body: any): WebhookResult {
    const event = body as Stripe.Event;
    let providerRef = '';
    let status: PaymentStatus = PaymentStatus.PENDING;
    let eventType = event.type;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        providerRef = session.id;
        if (session.mode === 'payment') {
          status =
            session.payment_status === 'paid'
              ? PaymentStatus.PAID
              : PaymentStatus.PENDING;
        } else if (session.mode === 'subscription') {
          status = PaymentStatus.PAID; // subscription created, consider active
        }
        break;
      }
      case 'invoice.payment_failed':
      case 'payment_intent.payment_failed': {
        const obj: any = event.data.object as any;
        providerRef = obj.id || obj.payment_intent || '';
        status = PaymentStatus.FAILED;
        break;
      }
      case 'charge.refunded':
      case 'charge.refund.updated': {
        const charge = event.data.object as Stripe.Charge;
        providerRef = charge.payment_intent as string;
        status = PaymentStatus.REFUNDED;
        break;
      }
      default: {
        // Keep pending for unhandled events
        const obj: any = event.data.object as any;
        providerRef = obj?.id || '';
        status = PaymentStatus.PENDING;
      }
    }

    return { providerRef, status, raw: event, eventType };
  }
}
