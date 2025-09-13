import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PAYMENT_PROVIDER_TOKEN,
  PaymentProvider,
  WebhookResult,
} from './providers/payment.types';
import { CheckoutDto, SubscriptionCheckoutDto } from './dto/checkout.dto';
import {
  PaymentStatus,
  PaymentProvider as PaymentProviderEnum,
} from '@prisma/client';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService, // Database service
    @Inject(PAYMENT_PROVIDER_TOKEN) private readonly provider: PaymentProvider, // Payment provider
  ) {}

  private async getCartSummary(userId: string) {
    // Compute cart total and validate items
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: { storeItem: true },
        },
      },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Validate all cart items are store items
    const invalidItems = cartItems.filter((item) => !item.product.storeItem);
    if (invalidItems.length > 0) {
      throw new BadRequestException('Cart contains invalid items');
    }

    const currency = 'USD'; // Default currency
    const orderItems = cartItems.map((item) => ({
      productId: item.productId,
      name: item.product.storeItem!.name,
      quantity: item.quantity,
      unitPrice: item.product.storeItem!.price,
    }));

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.quantity * item.product.storeItem!.price,
      0,
    );

    return {
      orderItems,
      totalAmount,
      currency,
      cartItems,
    };
  }

  async createStoreCheckout(checkoutDto: CheckoutDto) {
    // Create order and initialize payment for store items
    const { userId, description } = checkoutDto;

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { orderItems, totalAmount, currency, cartItems } =
      await this.getCartSummary(userId);

    // Create order in database
    const order = await this.prisma.order.create({
      data: {
        userId,
        status: PaymentStatus.PENDING,
        totalAmount,
        orderItems: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.unitPrice,
          })),
        },
      },
    });

    // Initialize payment with provider
    const paymentInit = await this.provider.initializePayment({
      orderId: order.id,
      amount: totalAmount,
      currency,
      description: description || 'Store Checkout',
      items: orderItems,
      userId,
    });

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        provider: PaymentProviderEnum.PAYPAL,
        providerRef: paymentInit.providerRef,
        status: PaymentStatus.PENDING,
        currency: currency as any,
        amount: totalAmount,
        metadata: {
          cartItemIds: cartItems.map((item) => item.id),
          type: 'store_checkout',
        },
      },
    });

    // Update order with payment reference
    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentId: payment.id },
    });

    return {
      orderId: order.id,
      approvalUrl: paymentInit.approvalUrl,
      amount: totalAmount,
      currency,
    };
  }

  async createSubscriptionCheckout(subscriptionDto: SubscriptionCheckoutDto) {
    // Create subscription and initialize payment
    const { userId, planId, description } = subscriptionDto;

    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate subscription plan exists and is active
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    if (!plan.isActive) {
      throw new BadRequestException('Subscription plan is not active');
    }

    // Check for existing active subscription
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: PaymentStatus.PAID,
        endDate: { gt: new Date() },
      },
    });

    if (existingSubscription) {
      throw new BadRequestException('User already has an active subscription');
    }

    // Calculate subscription end date
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    // Create subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        planId,
        status: PaymentStatus.PENDING,
        startDate,
        endDate,
      },
    });

    // Initialize payment with provider
    const paymentInit = await this.provider.initializePayment({
      subscriptionId: subscription.id,
      amount: plan.price,
      currency: 'USD',
      description: description || `Subscription: ${plan.name}`,
      userId,
    });

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        provider: PaymentProviderEnum.PAYPAL,
        providerRef: paymentInit.providerRef,
        status: PaymentStatus.PENDING,
        currency: 'USD',
        amount: plan.price,
        metadata: {
          planId,
          planName: plan.name,
          type: 'subscription',
        },
      },
    });

    // Update subscription with payment reference
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { paymentId: payment.id },
    });

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
    const payment = await this.prisma.payment.findFirst({
      where: { providerRef },
      include: {
        orders: true,
        subscriptions: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Capture payment with provider
    const captureResult = await this.provider.capturePayment(providerRef);

    // Update payment and related entities in transaction
    await this.prisma.$transaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: captureResult.status,
          metadata: {
            ...(payment.metadata as any),
            transactionId: captureResult.transactionId,
            capturedAt: new Date().toISOString(),
          },
        },
      });

      // Handle successful payment
      if (captureResult.status === 'PAID') {
        // Update all related orders
        if (payment.orders.length > 0) {
          for (const order of payment.orders) {
            await tx.order.update({
              where: { id: order.id },
              data: { status: PaymentStatus.PAID },
            });
          }

          // Clear user's cart for store purchases
          const metadata = payment.metadata as any;
          if (metadata?.cartItemIds) {
            await tx.cartItem.deleteMany({
              where: { id: { in: metadata.cartItemIds } },
            });
          }

          // Optionally: Decrement stock for store items
          // This would require additional logic to handle stock management
        }

        // Update all related subscriptions
        if (payment.subscriptions.length > 0) {
          for (const subscription of payment.subscriptions) {
            await tx.subscription.update({
              where: { id: subscription.id },
              data: { status: PaymentStatus.PAID },
            });
          }
        }
      }
    });

    return {
      status: captureResult.status,
      paymentId: payment.id,
      orderIds: payment.orders.map((order) => order.id),
      subscriptionIds: payment.subscriptions.map(
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
      const payment = await this.prisma.payment.findFirst({
        where: { providerRef: webhookResult.providerRef },
        include: {
          orders: true,
          subscriptions: true,
        },
      });

      if (!payment) {
        console.log(
          `Payment not found for provider ref: ${webhookResult.providerRef}`,
        );
        return; // Ignore unknown payments
      }

      // Update payment status if it changed
      if (payment.status !== webhookResult.status) {
        await this.prisma.$transaction(async (tx) => {
          // Update payment
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: webhookResult.status,
              metadata: {
                ...(payment.metadata as any),
                lastWebhookEvent: webhookResult.eventType,
                lastWebhookAt: new Date().toISOString(),
              },
            },
          });

          // Update related entities
          for (const order of payment.orders) {
            await tx.order.update({
              where: { id: order.id },
              data: { status: webhookResult.status },
            });
          }

          for (const subscription of payment.subscriptions) {
            await tx.subscription.update({
              where: { id: subscription.id },
              data: { status: webhookResult.status },
            });
          }
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
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        orders: {
          include: {
            orderItems: {
              include: {
                product: {
                  include: { storeItem: true },
                },
              },
            },
          },
        },
        subscriptions: {
          include: { plan: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }
}
