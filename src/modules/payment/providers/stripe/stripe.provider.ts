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

type StoreCheckoutMetadata = {
  type: 'store_checkout';
  orderId?: string;
  paymentId?: string;
  userId?: string;
};

type SubscriptionMetadata = {
  type: 'subscription';
  subscriptionId?: string;
  planId?: string;
};

type StripeMetadata = (StoreCheckoutMetadata | SubscriptionMetadata) &
  Record<string, any>;

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
                ? { recurring: { interval: 'month', interval_count: 1 } }
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
                  ? { recurring: { interval: 'month', interval_count: 1 } }
                  : {}),
              },
            },
          ];

    // Add shipping as a separate line item if provided (only for non-subscription payments)
    if (!isSubscription && input.shippingCost && input.shippingCost > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          product_data: {
            name: input.shippingDescription || 'Shipping',
          },
          unit_amount: Math.round(input.shippingCost * 100),
        },
      });
    }

    const baseMetadata: StripeMetadata = {
      userId: input.userId,
      type: isSubscription ? 'subscription' : 'store_checkout',
      orderId: input.orderId ?? '',
      subscriptionId: input.subscriptionId ?? '',
      paymentId: input.paymentId ?? '',
    };

    const captureMethod = input.captureMethod || 'automatic';
    const isPreOrder = input.isPreOrder || false;

    const session = await this.stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      line_items: lineItems,
      // payment_method_types: [
      //   'card',
      //   'apple_pay',
      // ] as any,
      success_url: `${process.env.SERVER_URL}/payment/redirect/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SERVER_URL}/payment/redirect/cancel`,
      client_reference_id: input.orderId || input.subscriptionId || undefined,
      payment_intent_data: isSubscription
        ? undefined
        : {
            metadata: {
              ...baseMetadata,
              isPreOrder: isPreOrder.toString(),
              captureMethod,
            },
            capture_method: captureMethod === 'manual' ? 'manual' : 'automatic',
          },
      subscription_data: isSubscription
        ? {
            metadata: baseMetadata,
          }
        : undefined,
      metadata: {
        ...baseMetadata,
        isPreOrder: isPreOrder.toString(),
        captureMethod,
      },
    });

    return { providerRef: session.id, approvalUrl: session.url || undefined };
  }

  async capturePayment(providerRef: string): Promise<PaymentCaptureResult> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(
        providerRef,
        {
          expand: ['payment_intent', 'subscription'],
        },
      );

      // One-time payment
      if (session.mode === 'payment') {
        const paid = session.payment_status === 'paid';
        const paymentIntent =
          session.payment_intent as Stripe.PaymentIntent | null;

        // Additional check for payment intent status
        const paymentIntentStatus = paymentIntent?.status;
        const isActuallyPaid = paid && paymentIntentStatus === 'succeeded';

        return {
          status: isActuallyPaid ? 'PAID' : 'PENDING',
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
    } catch (error) {
      console.error('Error capturing payment:', error);
      return { status: 'PENDING' };
    }
  }

  async verifyWebhook(
    headers: Record<string, string>,
    body: any,
  ): Promise<boolean> {
    if (!this.webhookSecret) {
      console.warn('Stripe webhook secret not configured');
      return false;
    }

    const sig = headers['stripe-signature'];
    if (!sig) {
      console.warn('Missing Stripe signature header');
      return false;
    }

    try {
      // Ensure we have the raw body as Buffer or string
      let rawBody: Buffer | string;
      if (Buffer.isBuffer(body)) {
        rawBody = body;
      } else if (typeof body === 'string') {
        rawBody = body;
      } else {
        // If body is already parsed JSON, we can't verify signature
        console.error(
          'Webhook body is parsed as JSON, signature verification will fail',
        );
        rawBody = JSON.stringify(body);
      }

      // Construct event to verify signature - this will throw if invalid
      this.stripe.webhooks.constructEvent(rawBody, sig, this.webhookSecret);
      return true;
    } catch (error) {
      console.error('Stripe webhook verification failed:', {
        error: error.message,
        hasRawBody: Buffer.isBuffer(body) || typeof body === 'string',
        bodyType: typeof body,
        signaturePresent: !!sig,
      });
      return false;
    }
  }

  async fetchPaymentIntentMetadata(
    paymentIntentId: string,
  ): Promise<Record<string, any> | null> {
    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent.metadata as Record<string, any>;
    } catch (error) {
      console.error(
        `Failed to fetch PaymentIntent metadata for ${paymentIntentId}:`,
        error,
      );
      return null;
    }
  }

  // Verify payment status directly from Stripe API using Checkout Session ID
  async verifyPaymentStatus(
    providerRef: string,
  ): Promise<PaymentCaptureResult> {
    try {
      // Retrieve checkout session with expanded payment_intent and subscription
      const session = await this.stripe.checkout.sessions.retrieve(
        providerRef,
        {
          expand: ['payment_intent', 'subscription', 'line_items'],
        },
      );

      // For one-time payments
      if (session.mode === 'payment') {
        const paymentIntent =
          session.payment_intent as Stripe.PaymentIntent | null;

        if (!paymentIntent) {
          return { status: 'PENDING' };
        }

        // Check both session payment_status and payment_intent status
        const sessionPaid = session.payment_status === 'paid';
        const intentSucceeded = paymentIntent.status === 'succeeded';

        if (sessionPaid && intentSucceeded) {
          return {
            status: 'PAID',
            transactionId: paymentIntent.id,
          };
        }

        // Check for failed/cancelled states
        if (paymentIntent.status === 'canceled') {
          return { status: 'PENDING' }; // Will be handled as CANCELLED by caller
        }

        if ((paymentIntent as any).status === 'payment_failed') {
          return { status: 'FAILED' };
        }

        return { status: 'PENDING' };
      }

      // For subscription payments
      if (session.mode === 'subscription') {
        const subscription = session.subscription as Stripe.Subscription | null;

        if (!subscription) {
          return { status: 'PENDING' };
        }

        const isActive =
          subscription.status === 'active' ||
          subscription.status === 'trialing';

        if (isActive) {
          return {
            status: 'PAID',
            transactionId: subscription.id,
          };
        }

        if (subscription.status === 'canceled') {
          return { status: 'PENDING' }; // Will be handled as CANCELLED by caller
        }

        return { status: 'PENDING' };
      }

      return { status: 'PENDING' };
    } catch (error) {
      console.error('Error verifying payment status from Stripe:', error);
      // If session not found or other error, return PENDING to avoid false positives
      return { status: 'PENDING' };
    }
  }

  parseWebhook(body: any): WebhookResult {
    // Handle both raw string/buffer and parsed JSON
    let event: Stripe.Event;

    try {
      if (typeof body === 'string') {
        event = JSON.parse(body) as Stripe.Event;
      } else if (Buffer.isBuffer(body)) {
        event = JSON.parse(body.toString('utf8')) as Stripe.Event;
      } else {
        event = body as Stripe.Event;
      }
    } catch (parseError) {
      console.error('Failed to parse webhook body:', parseError);
      return {
        providerRef: '',
        status: PaymentStatus.PENDING,
        raw: body,
        eventType: 'parse_error',
        metadata: {
          error: 'Failed to parse webhook body',
          parseError: parseError.message,
        },
      };
    }

    let providerRef = '';
    let status: PaymentStatus = PaymentStatus.PENDING;
    let eventType = event.type;
    let metadata: any = {};

    // Validate event structure
    if (!event || !event.type || !event.data) {
      console.error('Invalid Stripe event structure:', event);
      return {
        providerRef: '',
        status: PaymentStatus.PENDING,
        raw: event,
        eventType: 'invalid_event',
        metadata: { error: 'Invalid event structure' },
      };
    }

    switch (event.type) {
      // Checkout session events
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        providerRef = session.id;
        // Extract metadata from session (includes paymentId, orderId, etc.)
        const sessionMetadata = (session.metadata as StripeMetadata) || {};
        metadata = {
          sessionId: session.id,
          customerId: session.customer,
          sessionSubscriptionId: session.subscription, // Renamed to avoid conflict
          clientReferenceId: session.client_reference_id,
          mode: session.mode,
          paymentStatus: session.payment_status,
          // Include our custom metadata for reliable payment lookup
          paymentId: sessionMetadata.paymentId,
          orderId: sessionMetadata.orderId,
          subscriptionId: sessionMetadata.subscriptionId,
          type: sessionMetadata.type,
          userId: sessionMetadata.userId,
        };

        if (session.mode === 'payment') {
          status =
            session.payment_status === 'paid'
              ? PaymentStatus.PAID
              : PaymentStatus.PENDING;
        } else if (session.mode === 'subscription') {
          // For subscriptions, check if payment was successful
          // Don't automatically mark as PAID - wait for subscription events
          status =
            session.payment_status === 'paid'
              ? PaymentStatus.PAID
              : PaymentStatus.PENDING;
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        providerRef = session.id;
        status = PaymentStatus.CANCELLED;
        // Extract metadata for payment lookup
        const sessionMetadata = (session.metadata as StripeMetadata) || {};
        metadata = {
          reason: 'checkout_expired',
          paymentId: sessionMetadata.paymentId,
          orderId: sessionMetadata.orderId,
          subscriptionId: sessionMetadata.subscriptionId,
          type: sessionMetadata.type,
          userId: sessionMetadata.userId,
        };
        break;
      }

      // Payment Intent events
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        providerRef = paymentIntent.id;
        status = PaymentStatus.PAID;
        metadata = {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount_received ?? paymentIntent.amount,
          currency: paymentIntent.currency,
          customerId: paymentIntent.customer,
          status: paymentIntent.status,
          type: (paymentIntent.metadata as StripeMetadata)?.type,
          orderId: (paymentIntent.metadata as StripeMetadata)?.orderId,
          paymentId: (paymentIntent.metadata as StripeMetadata)?.paymentId,
        };
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        providerRef = paymentIntent.id;
        status = PaymentStatus.FAILED;
        metadata = {
          paymentIntentId: paymentIntent.id,
          failureCode: paymentIntent.last_payment_error?.code,
          failureMessage: paymentIntent.last_payment_error?.message,
          declineCode: paymentIntent.last_payment_error?.decline_code,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          customerId: paymentIntent.customer,
          type: (paymentIntent.metadata as StripeMetadata)?.type,
          orderId: (paymentIntent.metadata as StripeMetadata)?.orderId,
          paymentId: (paymentIntent.metadata as StripeMetadata)?.paymentId,
        };
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        providerRef = paymentIntent.id;
        status = PaymentStatus.CANCELLED;
        metadata = {
          paymentIntentId: paymentIntent.id,
          reason: paymentIntent.cancellation_reason,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          customerId: paymentIntent.customer,
          type: (paymentIntent.metadata as StripeMetadata)?.type,
          orderId: (paymentIntent.metadata as StripeMetadata)?.orderId,
          paymentId: (paymentIntent.metadata as StripeMetadata)?.paymentId,
        };
        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : (charge.payment_intent as Stripe.PaymentIntent | null)?.id;
        providerRef = paymentIntentId || charge.id;
        status = PaymentStatus.PAID;

        // For charges, metadata is on the PaymentIntent, not the charge
        // We'll need to fetch it or rely on payment_intent.succeeded event
        // For now, store what we can and let the handler fetch PaymentIntent metadata
        metadata = {
          chargeId: charge.id,
          paymentIntentId: paymentIntentId,
          customerId: charge.customer,
          amount: charge.amount,
          currency: charge.currency,
          receiptUrl: charge.receipt_url,
          // Note: Charge metadata doesn't inherit PaymentIntent metadata
          // We'll resolve payment via paymentIntentId lookup in the handler
        };
        break;
      }

      // Subscription events
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        providerRef = subscription.id;
        status =
          subscription.status === 'active' || subscription.status === 'trialing'
            ? PaymentStatus.PAID
            : PaymentStatus.PENDING;
        // Extract metadata from subscription
        const subscriptionMetadata =
          (subscription.metadata as StripeMetadata) || {};
        metadata = {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          items: subscription.items,
          trialStart: subscription.trial_start,
          trialEnd: subscription.trial_end,
          // Include our custom metadata for reliable payment lookup
          paymentId: subscriptionMetadata.paymentId,
          orderId: subscriptionMetadata.orderId,
          type: subscriptionMetadata.type,
          userId: subscriptionMetadata.userId,
        };
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        providerRef = subscription.id;
        status =
          subscription.status === 'active' || subscription.status === 'trialing'
            ? PaymentStatus.PAID
            : subscription.status === 'canceled'
              ? PaymentStatus.CANCELLED
              : PaymentStatus.PENDING;
        const subscriptionMetadata =
          (subscription.metadata as StripeMetadata) || {};
        metadata = {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          canceledAt: subscription.canceled_at,
          items: subscription.items,
          // Include our custom metadata for reliable payment lookup
          paymentId: subscriptionMetadata.paymentId,
          orderId: subscriptionMetadata.orderId,
          type: subscriptionMetadata.type,
          userId: subscriptionMetadata.userId,
        };
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        providerRef = subscription.id;
        status = PaymentStatus.CANCELLED;
        const subscriptionMetadata =
          (subscription.metadata as StripeMetadata) || {};
        metadata = {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          canceledAt: subscription.canceled_at,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          // Include our custom metadata for reliable payment lookup
          paymentId: subscriptionMetadata.paymentId,
          orderId: subscriptionMetadata.orderId,
          type: subscriptionMetadata.type,
          userId: subscriptionMetadata.userId,
        };
        break;
      }

      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription;
        providerRef = subscription.id;
        status = PaymentStatus.PENDING; // or create a PAUSED status
        const subscriptionMetadata =
          (subscription.metadata as StripeMetadata) || {};
        metadata = {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          pauseCollection: subscription.pause_collection,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          // Include our custom metadata for reliable payment lookup
          paymentId: subscriptionMetadata.paymentId,
          orderId: subscriptionMetadata.orderId,
          type: subscriptionMetadata.type,
          userId: subscriptionMetadata.userId,
        };
        break;
      }

      case 'customer.subscription.resumed': {
        const subscription = event.data.object as Stripe.Subscription;
        providerRef = subscription.id;
        status = PaymentStatus.PAID;
        metadata = {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
        };
        break;
      }

      // Invoice events
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        providerRef = invoice.payment_intent as string; // Use payment_intent ID as unique identifier
        status = PaymentStatus.PAID;
        metadata = {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          paymentIntentId: invoice.payment_intent,
          customerId: invoice.customer,
          amount: invoice.amount_paid,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
          periodStart: invoice.period_start,
          periodEnd: invoice.period_end,
          status: invoice.status,
          paid: invoice.paid,
          billingReason: invoice.billing_reason,
        };
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        providerRef = invoice.payment_intent as string; // Use payment_intent ID as unique identifier
        status = PaymentStatus.FAILED;
        metadata = {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          paymentIntentId: invoice.payment_intent,
          customerId: invoice.customer,
          amount: invoice.amount_due,
          currency: invoice.currency,
          attemptCount: invoice.attempt_count,
          nextPaymentAttempt: invoice.next_payment_attempt,
          status: invoice.status,
          paid: invoice.paid,
          billingReason: invoice.billing_reason,
        };
        break;
      }

      case 'invoice.finalized': {
        const invoice = event.data.object as Stripe.Invoice;
        providerRef = invoice.payment_intent as string; // Use payment_intent ID as unique identifier
        status = PaymentStatus.PENDING;
        metadata = {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          paymentIntentId: invoice.payment_intent,
          customerId: invoice.customer,
          amount: invoice.amount_due,
          currency: invoice.currency,
          dueDate: invoice.due_date,
          status: invoice.status,
          paid: invoice.paid,
        };
        break;
      }

      // Charge events (for refunds)
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        providerRef = (charge.payment_intent as string) || charge.id;
        status = PaymentStatus.REFUNDED;
        metadata = {
          chargeId: charge.id,
          paymentIntentId: charge.payment_intent,
          customerId: charge.customer,
          amount: charge.amount,
          currency: charge.currency,
          refunded: charge.refunded,
          amountRefunded: charge.amount_refunded,
          refunds: charge.refunds,
          status: charge.status,
        };
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId =
          typeof dispute.charge === 'string'
            ? dispute.charge
            : dispute.charge.id;
        providerRef = chargeId;
        status = PaymentStatus.FAILED; // or create a DISPUTED status
        metadata = {
          disputeId: dispute.id,
          chargeId: chargeId,
          amount: dispute.amount,
          currency: dispute.currency,
          reason: dispute.reason,
          status: dispute.status,
          evidence: dispute.evidence,
        };
        break;
      }

      // Customer events
      case 'customer.created': {
        const customer = event.data.object as Stripe.Customer;
        providerRef = customer.id;
        status = PaymentStatus.PENDING;
        metadata = {
          customerId: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          created: customer.created,
          metadata: customer.metadata,
        };
        break;
      }

      default: {
        // Keep pending for unhandled events
        const obj: any = event.data.object as any;
        providerRef = obj?.id || obj?.payment_intent || obj?.subscription || '';
        status = PaymentStatus.PENDING;
        metadata = {
          unhandledEvent: true,
          eventType: event.type,
          objectType: obj?.object,
          objectId: obj?.id,
        };
        console.log(`Unhandled Stripe event: ${event.type}`, {
          objectType: obj?.object,
          objectId: obj?.id,
        });
      }
    }

    return {
      providerRef,
      status,
      raw: event,
      eventType,
      metadata,
    };
  }
}
