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
import { eq, and, gt, desc } from 'drizzle-orm';
import {
  users,
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
import { ProductType } from 'src/database/schema';

@Injectable()
export class PaymentService {
  constructor(
    private readonly database: DatabaseService, // Database service
    @Inject(PAYMENT_PROVIDER_TOKEN) private readonly provider: PaymentProvider, // Payment provider
  ) {}

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
      provider: PaymentProviderEnum.STRIPE,
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
      orderId,
      approvalUrl: paymentInit.approvalUrl,
      amount: totalAmount,
      currency,
    };
  }

  async createSubscriptionCheckout(subscriptionDto: SubscriptionCheckoutDto) {
    // Create subscription and initialize payment
    const { userId, planId, description } = subscriptionDto;

    // Validate user exists
    const user = (
      await this.database.db.select().from(users).where(eq(users.id, userId))
    )[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }

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
            eq(subscriptions.userId, userId),
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

    // Create subscription
    const subscriptionId = generateId();
    const subscription = (
      await this.database.db
        .insert(subscriptions)
        .values({
          id: subscriptionId,
          userId,
          planId,
          status: PaymentStatus.PENDING,
          startDate,
          endDate,
        })
        .returning()
    )[0];

    // Initialize payment with provider
    const paymentInit = await this.provider.initializePayment({
      subscriptionId: subscription.id,
      amount: plan.price,
      currency: 'USD',
      description: description || `Subscription: ${plan.name}`,
      userId,
    });

    // Create payment record
    const paymentId = generateId();
    const payment = (
      await this.database.db
        .insert(payments)
        .values({
          id: paymentId,
          provider: PaymentProviderEnum.STRIPE,
          providerRef: paymentInit.providerRef,
          status: PaymentStatus.PENDING,
          currency: 'USD' as any,
          amount: plan.price,
          metadata: {
            planId,
            planName: plan.name,
            type: 'subscription',
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

          // Clear user's cart for store purchases
          const metadata = payment.metadata as any;
          if (metadata?.cartItemIds) {
            for (const cartItemId of metadata.cartItemIds) {
              await tx.delete(cartItems).where(eq(cartItems.id, cartItemId));
            }
          }

          // Optionally: Decrement stock for store items
          // This would require additional logic to handle stock management
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

  async handleWebhook(headers: Record<string, string>, body: any) {
    // Handle webhook from payment provider
    try {
      // Verify webhook signature
      const isValid = await this.provider.verifyWebhook(headers, body);
      if (!isValid) {
        throw new BadRequestException('Invalid webhook signature');
      }

      // Parse webhook payload
      const webhookResult: WebhookResult = this.provider.parseWebhook(body);

      // Find payment by provider reference
      const payment = (
        await this.database.db
          .select()
          .from(payments)
          .where(eq(payments.providerRef, webhookResult.providerRef))
      )[0];

      if (!payment) {
        console.log(
          `Payment not found for provider ref: ${webhookResult.providerRef}`,
        );
        return; // Ignore unknown payments
      }

      // Update payment status if it changed
      if (payment.status !== webhookResult.status) {
        await this.database.db.transaction(async (tx) => {
          // Update payment
          await tx
            .update(payments)
            .set({
              status: webhookResult.status,
              metadata: {
                ...(payment.metadata as any),
                lastWebhookEvent: webhookResult.eventType,
                lastWebhookAt: new Date().toISOString(),
              } as any,
            })
            .where(eq(payments.id, payment.id));

          // Update related entities
          await tx
            .update(orders)
            .set({ status: webhookResult.status })
            .where(eq(orders.paymentId, payment.id));

          await tx
            .update(subscriptions)
            .set({ status: webhookResult.status })
            .where(eq(subscriptions.paymentId, payment.id));
        });
      }

      return { processed: true, paymentId: payment.id };
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

    // Get related subscriptions
    const relatedSubscriptions = await this.database.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.paymentId, paymentId));

    // Build enriched payment object
    const enrichedPayment = {
      ...payment,
      orders: relatedOrders,
      subscriptions: relatedSubscriptions,
    };

    return enrichedPayment;
  }
}
