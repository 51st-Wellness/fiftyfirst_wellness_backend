import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  PAYMENT_PROVIDER_TOKEN,
  PaymentProvider,
  WebhookResult,
} from './providers/payment.types';
import { SubscriptionCheckoutDto, CartCheckoutDto } from './dto/checkout.dto';
import { eq, and, gt, desc, sql, or, inArray } from 'drizzle-orm';
import {
  cartItems,
  products,
  storeItems,
  orders,
  orderItems,
  payments,
  subscriptions,
  subscriptionPlans,
  users,
  deliveryAddresses,
  PaymentStatus,
  PaymentProvider as PaymentProviderEnum,
} from 'src/database/schema';
import { generateId } from 'src/database/utils';
import { User } from 'src/database/types';
import { SQL } from 'drizzle-orm';

// Payment metadata type - only store what's not available via database relationships
export type PaymentMetadata =
  | StoreCheckoutPaymentMetadata
  | SubscriptionPaymentMetadata;

export type StoreCheckoutPaymentMetadata = {
  type: 'store_checkout';
  receiptUrl?: string;
  paymentIntentId?: string; // Stripe PaymentIntent ID for reference
  lastWebhookEvent?: string; // Last webhook event type received
  lastWebhookAt?: string; // ISO timestamp of last webhook
};

export type SubscriptionPaymentMetadata = {
  type: 'subscription';
  planId?: string;
  planName?: string;
  lastWebhookEvent?: string; // Last webhook event type received
  lastWebhookAt?: string; // ISO timestamp of last webhook
};

// Metadata types for webhook parsing (temporary, used only during webhook processing)
type StoreCheckoutMetadata = {
  type: 'store_checkout';
  orderId?: string;
  paymentId?: string;
  cartItemIds?: string[];
  receiptUrl?: string;
  [key: string]: any;
};

type SubscriptionMetadata = {
  type: 'subscription';
  subscriptionId?: string;
  planId?: string;
  [key: string]: any;
};

type StripeWebhookMetadata =
  | StoreCheckoutMetadata
  | SubscriptionMetadata
  | (Record<string, any> & { type?: string });

const isStoreCheckoutMetadata = (
  metadata?: StripeWebhookMetadata,
): metadata is StoreCheckoutMetadata =>
  metadata != null && metadata.type === 'store_checkout';

const isSubscriptionMetadata = (
  metadata?: StripeWebhookMetadata,
): metadata is SubscriptionMetadata =>
  metadata != null && metadata.type === 'subscription';

@Injectable()
export class PaymentService {
  constructor(
    private readonly database: DatabaseService, // Database service
    @Inject(PAYMENT_PROVIDER_TOKEN) private readonly provider: PaymentProvider, // Payment provider
  ) {}

  private getProviderType(): PaymentProviderEnum {
    // Determine provider type based on the injected provider instance
    if (this.provider.constructor.name.includes('Stripe')) {
      return PaymentProviderEnum.STRIPE;
    } else if (this.provider.constructor.name.includes('PayPal')) {
      return PaymentProviderEnum.PAYPAL;
    }
    // Default fallback
    return PaymentProviderEnum.STRIPE;
  }

  // Find payment using Stripe metadata as primary method (most reliable per Stripe docs)
  private async findPaymentForWebhook(metadata?: StripeWebhookMetadata) {
    // Primary: Use paymentId from metadata (set during checkout initialization)
    const paymentId =
      (metadata as StoreCheckoutMetadata)?.paymentId ||
      (metadata as SubscriptionMetadata)?.paymentId;
    if (paymentId) {
      const payment = (
        await this.database.db
          .select()
          .from(payments)
          .where(eq(payments.id, paymentId))
      )[0];
      if (payment) {
        console.log(
          `[Webhook] Found payment via metadata.paymentId: ${paymentId}`,
        );
        return payment;
      }
    }

    // Fallback: Use orderId from metadata
    const orderId =
      (metadata as StoreCheckoutMetadata)?.orderId ||
      (metadata as SubscriptionMetadata)?.orderId;
    if (orderId) {
      const paymentWithOrder = await this.database.db
        .select({ payment: payments })
        .from(payments)
        .innerJoin(orders, eq(orders.paymentId, payments.id))
        .where(eq(orders.id, orderId))
        .limit(1);
      if (paymentWithOrder[0]?.payment) {
        console.log(`[Webhook] Found payment via metadata.orderId: ${orderId}`);
        return paymentWithOrder[0].payment;
      }
    }

    return undefined;
  }

  private shouldIgnoreEvent(eventType: string): boolean {
    // Events that don't require payment processing
    const ignoredEvents = [
      'customer.created',
      'customer.updated',
      'customer.deleted',
      'payment_intent.created', // Only care about succeeded/failed
      'payment_method.attached',
      'setup_intent.created',
      'setup_intent.succeeded',
    ];

    return ignoredEvents.includes(eventType);
  }

  private isSubscriptionPaymentIntent(webhookResult: WebhookResult): boolean {
    // Check if this payment_intent is related to a subscription
    return (
      webhookResult.metadata?.customerId &&
      webhookResult.eventType === 'payment_intent.succeeded' &&
      // If it has setup_future_usage, it's likely a subscription
      (webhookResult.raw?.data?.object?.setup_future_usage === 'off_session' ||
        webhookResult.raw?.data?.object?.description?.includes('Subscription'))
    );
  }

  private async handleInvoiceWebhook(webhookResult: WebhookResult) {
    try {
      await this.database.db.transaction(async (tx) => {
        // Create new subscription record for this billing cycle
        await this.handleSubscriptionWebhook(tx, webhookResult);

        // Create payment record for this invoice (recurring subscription payment)
        if (webhookResult.metadata?.invoiceId) {
          await tx.insert(payments).values({
            id: generateId(),
            provider: this.getProviderType(),
            providerRef: webhookResult.providerRef,
            status: webhookResult.status,
            currency: webhookResult.metadata.currency || 'USD',
            amount: webhookResult.metadata.amount / 100, // Convert from cents
            metadata: {
              type: 'subscription',
              // invoiceId, subscriptionId, billingReason are not stored in metadata
              // as they can be retrieved from the payment record or related subscription
            } as PaymentMetadata,
          });
        }
      });

      return {
        processed: true,
        paymentId: webhookResult.providerRef,
        status: webhookResult.status,
      };
    } catch (error) {
      console.error('Invoice webhook processing error:', error);
      return { processed: false, reason: 'Invoice processing failed' };
    }
  }

  private async handleSubscriptionWebhook(
    tx: any,
    webhookResult: WebhookResult,
  ) {
    // Only handle invoice events for recurring subscriptions
    if (
      !webhookResult.eventType.startsWith('invoice.') ||
      !webhookResult.metadata?.subscriptionId
    ) {
      return;
    }

    // For invoice events, create a new subscription record (transaction history)
    if (
      webhookResult.eventType === 'invoice.payment_succeeded' ||
      webhookResult.eventType === 'invoice.payment_failed'
    ) {
      // Get the latest subscription to determine billing cycle and user info
      const latestSubscription = (
        await this.database.db
          .select()
          .from(subscriptions)
          .where(
            eq(
              subscriptions.providerSubscriptionId,
              webhookResult.metadata.subscriptionId,
            ),
          )
          .orderBy(desc(subscriptions.createdAt))
          .limit(1)
      )[0];

      if (!latestSubscription) {
        // This might be the first invoice for a subscription created via checkout
        // Try to find subscription by checking for checkout sessions with this subscription ID
        const checkoutSubscription = (
          await this.database.db
            .select()
            .from(subscriptions)
            .innerJoin(payments, eq(subscriptions.paymentId, payments.id))
            .where(
              and(
                eq(payments.provider, 'STRIPE'),
                sql`JSON_EXTRACT(${payments.metadata}, '$.subscriptionId') = ${webhookResult.metadata.subscriptionId}`,
              ),
            )
            .orderBy(desc(subscriptions.createdAt))
            .limit(1)
        )[0];

        if (!checkoutSubscription) {
          console.warn(
            `No existing subscription found for provider subscription ID: ${webhookResult.metadata.subscriptionId}`,
          );
          return;
        }

        // Update the existing subscription with provider subscription ID
        await tx
          .update(subscriptions)
          .set({
            providerSubscriptionId: webhookResult.metadata.subscriptionId,
            status: webhookResult.status,
          })
          .where(eq(subscriptions.id, checkoutSubscription.Subscription.id));

        console.log(
          `Updated existing subscription ${checkoutSubscription.Subscription.id} with provider subscription ID`,
        );
        return;
      }

      // Calculate new billing period for recurring payment
      const periodStart = new Date(webhookResult.metadata.periodStart * 1000);
      const periodEnd = new Date(webhookResult.metadata.periodEnd * 1000);
      const nextBillingCycle = latestSubscription.billingCycle + 1;

      // Create new subscription record for this billing cycle
      const newSubscriptionId = webhookResult.providerRef; // Use payment_intent ID

      await tx.insert(subscriptions).values({
        id: newSubscriptionId,
        userId: latestSubscription.userId,
        planId: latestSubscription.planId,
        status: webhookResult.status,
        startDate: periodStart,
        endDate: periodEnd,
        autoRenew: latestSubscription.autoRenew,
        paymentId: null, // Will be linked when payment is created
        providerSubscriptionId: webhookResult.metadata.subscriptionId,
        invoiceId: webhookResult.metadata.invoiceId,
        billingCycle: nextBillingCycle,
      });

      console.log(
        `Created new subscription record ${newSubscriptionId} for billing cycle ${nextBillingCycle}`,
      );
    }
  }

  private async getCartSummary(userId: string) {
    // Fetch cart items with store item details in a single optimized query
    const cartWithDetails = await this.database.db
      .select({
        cartItemId: cartItems.id,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        productType: products.type,
        storeItemName: storeItems.name,
        storeItemPrice: storeItems.price,
        storeItemStock: storeItems.stock,
        storeItemIsPublished: storeItems.isPublished,
        storeItemDisplay: storeItems.display,
      })
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .innerJoin(products, eq(cartItems.productId, products.id))
      .innerJoin(storeItems, eq(products.id, storeItems.productId));

    if (cartWithDetails.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Validate cart items and filter out invalid ones
    const validItems: any[] = [];
    const invalidItems: string[] = [];

    for (const item of cartWithDetails) {
      // Check if item is published

      if (!item.storeItemIsPublished) {
        invalidItems.push(
          `Product ${item.storeItemName} is no longer available`,
        );
        continue;
      }

      // Check stock availability
      if (item.storeItemStock == null || item.storeItemStock < item.quantity) {
        invalidItems.push(
          `Insufficient stock for ${item.storeItemName}. Available: ${item.storeItemStock || 0}, Requested: ${item.quantity}`,
        );
        continue;
      }

      validItems.push(item);
    }

    // Throw error if any invalid items found
    if (invalidItems.length > 0) {
      throw new BadRequestException(
        `Cart contains invalid items: ${invalidItems.join(', ')}`,
      );
    }

    // Calculate order items data and totals
    const currency = 'USD'; // Default currency
    const orderItemsData = validItems.map((item) => ({
      productId: item.productId,
      name: item.storeItemName,
      quantity: item.quantity,
      unitPrice: item.storeItemPrice,
      lineTotal: item.quantity * item.storeItemPrice,
      image: item.storeItemDisplay,
    }));

    const totalAmount = orderItemsData.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );

    // Prepare cart items data for metadata
    const cartItemsData = validItems.map((item) => ({
      id: item.cartItemId,
      productId: item.productId,
      quantity: item.quantity,
      userId: userId,
    }));

    return {
      orderItems: orderItemsData,
      totalAmount,
      currency,
      cartItems: cartItemsData,
      itemCount: validItems.length,
      summary: {
        subtotal: totalAmount,
        currency,
        itemCount: validItems.length,
        totalQuantity: orderItemsData.reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
      },
    };
  }

  async previewCartCheckout(userProfile: User) {
    // Build checkout preview for the current user's cart
    const summary = await this.getCartSummary(userProfile.id);

    // Get user's delivery addresses (not soft deleted)
    const addresses = await this.database.db
      .select()
      .from(deliveryAddresses)
      .where(
        and(
          eq(deliveryAddresses.userId, userProfile.id),
          sql`${deliveryAddresses.deletedAt} IS NULL`,
        ),
      )
      .orderBy(
        desc(deliveryAddresses.isDefault),
        desc(deliveryAddresses.createdAt),
      );

    return {
      ...summary,
      deliveryAddresses: addresses,
    };
  }

  async checkoutCartItems(userProfile: User, cartCheckoutDto: CartCheckoutDto) {
    // Create order and initialize payment for store items
    const description = `Cart Checkout for ${userProfile.firstName}`;
    const userId = userProfile.id;

    const paymentId = generateId();

    const {
      orderItems: orderItemsData,
      totalAmount,
      currency,
      cartItems,
    } = await this.getCartSummary(userId);

    // Handle delivery address
    let deliveryAddressId: string | undefined;

    if (cartCheckoutDto.deliveryAddressId) {
      // Use existing address - verify it belongs to user and is not deleted
      const existingAddress = (
        await this.database.db
          .select()
          .from(deliveryAddresses)
          .where(
            and(
              eq(deliveryAddresses.id, cartCheckoutDto.deliveryAddressId),
              eq(deliveryAddresses.userId, userId),
              sql`${deliveryAddresses.deletedAt} IS NULL`,
            ),
          )
          .limit(1)
      )[0];

      if (!existingAddress) {
        throw new BadRequestException('Invalid delivery address');
      }

      deliveryAddressId = existingAddress.id;
    } else if (
      cartCheckoutDto.contactName &&
      cartCheckoutDto.contactPhone &&
      cartCheckoutDto.deliveryAddress &&
      cartCheckoutDto.deliveryCity
    ) {
      // Create new delivery address if saveAddress is true
      if (cartCheckoutDto.saveAddress) {
        const newAddressId = generateId();
        await this.database.db.insert(deliveryAddresses).values({
          id: newAddressId,
          userId,
          contactName: cartCheckoutDto.contactName,
          contactPhone: cartCheckoutDto.contactPhone,
          deliveryAddress: cartCheckoutDto.deliveryAddress,
          deliveryCity: cartCheckoutDto.deliveryCity,
          deliveryInstructions: cartCheckoutDto.deliveryInstructions,
          isDefault: false,
        });
        deliveryAddressId = newAddressId;
      } else {
        // Create temporary address for this order only (not saved)
        const tempAddressId = generateId();
        await this.database.db.insert(deliveryAddresses).values({
          id: tempAddressId,
          userId,
          contactName: cartCheckoutDto.contactName,
          contactPhone: cartCheckoutDto.contactPhone,
          deliveryAddress: cartCheckoutDto.deliveryAddress,
          deliveryCity: cartCheckoutDto.deliveryCity,
          deliveryInstructions: cartCheckoutDto.deliveryInstructions,
          isDefault: false,
        });
        deliveryAddressId = tempAddressId;
      }
    } else {
      throw new BadRequestException(
        'Delivery address is required. Provide deliveryAddressId or custom address details.',
      );
    }

    // Create order in database
    const orderId = generateId();
    await this.database.db.insert(orders).values({
      id: orderId,
      userId,
      status: PaymentStatus.PENDING,
      totalAmount,
      deliveryAddressId,
    });
    await this.database.db.insert(orderItems).values(
      orderItemsData.map((item) => ({
        id: generateId(),
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: item.unitPrice,
      })),
    );

    // Initialize payment with provider
    const paymentInit = await this.provider.initializePayment({
      orderId: orderId,
      amount: totalAmount,
      currency,
      description: description || 'Store Checkout',
      items: orderItemsData,
      userId,
      paymentId,
    });

    // Create payment record
    await this.database.db.insert(payments).values({
      id: paymentId,
      provider: this.getProviderType(),
      providerRef: paymentInit.providerRef,
      status: PaymentStatus.PENDING,
      currency: currency as any,
      amount: totalAmount,
      metadata: {
        type: 'store_checkout',
      } as PaymentMetadata,
    });

    // Update order with payment reference
    await this.database.db
      .update(orders)
      .set({ paymentId })
      .where(eq(orders.id, orderId));

    // Get delivery address for response
    const deliveryAddress = deliveryAddressId
      ? (
          await this.database.db
            .select()
            .from(deliveryAddresses)
            .where(eq(deliveryAddresses.id, deliveryAddressId))
            .limit(1)
        )[0]
      : null;

    return {
      paymentId,
      orderId,
      approvalUrl: paymentInit.approvalUrl,
      amount: totalAmount,
      currency,
      deliveryAddress,
    };
  }

  async createSubscriptionCheckout(
    subscriptionDto: SubscriptionCheckoutDto,
    user: User,
  ) {
    // Create subscription and initialize payment
    const { planId } = subscriptionDto;

    // Validate subscription plan exists and is active
    const plan = (
      await this.database.db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
    )[0];
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    if (!plan.isActive) {
      throw new BadRequestException('Subscription plan is not active');
    }

    // // Check for existing active subscription
    // const existingSubscription = (
    //   await this.database.db
    //     .select()
    //     .from(subscriptions)
    //     .where(
    //       and(
    //         eq(subscriptions.userId, user.id),
    //         eq(subscriptions.status, PaymentStatus.PAID),
    //         gt(subscriptions.endDate, new Date()),
    //       ),
    //     )
    // )[0];

    // if (existingSubscription) {
    //   throw new BadRequestException('User already has an active subscription');
    // }

    // Calculate subscription end date
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    // Initialize payment first to get checkout session ID
    const paymentId = generateId();

    const paymentInit = await this.provider.initializePayment({
      subscriptionId: generateId(), // Temporary ID for metadata
      amount: plan.price,
      currency: 'USD',
      description: `Subscription: ${plan.name}`,
      userId: user.id,
      paymentId,
    });

    // Create subscription using checkout session ID as primary key
    const subscription = (
      await this.database.db
        .insert(subscriptions)
        .values({
          id: paymentInit.providerRef, // Use checkout session ID
          userId: user.id,
          planId,
          status: PaymentStatus.PENDING,
          startDate,
          endDate,
          billingCycle: 1, // First billing cycle
        })
        .returning()
    )[0];

    // Payment initialization already done above

    // Create payment record
    await this.database.db.insert(payments).values({
      id: paymentId,
      provider: this.getProviderType(),
      providerRef: paymentInit.providerRef,
      status: PaymentStatus.PENDING,
      currency: 'USD' as any,
      amount: plan.price,
      metadata: {
        type: 'subscription',
        planId,
        planName: plan.name,
      } as PaymentMetadata,
    });

    // Update subscription with payment reference
    await this.database.db
      .update(subscriptions)
      .set({ paymentId: paymentId })
      .where(eq(subscriptions.id, subscription.id));

    return {
      paymentId,
      subscriptionId: subscription.id,
      approvalUrl: paymentInit.approvalUrl,
      amount: plan.price,
      currency: 'USD',
      planName: plan.name,
    };
  }

  async capturePayment(providerRef: string) {
    // Capture payment after user approval
    const payment = (
      await this.database.db
        .select()
        .from(payments)
        .where(eq(payments.providerRef, providerRef))
    )[0];

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Capture payment with provider
    const captureResult = await this.provider.capturePayment(providerRef);

    // Update payment and related entities in transaction
    await this.database.db.transaction(async (tx) => {
      // Update payment status (keep existing metadata structure)
      const currentMetadata =
        (payment.metadata as PaymentMetadata) ||
        (payment.metadata &&
        typeof payment.metadata === 'object' &&
        'type' in payment.metadata
          ? (payment.metadata as PaymentMetadata)
          : ({ type: 'store_checkout' } as PaymentMetadata));
      await tx
        .update(payments)
        .set({
          status: captureResult.status,
          metadata: currentMetadata, // Don't store transactionId/capturedAt in metadata
        })
        .where(eq(payments.id, payment.id));

      // Handle successful payment
      if (captureResult.status === 'PAID') {
        // Get related orders
        const relatedOrders = await tx
          .select()
          .from(orders)
          .where(eq(orders.paymentId, payment.id));

        // Update all related orders
        if (relatedOrders.length > 0) {
          await tx
            .update(orders)
            .set({ status: PaymentStatus.PAID })
            .where(eq(orders.paymentId, payment.id));

          // Clear user's cart for store purchases and decrement stock
          // Use order-based approach (same as webhook handler)
          await this.finalizeStoreCheckout(tx, payment.id);
        }

        // Get and update all related subscriptions
        const relatedSubscriptions = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.paymentId, payment.id));

        if (relatedSubscriptions.length > 0) {
          await tx
            .update(subscriptions)
            .set({ status: PaymentStatus.PAID })
            .where(eq(subscriptions.paymentId, payment.id));
        }
      }
    });

    // Get related entities for response
    const relatedOrders = await this.database.db
      .select()
      .from(orders)
      .where(eq(orders.paymentId, payment.id));
    const relatedSubscriptions = await this.database.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.paymentId, payment.id));

    return {
      status: captureResult.status,
      paymentId: payment.id,
      orderIds: relatedOrders.map((order) => order.id),
      subscriptionIds: relatedSubscriptions.map(
        (subscription) => subscription.id,
      ),
    };
  }

  async handleWebhook(
    headers: Record<string, string>,
    rawBody: any,
    parsedBody?: any,
  ) {
    // Handle webhook from payment provider
    try {
      // Verify webhook signature using raw body
      const isValid = await this.provider.verifyWebhook(headers, rawBody);
      if (!isValid) {
        console.warn('Invalid webhook signature received');
        throw new BadRequestException('Invalid webhook signature');
      }

      // Parse webhook payload using parsed body if available, otherwise raw body
      const bodyForParsing = parsedBody || rawBody;
      const webhookResult: WebhookResult =
        this.provider.parseWebhook(bodyForParsing);

      console.log('bodyForParsing', bodyForParsing);
      console.log('webhookResult', webhookResult);
      // Validate webhook result
      if (!webhookResult.providerRef) {
        console.warn(
          'Webhook result missing provider reference:',
          webhookResult,
        );
        return { processed: false, reason: 'Missing provider reference' };
      }

      // Handle events that don't require existing payments
      if (this.shouldIgnoreEvent(webhookResult.eventType)) {
        console.log('Stripe webhook ignored by configuration', {
          eventType: webhookResult.eventType,
        });
        return { processed: true, reason: 'Event ignored' };
      }

      const metadata = webhookResult.metadata as
        | StripeWebhookMetadata
        | undefined;

      // For charge.succeeded, we need to fetch PaymentIntent metadata
      // since charge doesn't inherit PaymentIntent metadata per Stripe docs
      let resolvedMetadata = metadata;
      if (
        webhookResult.eventType === 'charge.succeeded' &&
        (metadata as any)?.paymentIntentId &&
        this.provider.fetchPaymentIntentMetadata
      ) {
        try {
          const paymentIntentId = (metadata as any)?.paymentIntentId;
          const paymentIntentMetadata =
            await this.provider.fetchPaymentIntentMetadata(paymentIntentId);
          if (paymentIntentMetadata) {
            resolvedMetadata = {
              ...metadata,
              paymentId: paymentIntentMetadata.paymentId,
              orderId: paymentIntentMetadata.orderId,
              type: paymentIntentMetadata.type,
            } as StripeWebhookMetadata;
            console.log(
              `[Webhook] Fetched PaymentIntent metadata for charge: ${paymentIntentId}`,
              { paymentId: paymentIntentMetadata.paymentId },
            );
          }
        } catch (error) {
          console.error(
            `[Webhook] Failed to fetch PaymentIntent metadata:`,
            error,
          );
        }
      }

      const existingPayment =
        await this.findPaymentForWebhook(resolvedMetadata);
      const paymentMetadataType =
        (existingPayment?.metadata as any)?.type ?? undefined;
      const inferredType = (metadata?.type ?? paymentMetadataType) as
        | 'store_checkout'
        | 'subscription'
        | undefined;

      if (inferredType === 'store_checkout') {
        // StoreCheckoutMetadata is only used for webhook parsing, not stored in DB
        const storeMetadata: StoreCheckoutMetadata = {
          type: 'store_checkout',
          orderId:
            (metadata as StoreCheckoutMetadata | undefined)?.orderId ??
            undefined,
          paymentId:
            (metadata as StoreCheckoutMetadata | undefined)?.paymentId ??
            undefined,
          receiptUrl: (
            existingPayment?.metadata as StoreCheckoutPaymentMetadata
          )?.receiptUrl,
        };
        return await this.handleStoreCheckoutWebhook(
          webhookResult,
          storeMetadata,
          existingPayment,
        );
      }

      if (
        inferredType === 'subscription' ||
        this.isSubscriptionEvent(webhookResult.eventType)
      ) {
        return await this.handleSubscriptionWebhookEvent(
          webhookResult,
          existingPayment,
        );
      }

      console.log('Stripe webhook ignored (no matching handler)', {
        eventType: webhookResult.eventType,
        metadataType: metadata?.type,
      });
      return { processed: true, reason: 'Unhandled webhook type' };
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  private async handleStoreCheckoutWebhook(
    webhookResult: WebhookResult,
    metadata: StoreCheckoutMetadata,
    existingPayment?: any,
  ) {
    const payment =
      existingPayment ?? (await this.findPaymentForWebhook(metadata));

    if (!payment) {
      console.log('Store checkout payment not found for webhook', {
        eventType: webhookResult.eventType,
        providerRef: webhookResult.providerRef,
        metadata,
      });
      return { processed: false, reason: 'Payment not found' };
    }

    switch (webhookResult.eventType) {
      case 'payment_intent.succeeded': {
        await this.database.db.transaction(async (tx) => {
          const currentMetadata =
            (payment.metadata as StoreCheckoutPaymentMetadata) || {
              type: 'store_checkout',
            };
          const updatedMetadata: StoreCheckoutPaymentMetadata = {
            ...currentMetadata,
            lastWebhookEvent: webhookResult.eventType,
            lastWebhookAt: new Date().toISOString(),
            paymentIntentId: webhookResult.providerRef,
          };

          await tx
            .update(payments)
            .set({
              status: PaymentStatus.PAID,
              providerRef: webhookResult.providerRef,
              metadata: updatedMetadata as PaymentMetadata,
            })
            .where(eq(payments.id, payment.id));

          await tx
            .update(orders)
            .set({ status: PaymentStatus.PAID })
            .where(eq(orders.paymentId, payment.id));

          // Get cart items from order instead of metadata
          await this.finalizeStoreCheckout(tx, payment.id);
        });

        return {
          processed: true,
          paymentId: payment.id,
          status: PaymentStatus.PAID,
        };
      }

      case 'charge.succeeded': {
        const receiptUrl = (webhookResult.metadata as any)?.receiptUrl;
        const paymentIntentId = (webhookResult.metadata as any)
          ?.paymentIntentId;
        const currentMetadata =
          (payment.metadata as StoreCheckoutPaymentMetadata) || {
            type: 'store_checkout',
          };
        const updatedMetadata: StoreCheckoutPaymentMetadata = {
          ...currentMetadata,
          receiptUrl,
          lastWebhookEvent: webhookResult.eventType,
          lastWebhookAt: new Date().toISOString(),
          ...(paymentIntentId && { paymentIntentId }),
        };

        // Update payment with receipt URL and PaymentIntent ID as providerRef
        await this.database.db
          .update(payments)
          .set({
            metadata: updatedMetadata as PaymentMetadata,
            // Update providerRef to PaymentIntent ID if available (more reliable than session ID)
            ...(paymentIntentId && { providerRef: paymentIntentId }),
          })
          .where(eq(payments.id, payment.id));

        console.log(
          `[Webhook] Updated payment ${payment.id} with receipt URL and PaymentIntent ID`,
        );

        return {
          processed: true,
          paymentId: payment.id,
          status: payment.status,
        };
      }

      case 'payment_intent.canceled': {
        await this.database.db.transaction(async (tx) => {
          const currentMetadata =
            (payment.metadata as StoreCheckoutPaymentMetadata) || {
              type: 'store_checkout',
            };
          const updatedMetadata: StoreCheckoutPaymentMetadata = {
            ...currentMetadata,
            lastWebhookEvent: webhookResult.eventType,
            lastWebhookAt: new Date().toISOString(),
          };

          await tx
            .update(payments)
            .set({
              status: PaymentStatus.CANCELLED,
              providerRef: webhookResult.providerRef,
              metadata: updatedMetadata as PaymentMetadata,
            })
            .where(eq(payments.id, payment.id));

          await tx
            .update(orders)
            .set({ status: PaymentStatus.CANCELLED })
            .where(eq(orders.paymentId, payment.id));
        });

        return {
          processed: true,
          paymentId: payment.id,
          status: PaymentStatus.CANCELLED,
        };
      }

      case 'checkout.session.expired': {
        const currentMetadata =
          (payment.metadata as PaymentMetadata) ||
          (payment.metadata &&
          typeof payment.metadata === 'object' &&
          'type' in payment.metadata
            ? (payment.metadata as PaymentMetadata)
            : ({ type: 'store_checkout' } as PaymentMetadata));
        const updatedMetadata: PaymentMetadata = {
          ...currentMetadata,
          lastWebhookEvent: webhookResult.eventType,
          lastWebhookAt: new Date().toISOString(),
        };

        await this.database.db
          .update(payments)
          .set({
            status: PaymentStatus.CANCELLED,
            metadata: updatedMetadata,
          })
          .where(eq(payments.id, payment.id));

        await this.database.db
          .update(orders)
          .set({ status: PaymentStatus.CANCELLED })
          .where(eq(orders.paymentId, payment.id));

        return {
          processed: true,
          paymentId: payment.id,
          status: PaymentStatus.CANCELLED,
        };
      }

      default:
        console.log('Store checkout webhook ignored', {
          eventType: webhookResult.eventType,
          providerRef: webhookResult.providerRef,
        });
        return { processed: true, reason: 'Store checkout event ignored' };
    }
  }

  // Get cart items from order and finalize checkout (decrement stock, clear cart)
  private async finalizeStoreCheckout(
    tx: any,
    paymentId: string,
  ): Promise<void> {
    // Get order for this payment
    const order = (
      await tx
        .select()
        .from(orders)
        .where(eq(orders.paymentId, paymentId))
        .limit(1)
    )[0];

    if (!order) {
      console.warn(
        `[finalizeStoreCheckout] No order found for payment ${paymentId}`,
      );
      return;
    }

    // Get order items
    const orderItemsList = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    if (orderItemsList.length === 0) {
      console.warn(
        `[finalizeStoreCheckout] No order items found for order ${order.id}`,
      );
      return;
    }

    // Decrement stock for each product
    for (const orderItem of orderItemsList) {
      await tx
        .update(storeItems)
        .set({
          stock: sql`${storeItems.stock} - ${orderItem.quantity}`,
        })
        .where(eq(storeItems.productId, orderItem.productId));
    }

    // Get and delete cart items for this user matching the order items
    const productIds = orderItemsList.map((item) => item.productId);
    const userCartItems = await tx
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.userId, order.userId),
          inArray(cartItems.productId, productIds),
        ),
      );

    if (userCartItems.length > 0) {
      const cartItemIds = userCartItems.map((item) => item.id);
      await tx.delete(cartItems).where(inArray(cartItems.id, cartItemIds));
    }
  }

  private async handleSubscriptionWebhookEvent(
    webhookResult: WebhookResult,
    existingPayment?: any,
  ) {
    if (webhookResult.eventType.startsWith('invoice.')) {
      return await this.handleInvoiceWebhook(webhookResult);
    }

    if (this.isSubscriptionPaymentIntent(webhookResult)) {
      console.log(
        `Ignoring subscription payment_intent: ${webhookResult.providerRef}`,
      );
      return {
        processed: true,
        reason: 'Subscription payment_intent ignored',
      };
    }

    const payment =
      existingPayment ??
      (await this.findPaymentForWebhook(
        webhookResult.metadata as StripeWebhookMetadata | undefined,
      ));

    if (!payment) {
      console.log(
        `Payment not found for provider ref: ${webhookResult.providerRef}`,
        {
          eventType: webhookResult.eventType,
          metadata: webhookResult.metadata,
        },
      );
      return { processed: false, reason: 'Payment not found' };
    }

    if (payment.status === webhookResult.status) {
      console.log(
        `Payment ${payment.id} status unchanged: ${webhookResult.status}`,
      );
      return {
        processed: true,
        paymentId: payment.id,
        status: payment.status,
      };
    }

    await this.database.db.transaction(async (tx) => {
      const currentMetadata =
        (payment.metadata as SubscriptionPaymentMetadata) || {
          type: 'subscription',
        };
      const updatedMetadata: SubscriptionPaymentMetadata = {
        ...currentMetadata,
        lastWebhookEvent: webhookResult.eventType,
        lastWebhookAt: new Date().toISOString(),
      };

      await tx
        .update(payments)
        .set({
          status: webhookResult.status,
          providerRef: webhookResult.providerRef || payment.providerRef,
          metadata: updatedMetadata as PaymentMetadata,
        })
        .where(eq(payments.id, payment.id));

      await tx
        .update(orders)
        .set({ status: webhookResult.status })
        .where(eq(orders.paymentId, payment.id));

      await this.updateSubscriptionStatusForWebhook(
        tx,
        payment.id,
        webhookResult,
      );
    });

    return {
      processed: true,
      paymentId: payment.id,
      status: webhookResult.status,
    };
  }

  private async updateSubscriptionStatusForWebhook(
    tx: any,
    paymentId: string,
    webhookResult: WebhookResult,
  ) {
    if (
      webhookResult.metadata?.type === 'subscription' ||
      webhookResult.metadata?.subscriptionId ||
      webhookResult.eventType.startsWith('customer.subscription') ||
      webhookResult.eventType.startsWith('invoice.payment')
    ) {
      if (
        webhookResult.eventType === 'checkout.session.completed' &&
        webhookResult.metadata?.subscriptionId
      ) {
        await tx
          .update(subscriptions)
          .set({
            status: webhookResult.status,
            providerSubscriptionId: webhookResult.metadata.subscriptionId,
            paymentId,
          })
          .where(eq(subscriptions.paymentId, paymentId));
      } else if (webhookResult.eventType.startsWith('customer.subscription')) {
        const subscriptionId = webhookResult.metadata?.subscriptionId;
        if (subscriptionId) {
          await tx
            .update(subscriptions)
            .set({ status: webhookResult.status })
            .where(eq(subscriptions.providerSubscriptionId, subscriptionId));
        }
      } else if (webhookResult.eventType.startsWith('invoice.payment')) {
        const subscriptionId = webhookResult.metadata?.subscriptionId;
        if (subscriptionId) {
          await tx
            .update(subscriptions)
            .set({ status: webhookResult.status })
            .where(eq(subscriptions.providerSubscriptionId, subscriptionId));
        }
      } else {
        await tx
          .update(subscriptions)
          .set({ status: webhookResult.status })
          .where(eq(subscriptions.paymentId, paymentId));
      }
    }
  }

  private isSubscriptionEvent(eventType: string): boolean {
    return (
      eventType.startsWith('invoice.') ||
      eventType.startsWith('customer.subscription') ||
      eventType.startsWith('checkout.session')
    );
  }

  async getPaymentStatus(paymentId: string) {
    // Get payment status by ID
    const payment = (
      await this.database.db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
    )[0];

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Get related orders with delivery addresses
    const relatedOrders = await this.database.db
      .select({
        id: orders.id,
        userId: orders.userId,
        status: orders.status,
        totalAmount: orders.totalAmount,
        paymentId: orders.paymentId,
        deliveryAddressId: orders.deliveryAddressId,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        // Delivery address fields
        deliveryContactName: deliveryAddresses.contactName,
        deliveryContactPhone: deliveryAddresses.contactPhone,
        deliveryAddress: deliveryAddresses.deliveryAddress,
        deliveryCity: deliveryAddresses.deliveryCity,
        deliveryInstructions: deliveryAddresses.deliveryInstructions,
      })
      .from(orders)
      .leftJoin(
        deliveryAddresses,
        eq(orders.deliveryAddressId, deliveryAddresses.id),
      )
      .where(eq(orders.paymentId, paymentId));

    const orderIds = relatedOrders.map((order) => order.id);
    let orderItemsWithStore: {
      id: string;
      orderId: string;
      productId: string;
      quantity: number;
      price: number;
      storeItemName: string | null;
      storeItemImage: any | null;
    }[] = [];

    if (orderIds.length > 0) {
      orderItemsWithStore = await this.database.db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          quantity: orderItems.quantity,
          price: orderItems.price,
          storeItemName: storeItems.name,
          storeItemImage: storeItems.display,
        })
        .from(orderItems)
        .leftJoin(storeItems, eq(orderItems.productId, storeItems.productId))
        .where(inArray(orderItems.orderId, orderIds));
    }

    const ordersWithItems = relatedOrders.map((order) => {
      const items = orderItemsWithStore.filter(
        (item) => item.orderId === order.id,
      );
      return {
        id: order.id,
        userId: order.userId,
        status: order.status,
        totalAmount: order.totalAmount,
        paymentId: order.paymentId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items,
        deliveryAddress: order.deliveryAddressId
          ? {
              id: order.deliveryAddressId,
              contactName: order.deliveryContactName,
              contactPhone: order.deliveryContactPhone,
              deliveryAddress: order.deliveryAddress,
              deliveryCity: order.deliveryCity,
              deliveryInstructions: order.deliveryInstructions,
            }
          : null,
      };
    });

    // Get related subscriptions with plan details
    const relatedSubscriptions = await this.database.db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        planId: subscriptions.planId,
        status: subscriptions.status,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        paymentId: subscriptions.paymentId,
        planName: subscriptionPlans.name,
        planPrice: subscriptionPlans.price,
        planDuration: subscriptionPlans.duration,
      })
      .from(subscriptions)
      .leftJoin(
        subscriptionPlans,
        eq(subscriptions.planId, subscriptionPlans.id),
      )
      .where(eq(subscriptions.paymentId, paymentId));

    // Build enriched payment object
    const enrichedPayment = {
      ...payment,
      orders: ordersWithItems,
      subscriptions: relatedSubscriptions,
    };

    return enrichedPayment;
  }

  async getUserSubscriptionStatus(userId: string) {
    // Get current subscription status for a user
    const latestSubscription = (
      await this.database.db
        .select({
          id: subscriptions.id,
          planId: subscriptions.planId,
          status: subscriptions.status,
          startDate: subscriptions.startDate,
          endDate: subscriptions.endDate,
          billingCycle: subscriptions.billingCycle,
          providerSubscriptionId: subscriptions.providerSubscriptionId,
          planName: subscriptionPlans.name,
          planPrice: subscriptionPlans.price,
        })
        .from(subscriptions)
        .leftJoin(
          subscriptionPlans,
          eq(subscriptions.planId, subscriptionPlans.id),
        )
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1)
    )[0];

    if (!latestSubscription) {
      return { hasSubscription: false, isActive: false };
    }

    const now = new Date();
    const isActive =
      latestSubscription.status === PaymentStatus.PAID &&
      latestSubscription.startDate <= now &&
      latestSubscription.endDate >= now;

    return {
      hasSubscription: true,
      isActive,
      subscription: latestSubscription,
    };
  }

  async getUserSubscriptionHistory(userId: string) {
    // Get complete subscription history for a user
    return await this.database.db
      .select({
        id: subscriptions.id,
        planId: subscriptions.planId,
        status: subscriptions.status,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        billingCycle: subscriptions.billingCycle,
        providerSubscriptionId: subscriptions.providerSubscriptionId,
        invoiceId: subscriptions.invoiceId,
        createdAt: subscriptions.createdAt,
        planName: subscriptionPlans.name,
        planPrice: subscriptionPlans.price,
      })
      .from(subscriptions)
      .leftJoin(
        subscriptionPlans,
        eq(subscriptions.planId, subscriptionPlans.id),
      )
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async getAllSubscriptions(params: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }) {
    // Get all subscriptions with user details for admin
    const { page, limit, status, search } = params;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions: SQL<unknown>[] = [];
    if (status) {
      whereConditions.push(eq(subscriptions.status, status as PaymentStatus));
    }
    if (search) {
      whereConditions.push(
        or(
          sql`${users.firstName} || ' ' || ${users.lastName} LIKE ${'%' + search + '%'}`,
          sql`${users.email} LIKE ${'%' + search + '%'}`,
          sql`${subscriptionPlans.name} LIKE ${'%' + search + '%'}`,
        ) as SQL<unknown>,
      );
    }
    // Get total count
    const totalCount = await this.database.db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.userId, users.id))
      .leftJoin(
        subscriptionPlans,
        eq(subscriptions.planId, subscriptionPlans.id),
      )
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    // Get paginated results
    const subscriptionsData = await this.database.db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        planId: subscriptions.planId,
        status: subscriptions.status,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        autoRenew: subscriptions.autoRenew,
        paymentId: subscriptions.paymentId,
        providerSubscriptionId: subscriptions.providerSubscriptionId,
        invoiceId: subscriptions.invoiceId,
        billingCycle: subscriptions.billingCycle,
        createdAt: subscriptions.createdAt,
        // User details
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        userPhone: users.phone,
        // Plan details
        planName: subscriptionPlans.name,
        planPrice: subscriptionPlans.price,
        planDuration: subscriptionPlans.duration,
        planDescription: subscriptionPlans.description,
      })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.userId, users.id))
      .leftJoin(
        subscriptionPlans,
        eq(subscriptions.planId, subscriptionPlans.id),
      )
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(subscriptions.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      subscriptions: subscriptionsData,
      pagination: {
        page,
        limit,
        total: totalCount[0]?.count || 0,
        totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
      },
    };
  }
}
