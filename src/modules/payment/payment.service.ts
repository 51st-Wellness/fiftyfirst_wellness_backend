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
import { SubscriptionCheckoutDto } from './dto/checkout.dto';
import { eq, and, gt, desc, sql, or } from 'drizzle-orm';
import {
  cartItems,
  products,
  storeItems,
  orders,
  orderItems,
  payments,
  subscriptions,
  subscriptionPlans,
  PaymentStatus,
  PaymentProvider as PaymentProviderEnum,
} from 'src/database/schema';
import { generateId } from 'src/database/utils';
import { User } from 'src/database/types';

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

  private async findPaymentForWebhook(webhookResult: WebhookResult) {
    // Direct payment lookup by provider reference (payment_intent ID)
    const payment = (
      await this.database.db
        .select()
        .from(payments)
        .where(eq(payments.providerRef, webhookResult.providerRef))
    )[0];

    return payment;
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
        console.warn(
          `No existing subscription found for provider subscription ID: ${webhookResult.metadata.subscriptionId}`,
        );
        return;
      }

      // Calculate new billing period
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
    console.log('user id - getCartSummary', userId);

    const items = await this.database.db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .orderBy(desc(cartItems.id));
    console.log('items', items);
    // return items;
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
      })
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .innerJoin(products, eq(cartItems.productId, products.id))
      .innerJoin(storeItems, eq(products.id, storeItems.productId));

    console.log('cartWithDetails', cartWithDetails);
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

  async checkoutCartItems(userProfile: User) {
    // Create order and initialize payment for store items
    const description = `Cart Checkout for ${userProfile.firstName}`;
    const userId = userProfile.id;

    const {
      orderItems: orderItemsData,
      totalAmount,
      currency,
      cartItems,
    } = await this.getCartSummary(userId);

    // Create order in database
    const orderId = generateId();
    await this.database.db.insert(orders).values({
      id: orderId,
      userId,
      status: PaymentStatus.PENDING,
      totalAmount,
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
    });

    // Create payment record
    const paymentId = generateId();
    await this.database.db.insert(payments).values({
      id: paymentId,
      provider: this.getProviderType(),
      providerRef: paymentInit.providerRef,
      status: PaymentStatus.PENDING,
      currency: currency as any,
      amount: totalAmount,
      metadata: {
        cartItemIds: cartItems.map((i) => i.id),
        type: 'store_checkout',
      } as any,
    });

    // Update order with payment reference
    await this.database.db
      .update(orders)
      .set({ paymentId })
      .where(eq(orders.id, orderId));

    return {
      paymentId,
      orderId,
      approvalUrl: paymentInit.approvalUrl,
      amount: totalAmount,
      currency,
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

    // Check for existing active subscription
    const existingSubscription = (
      await this.database.db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, user.id),
            eq(subscriptions.status, PaymentStatus.PAID),
            gt(subscriptions.endDate, new Date()),
          ),
        )
    )[0];

    if (existingSubscription) {
      throw new BadRequestException('User already has an active subscription');
    }

    // Calculate subscription end date
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    // Initialize payment first to get checkout session ID
    const paymentInit = await this.provider.initializePayment({
      subscriptionId: generateId(), // Temporary ID for metadata
      amount: plan.price,
      currency: 'USD',
      description: `Subscription: ${plan.name}`,
      userId: user.id,
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
    const paymentId = generateId();
    const payment = (
      await this.database.db
        .insert(payments)
        .values({
          id: paymentId,
          provider: this.getProviderType(),
          providerRef: paymentInit.providerRef,
          status: PaymentStatus.PENDING,
          currency: 'USD' as any,
          amount: plan.price,
          metadata: {
            planId,
            planName: plan.name,
            type: 'subscription',
            subscriptionId: subscription.id,
          } as any,
        })
        .returning()
    )[0];

    // Update subscription with payment reference
    await this.database.db
      .update(subscriptions)
      .set({ paymentId: payment.id })
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
      // Update payment status
      await tx
        .update(payments)
        .set({
          status: captureResult.status,
          metadata: {
            ...(payment.metadata as any),
            transactionId: captureResult.transactionId,
            capturedAt: new Date().toISOString(),
          } as any,
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
          const metadata = payment.metadata as any;
          if (metadata?.cartItemIds) {
            // Get cart items before deletion to decrement stock
            const cartItemsToProcess = await tx
              .select({
                cartItemId: cartItems.id,
                productId: cartItems.productId,
                quantity: cartItems.quantity,
              })
              .from(cartItems)
              .where(
                or(
                  ...metadata.cartItemIds.map((id: string) =>
                    eq(cartItems.id, id),
                  ),
                ),
              );

            // Decrement stock for each cart item
            for (const cartItem of cartItemsToProcess) {
              await tx
                .update(storeItems)
                .set({
                  stock: sql`${storeItems.stock} - ${cartItem.quantity}`,
                })
                .where(eq(storeItems.productId, cartItem.productId));
            }

            // Clear cart items
            for (const cartItemId of metadata.cartItemIds) {
              await tx.delete(cartItems).where(eq(cartItems.id, cartItemId));
            }
          }
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

      // Validate webhook result
      if (!webhookResult.providerRef) {
        console.warn(
          'Webhook result missing provider reference:',
          webhookResult,
        );
        return { processed: false, reason: 'Missing provider reference' };
      }

      // Handle recurring subscription webhooks (create new subscription records)
      if (webhookResult.eventType.startsWith('invoice.')) {
        await this.database.db.transaction(async (tx) => {
          // Create new subscription record for this billing cycle
          await this.handleSubscriptionWebhook(tx, webhookResult);

          // Create payment record for this invoice
          if (webhookResult.metadata?.invoiceId) {
            await tx.insert(payments).values({
              id: generateId(),
              provider: this.getProviderType(),
              providerRef: webhookResult.providerRef,
              status: webhookResult.status,
              currency: webhookResult.metadata.currency || 'USD',
              amount: webhookResult.metadata.amount / 100, // Convert from cents
              metadata: {
                invoiceId: webhookResult.metadata.invoiceId,
                subscriptionId: webhookResult.metadata.subscriptionId,
                billingReason: webhookResult.metadata.billingReason,
                type: 'subscription_invoice',
              } as any,
            });
          }
        });

        return {
          processed: true,
          paymentId: webhookResult.providerRef,
          status: webhookResult.status,
        };
      }

      // Handle regular payments (checkout sessions, one-time payments)
      let payment = await this.findPaymentForWebhook(webhookResult);

      if (!payment) {
        console.log(
          `Payment not found for provider ref: ${webhookResult.providerRef}`,
          {
            eventType: webhookResult.eventType,
            subscriptionId: webhookResult.metadata?.subscriptionId,
          },
        );
        return { processed: false, reason: 'Payment not found' };
      }

      // Update payment status if it changed
      if (payment.status !== webhookResult.status) {
        console.log(
          `Updating payment ${payment.id} status from ${payment.status} to ${webhookResult.status}`,
        );

        await this.database.db.transaction(async (tx) => {
          // Update payment status and metadata
          await tx
            .update(payments)
            .set({
              status: webhookResult.status,
              metadata: {
                ...(payment.metadata as any),
                lastWebhookEvent: webhookResult.eventType,
                lastWebhookAt: new Date().toISOString(),
                webhookMetadata: webhookResult.metadata,
              } as any,
            })
            .where(eq(payments.id, payment.id));

          // Update related orders
          await tx
            .update(orders)
            .set({ status: webhookResult.status })
            .where(eq(orders.paymentId, payment.id));

          // Update subscription status for initial checkout sessions
          if (
            webhookResult.metadata?.subscriptionId &&
            webhookResult.eventType === 'checkout.session.completed'
          ) {
            await tx
              .update(subscriptions)
              .set({
                status: webhookResult.status,
                providerSubscriptionId: webhookResult.metadata.subscriptionId,
                paymentId: payment.id,
              })
              .where(eq(subscriptions.paymentId, payment.id));
          } else {
            // Update regular subscriptions
            await tx
              .update(subscriptions)
              .set({ status: webhookResult.status })
              .where(eq(subscriptions.paymentId, payment.id));
          }
        });
      } else {
        console.log(
          `Payment ${payment.id} status unchanged: ${webhookResult.status}`,
        );
      }

      return {
        processed: true,
        paymentId: payment.id,
        status: webhookResult.status,
      };
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
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

    // Get related orders and order items
    const relatedOrders = await this.database.db
      .select()
      .from(orders)
      .where(eq(orders.paymentId, paymentId));

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
      orders: relatedOrders,
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
}
