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
  OrderStatus,
  PaymentProvider as PaymentProviderEnum,
  PreOrderStatus,
} from 'src/database/schema';
import { generateId } from 'src/database/utils';
import { User } from 'src/database/types';
import { SQL } from 'drizzle-orm';
import {
  applyDiscountValue,
  isDiscountCurrentlyActive,
  shouldApplyGlobalDiscount,
} from 'src/lib/helpers/discount.helper';
import { SettingsService } from 'src/modules/settings/settings.service';
import { EmailType } from 'src/modules/notification/email/constants/email.enum';
import { EventsEmitter } from 'src/util/events/events.emitter';
import { EVENTS } from 'src/util/events/events.enum';
import {
  ShippingService,
  CartItemForShipping,
} from 'src/modules/shipping/shipping.service';

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
    private readonly settingsService: SettingsService,
    private readonly eventsEmitter: EventsEmitter,
    private readonly shippingService: ShippingService,
  ) {}

  // Payment statuses that should trigger outbound email notifications
  private readonly notifiablePaymentStatuses = new Set<string>([
    PaymentStatus.PAID,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.REFUNDED,
  ]);

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
      let invoicePaymentId: string | null = null;

      await this.database.db.transaction(async (tx) => {
        // Create new subscription record for this billing cycle
        await this.handleSubscriptionWebhook(tx, webhookResult);

        // Create payment record for this invoice (recurring subscription payment)
        if (webhookResult.metadata?.invoiceId) {
          const generatedPaymentId = generateId();
          await tx.insert(payments).values({
            id: generatedPaymentId,
            provider: this.getProviderType(),
            providerRef: webhookResult.providerRef,
            status: webhookResult.status,
            currency: webhookResult.metadata.currency || 'GBP',
            amount: webhookResult.metadata.amount / 100, // Convert from cents
            metadata: {
              type: 'subscription',
              // invoiceId, subscriptionId, billingReason are not stored in metadata
              // as they can be retrieved from the payment record or related subscription
            } as PaymentMetadata,
          });
          invoicePaymentId = generatedPaymentId;
        }
      });

      if (invoicePaymentId) {
        await this.sendPaymentStatusEmail({
          paymentId: invoicePaymentId,
          status: webhookResult.status,
          trigger: webhookResult.eventType,
          reason: this.getPaymentReasonFromEvent({
            eventType: webhookResult.eventType,
            status: webhookResult.status,
            contextType: 'subscription',
          }),
          contextType: 'subscription',
        });
      }

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

  // Picks the best preview image from computed order items
  private getOrderPreviewImage(
    items: Array<{ image?: unknown }>,
  ): string | null {
    for (const item of items) {
      const preview = this.normalizePreviewImage(item.image);
      if (preview) {
        return preview;
      }
    }
    return null;
  }

  // Normalizes any supported image structure into a string URL
  private normalizePreviewImage(source: unknown): string | null {
    if (!source) {
      return null;
    }

    if (typeof source === 'string') {
      return source;
    }

    if (Array.isArray(source)) {
      const stringCandidate = source.find((entry) => typeof entry === 'string');
      if (typeof stringCandidate === 'string') {
        return stringCandidate;
      }
      const objectCandidate = source.find(
        (entry) => typeof entry === 'object' && entry !== null,
      ) as Record<string, unknown> | undefined;
      if (objectCandidate && typeof objectCandidate.url === 'string') {
        return objectCandidate.url;
      }
      return null;
    }

    if (typeof source === 'object') {
      const record = source as Record<string, unknown>;
      if (typeof record.url === 'string') {
        return record.url;
      }
      if (Array.isArray(record.sources)) {
        const nested = record.sources.find(
          (entry) => typeof entry === 'string',
        );
        if (typeof nested === 'string') {
          return nested;
        }
        const objectCandidate = record.sources.find(
          (entry) => typeof entry === 'object' && entry !== null,
        ) as Record<string, unknown> | undefined;
        if (objectCandidate && typeof objectCandidate.url === 'string') {
          return objectCandidate.url;
        }
      }
    }

    return null;
  }

  private async getCartSummary(userId: string) {
    const roundCurrency = (value: number) =>
      Math.round((value + Number.EPSILON) * 100) / 100;

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
        storeItemDiscountType: storeItems.discountType,
        storeItemDiscountValue: storeItems.discountValue,
        storeItemDiscountActive: storeItems.discountActive,
        storeItemDiscountStart: storeItems.discountStart,
        storeItemDiscountEnd: storeItems.discountEnd,
        storeItemPreOrderEnabled: storeItems.preOrderEnabled,
        storeItemWeight: storeItems.weight,
        storeItemLength: storeItems.length,
        storeItemWidth: storeItems.width,
        storeItemHeight: storeItems.height,
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

      const stock = item.storeItemStock ?? 0;
      const canPreOrder = item.storeItemPreOrderEnabled === true && stock <= 0;

      if (!canPreOrder) {
        if (stock < item.quantity) {
          invalidItems.push(
            `Insufficient stock for ${item.storeItemName}. Available: ${stock}, Requested: ${item.quantity}`,
          );
          continue;
        }
      }

      validItems.push(item);
    }

    // Throw error if any invalid items found
    if (invalidItems.length > 0) {
      throw new BadRequestException(
        `Cart contains invalid items: ${invalidItems.join(', ')}`,
      );
    }

    const now = new Date();
    const globalDiscountConfig = await this.settingsService.getGlobalDiscount();

    const computedItems = validItems.map((item) => {
      const baseUnitPrice = roundCurrency(item.storeItemPrice);
      const baseLineTotal = roundCurrency(baseUnitPrice * item.quantity);

      const discountActive = isDiscountCurrentlyActive(
        {
          type: item.storeItemDiscountType,
          value: item.storeItemDiscountValue,
          isActive: item.storeItemDiscountActive,
          startsAt: item.storeItemDiscountStart,
          endsAt: item.storeItemDiscountEnd,
        },
        now,
      );

      const discountResult = discountActive
        ? applyDiscountValue(baseUnitPrice, {
            type: item.storeItemDiscountType,
            value: item.storeItemDiscountValue,
          })
        : { finalAmount: baseUnitPrice, discountAmount: 0 };

      const discountedUnitPrice = roundCurrency(discountResult.finalAmount);
      const unitDiscountAmount = roundCurrency(discountResult.discountAmount);
      const lineDiscountAmount = roundCurrency(
        unitDiscountAmount * item.quantity,
      );
      const discountedLineTotal = roundCurrency(
        discountedUnitPrice * item.quantity,
      );

      const isPreOrder =
        item.storeItemPreOrderEnabled === true &&
        (item.storeItemStock ?? 0) <= 0;

      return {
        productId: item.productId,
        name: item.storeItemName,
        quantity: item.quantity,
        baseUnitPrice,
        baseLineTotal,
        discountedUnitPrice,
        discountedLineTotal,
        unitDiscountAmount,
        lineDiscountAmount,
        discountActive,
        discountType: item.storeItemDiscountType,
        discountValue: item.storeItemDiscountValue,
        image: item.storeItemDisplay,
        isPreOrder,
      };
    });

    const baseSubtotal = roundCurrency(
      computedItems.reduce((sum, item) => sum + item.baseLineTotal, 0),
    );
    let subtotalAfterProductDiscounts = roundCurrency(
      computedItems.reduce((sum, item) => sum + item.discountedLineTotal, 0),
    );
    let productDiscountTotal = roundCurrency(
      computedItems.reduce((sum, item) => sum + item.lineDiscountAmount, 0),
    );

    const totalQuantity = computedItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const globalDiscountApplies = shouldApplyGlobalDiscount(
      globalDiscountConfig,
      baseSubtotal,
    );

    if (globalDiscountApplies) {
      subtotalAfterProductDiscounts = baseSubtotal;
      productDiscountTotal = 0;
    }

    let globalDiscountAmount = 0;
    let totalAmount = roundCurrency(subtotalAfterProductDiscounts);
    const currency = 'GBP';

    const toOrderItem = (
      item: (typeof computedItems)[number],
      override?: {
        unitPrice: number;
        lineTotal: number;
        discountAmount: number;
      },
    ) => {
      const isGlobalOverride = Boolean(override);
      const unitPrice = override
        ? roundCurrency(override.unitPrice)
        : item.discountedUnitPrice;
      const lineTotal = override
        ? roundCurrency(override.lineTotal)
        : item.discountedLineTotal;
      const discountAmount = override
        ? roundCurrency(override.discountAmount)
        : item.lineDiscountAmount;
      const amountPerUnit = override
        ? roundCurrency(override.discountAmount / item.quantity)
        : item.unitDiscountAmount;

      return {
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        baseUnitPrice: item.baseUnitPrice,
        baseLineTotal: item.baseLineTotal,
        image: item.image,
        discount: {
          isActive:
            isGlobalOverride ||
            (item.discountActive && item.discountType !== 'NONE'),
          type: isGlobalOverride
            ? globalDiscountConfig?.type || 'NONE'
            : item.discountActive
              ? item.discountType
              : 'NONE',
          value: isGlobalOverride
            ? globalDiscountConfig?.value || 0
            : item.discountActive
              ? item.discountValue
              : 0,
          amountPerUnit,
          totalAmount: discountAmount,
          source: isGlobalOverride ? 'GLOBAL' : 'PRODUCT',
        },
        isPreOrder: item.isPreOrder,
      };
    };

    let orderItemsData = computedItems.map((item) => toOrderItem(item));

    if (globalDiscountApplies && globalDiscountConfig) {
      const globalPricing = applyDiscountValue(
        baseSubtotal,
        globalDiscountConfig,
      );
      globalDiscountAmount = roundCurrency(globalPricing.discountAmount);
      totalAmount = roundCurrency(globalPricing.finalAmount);

      if (globalDiscountAmount > 0 && baseSubtotal > 0) {
        let remainingDiscount = globalDiscountAmount;
        orderItemsData = computedItems.map((item, index) => {
          let itemDiscount = roundCurrency(
            (item.baseLineTotal / baseSubtotal) * globalDiscountAmount,
          );
          if (itemDiscount > remainingDiscount) {
            itemDiscount = remainingDiscount;
          }
          if (index === computedItems.length - 1) {
            itemDiscount = roundCurrency(remainingDiscount);
          }
          remainingDiscount = roundCurrency(
            Math.max(remainingDiscount - itemDiscount, 0),
          );

          const lineTotal = roundCurrency(item.baseLineTotal - itemDiscount);
          const unitPrice = roundCurrency(lineTotal / item.quantity);
          return toOrderItem(item, {
            unitPrice,
            lineTotal,
            discountAmount: itemDiscount,
          });
        });
      }
    } else {
      totalAmount = roundCurrency(subtotalAfterProductDiscounts);
      globalDiscountAmount = 0;
    }

    // Prepare cart items data for metadata
    const cartItemsData = validItems.map((item) => ({
      id: item.cartItemId,
      productId: item.productId,
      quantity: item.quantity,
      userId: userId,
    }));

    const pricingSummary = {
      currency,
      baseSubtotal: roundCurrency(baseSubtotal),
      subtotalAfterProductDiscounts: roundCurrency(
        subtotalAfterProductDiscounts,
      ),
      productDiscountTotal: roundCurrency(productDiscountTotal),
      globalDiscountTotal: globalDiscountAmount,
      totalDiscount: roundCurrency(productDiscountTotal + globalDiscountAmount),
      grandTotal: totalAmount,
    };

    const discountSummary = {
      productDiscountTotal: pricingSummary.productDiscountTotal,
      globalDiscount: {
        ...(globalDiscountConfig || {
          isActive: false,
          type: 'NONE',
          value: 0,
        }),
        applied: globalDiscountApplies,
        amountApplied: globalDiscountAmount,
        overridesProductDiscounts: globalDiscountApplies,
      },
      totalDiscount: pricingSummary.totalDiscount,
    };

    return {
      orderItems: orderItemsData,
      totalAmount,
      currency,
      cartItems: cartItemsData,
      itemCount: validItems.length,
      summary: {
        subtotal: totalAmount,
        subtotalBeforeDiscounts: pricingSummary.baseSubtotal,
        subtotalAfterProductDiscounts:
          pricingSummary.subtotalAfterProductDiscounts,
        productDiscountTotal: pricingSummary.productDiscountTotal,
        globalDiscountTotal: pricingSummary.globalDiscountTotal,
        discountTotal: pricingSummary.totalDiscount,
        currency,
        itemCount: validItems.length,
        totalQuantity,
      },
      pricing: pricingSummary,
      discounts: discountSummary,
      globalDiscount: discountSummary.globalDiscount,
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

    // Calculate shipping options for the cart
    // Get cart items with weight/dimensions for shipping calculation
    const cartWithDetails = await this.database.db
      .select({
        quantity: cartItems.quantity,
        weight: storeItems.weight,
        length: storeItems.length,
        width: storeItems.width,
        height: storeItems.height,
      })
      .from(cartItems)
      .where(eq(cartItems.userId, userProfile.id))
      .innerJoin(products, eq(cartItems.productId, products.id))
      .innerJoin(storeItems, eq(products.id, storeItems.productId));

    // Map to CartItemForShipping format
    const shippingItems: CartItemForShipping[] = cartWithDetails.map(
      (item) => ({
        weight: item.weight || undefined,
        length: item.length || undefined,
        width: item.width || undefined,
        height: item.height || undefined,
        quantity: item.quantity,
      }),
    );

    // Calculate shipping for all available services
    const consolidation =
      this.shippingService.consolidateCartItems(shippingItems);
    const availableServices = await this.shippingService.getAvailableServices(
      consolidation.totalWeight,
    );

    return {
      ...summary,
      deliveryAddresses: addresses,
      shipping: {
        weight: consolidation.totalWeight,
        packageFormat: consolidation.packageFormat,
        availableServices,
      },
    };
  }

  async checkoutCartItems(userProfile: User, cartCheckoutDto: CartCheckoutDto) {
    // Create order and initialize payment for store items
    const description = `Cart Checkout for ${userProfile.firstName}`;
    const userId = userProfile.id;

    const paymentId = generateId();

    const {
      orderItems: orderItemsData,
      totalAmount: subtotalAmount,
      currency,
      cartItems: cartItemsData,
      pricing,
    } = await this.getCartSummary(userId);
    const previewImage = this.getOrderPreviewImage(orderItemsData);

    // Check if order contains pre-orders
    const hasPreOrders = orderItemsData.some((item) => item.isPreOrder);

    // Calculate shipping cost
    const cartWithDetails = await this.database.db
      .select({
        quantity: cartItems.quantity,
        weight: storeItems.weight,
        length: storeItems.length,
        width: storeItems.width,
        height: storeItems.height,
      })
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .innerJoin(products, eq(cartItems.productId, products.id))
      .innerJoin(storeItems, eq(products.id, storeItems.productId));

    const shippingItems: CartItemForShipping[] = cartWithDetails.map(
      (item) => ({
        weight: item.weight || undefined,
        length: item.length || undefined,
        width: item.width || undefined,
        height: item.height || undefined,
        quantity: item.quantity,
      }),
    );

    // Use provided shipping service or default
    const shippingServiceKey =
      cartCheckoutDto.shippingServiceKey ||
      (await this.shippingService.getDefaultShippingService());

    const shippingCalculation =
      await this.shippingService.calculateShippingCost(
        shippingItems,
        shippingServiceKey,
      );

    // Use the human-friendly shipping label from configuration for Stripe line item
    const shippingLineItemLabel =
      shippingCalculation.serviceLabel ||
      shippingCalculation.serviceCode ||
      shippingServiceKey ||
      'Shipping';

    // Calculate total including shipping
    const totalAmount = subtotalAmount + shippingCalculation.totalPrice;

    const paymentAmount = totalAmount;
    const expectedFulfillmentDate: Date | null = null;

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
      cartCheckoutDto.recipientName &&
      cartCheckoutDto.contactPhone &&
      cartCheckoutDto.addressLine1 &&
      cartCheckoutDto.postTown &&
      cartCheckoutDto.postcode
    ) {
      // Create new delivery address if saveAddress is true
      if (cartCheckoutDto.saveAddress) {
        const newAddressId = generateId();
        await this.database.db.insert(deliveryAddresses).values({
          id: newAddressId,
          userId,
          recipientName: cartCheckoutDto.recipientName,
          contactPhone: cartCheckoutDto.contactPhone,
          addressLine1: cartCheckoutDto.addressLine1,
          postTown: cartCheckoutDto.postTown,
          postcode: cartCheckoutDto.postcode,
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
          recipientName: cartCheckoutDto.recipientName,
          contactPhone: cartCheckoutDto.contactPhone,
          addressLine1: cartCheckoutDto.addressLine1,
          postTown: cartCheckoutDto.postTown,
          postcode: cartCheckoutDto.postcode,
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

    // Create order in database with shipping details
    const orderId = generateId();
    await this.database.db.insert(orders).values({
      id: orderId,
      userId,
      status: OrderStatus.PENDING,
      totalAmount,
      previewImage: previewImage ?? null,
      deliveryAddressId,
      isPreOrder: hasPreOrders,
      preOrderStatus: hasPreOrders ? 'PLACED' : null,
      expectedFulfillmentDate,
      serviceCode: shippingCalculation.serviceCode,
      shippingCost: shippingCalculation.totalPrice,
      parcelWeight: shippingCalculation.weight,
      packageFormatIdentifier: shippingCalculation.packageFormat,
      parcelDimensions: shippingCalculation.dimensions,
      statusHistory: [
        {
          status: 'PENDING',
          timestamp: new Date().toISOString(),
          note: 'Order created',
        },
      ],
    });
    await this.database.db.insert(orderItems).values(
      orderItemsData.map((item) => ({
        id: generateId(),
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: item.unitPrice,
        preOrderReleaseDate: null,
      })),
    );

    // Initialize payment with provider
    // For pre-orders with deposits, only send deposit amount to payment provider
    const providerLineItems =
      (pricing?.globalDiscountTotal ?? 0) > 0 ? undefined : orderItemsData;

    const paymentInit = await this.provider.initializePayment({
      orderId: orderId,
      amount: paymentAmount,
      currency,
      description: description || 'Store Checkout',
      items: providerLineItems,
      shippingCost: shippingCalculation.totalPrice,
      shippingDescription: shippingLineItemLabel,
      userId,
      paymentId,
      isPreOrder: hasPreOrders,
      captureMethod: 'automatic',
    });

    // Create payment record
    await this.database.db.insert(payments).values({
      id: paymentId,
      provider: this.getProviderType(),
      providerRef: paymentInit.providerRef,
      status: PaymentStatus.PENDING,
      currency: currency as any,
      amount: totalAmount,
      capturedAmount: totalAmount,
      authorizedAmount: paymentAmount,
      isPreOrderPayment: hasPreOrders,
      metadata: {
        type: 'store_checkout',
        isPreOrder: hasPreOrders,
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
      currency: 'GBP',
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
      currency: 'GBP' as any,
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
      currency: 'GBP',
      planName: plan.name,
    };
  }

  // Verify payment status directly from provider API (fallback for missed webhooks)
  async verifyPaymentStatus(paymentId: string) {
    const payment = (
      await this.database.db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
    )[0];

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Only verify if payment is still PENDING
    if (payment.status !== PaymentStatus.PENDING) {
      return {
        status: payment.status,
        paymentId: payment.id,
        updated: false,
        message: 'Payment status is already finalized',
      };
    }

    // Check if provider supports verification
    if (!this.provider.verifyPaymentStatus) {
      return {
        status: payment.status,
        paymentId: payment.id,
        updated: false,
        message: 'Payment provider does not support verification',
      };
    }

    // Check if providerRef exists
    if (!payment.providerRef) {
      return {
        status: payment.status,
        paymentId: payment.id,
        updated: false,
        message: 'Payment does not have a provider reference',
      };
    }

    // Verify with provider using the stored providerRef (Checkout Session ID)
    const verificationResult = await this.provider.verifyPaymentStatus(
      payment.providerRef,
    );

    // Map provider status to our PaymentStatus enum
    let newStatus: PaymentStatus = PaymentStatus.PENDING;
    if (verificationResult.status === 'PAID') {
      newStatus = PaymentStatus.PAID;
    } else if (verificationResult.status === 'FAILED') {
      newStatus = PaymentStatus.FAILED;
    }

    // Only update if status changed
    if (newStatus !== payment.status) {
      await this.database.db.transaction(async (tx) => {
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
            status: newStatus,
            metadata: currentMetadata,
          })
          .where(eq(payments.id, payment.id));

        // Handle successful payment
        if (newStatus === PaymentStatus.PAID) {
          // Get related orders
          const relatedOrders = await tx
            .select()
            .from(orders)
            .where(eq(orders.paymentId, payment.id));

          // Update all related orders
          if (relatedOrders.length > 0) {
            await this.updateOrderStatusForPayment(
              tx,
              payment.id,
              OrderStatus.PROCESSING,
            );

            // Finalize store checkout (decrement stock, clear cart)
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

      // Determine context type for email
      const paymentMetadata = payment.metadata as PaymentMetadata;
      const contextType: 'store' | 'subscription' =
        paymentMetadata?.type === 'subscription' ? 'subscription' : 'store';

      // Send payment status email
      await this.sendPaymentStatusEmail({
        paymentId: payment.id,
        status: newStatus,
        trigger: 'payment.verification',
        reason: this.getPaymentReasonFromEvent({
          eventType: 'payment.verification',
          status: newStatus,
          contextType,
        }),
        contextType,
      });

      // Emit event for paid orders (including pre-orders) to trigger Click & Drop submission
      if (newStatus === PaymentStatus.PAID) {
        const relatedOrders = await this.database.db
          .select()
          .from(orders)
          .where(eq(orders.paymentId, payment.id));

        relatedOrders.forEach((order) => {
          this.eventsEmitter.emit(EVENTS.ORDER_PAYMENT_CONFIRMED, {
            orderId: order.id,
            userId: order.userId,
          });
        });
      }

      return {
        status: newStatus,
        paymentId: payment.id,
        updated: true,
        message: `Payment status updated from ${payment.status} to ${newStatus}`,
      };
    }

    return {
      status: payment.status,
      paymentId: payment.id,
      updated: false,
      message: 'Payment status unchanged',
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
          await this.updateOrderStatusForPayment(
            tx,
            payment.id,
            OrderStatus.PROCESSING,
          );
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

    // Determine context type for email
    const paymentMetadata = payment.metadata as PaymentMetadata;
    const contextType: 'store' | 'subscription' =
      paymentMetadata?.type === 'subscription' ? 'subscription' : 'store';

    // Send payment status email
    await this.sendPaymentStatusEmail({
      paymentId: payment.id,
      status: captureResult.status,
      trigger: 'payment.capture',
      reason: this.getPaymentReasonFromEvent({
        eventType: 'payment.capture',
        status: captureResult.status,
        contextType,
      }),
      contextType,
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

    // Emit event for paid orders (including pre-orders) to trigger Click & Drop submission
    if (captureResult.status === 'PAID' && relatedOrders.length > 0) {
      relatedOrders.forEach((order) => {
        this.eventsEmitter.emit(EVENTS.ORDER_PAYMENT_CONFIRMED, {
          orderId: order.id,
          userId: order.userId,
        });
      });
    }

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

          // Get the order to check if it's a pre-order
          const order = (
            await tx
              .select()
              .from(orders)
              .where(eq(orders.paymentId, payment.id))
              .limit(1)
          )[0];

          const isPreOrder = payment.isPreOrderPayment || order?.isPreOrder;

          await tx
            .update(payments)
            .set({
              status: PaymentStatus.PAID,
              providerRef: webhookResult.providerRef,
              capturedAmount: payment.amount,
              authorizedAmount: payment.amount,
              metadata: updatedMetadata as PaymentMetadata,
            })
            .where(eq(payments.id, payment.id));

          // Update order status
          if (isPreOrder) {
            await tx
              .update(orders)
              .set({
                preOrderStatus: PreOrderStatus.CONFIRMED,
                status: OrderStatus.PENDING,
              })
              .where(eq(orders.paymentId, payment.id));
          } else {
            await this.updateOrderStatusForPayment(
              tx,
              payment.id,
              OrderStatus.PROCESSING,
            );
          }

          await this.finalizeStoreCheckout(tx, payment.id);
        });

        await this.sendPaymentStatusEmail({
          paymentId: payment.id,
          status: PaymentStatus.PAID,
          trigger: webhookResult.eventType,
          reason: this.getPaymentReasonFromEvent({
            eventType: webhookResult.eventType,
            status: PaymentStatus.PAID,
            contextType: 'store',
          }),
          contextType: 'store',
        });

        // Emit event for paid orders (including pre-orders) to trigger Click & Drop submission
        const relatedOrders = await this.database.db
          .select()
          .from(orders)
          .where(eq(orders.paymentId, payment.id));

        relatedOrders.forEach((order) => {
          this.eventsEmitter.emit(EVENTS.ORDER_PAYMENT_CONFIRMED, {
            orderId: order.id,
            userId: order.userId,
          });
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

          await this.updateOrderStatusForPayment(
            tx,
            payment.id,
            OrderStatus.PENDING,
            [OrderStatus.PENDING, OrderStatus.PROCESSING],
          );
        });

        await this.sendPaymentStatusEmail({
          paymentId: payment.id,
          status: PaymentStatus.CANCELLED,
          trigger: webhookResult.eventType,
          reason: this.getPaymentReasonFromEvent({
            eventType: webhookResult.eventType,
            status: PaymentStatus.CANCELLED,
            contextType: 'store',
          }),
          contextType: 'store',
        });

        return {
          processed: true,
          paymentId: payment.id,
          status: PaymentStatus.CANCELLED,
        };
      }

      case 'payment_intent.payment_failed': {
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
              status: PaymentStatus.FAILED,
              providerRef: webhookResult.providerRef,
              metadata: updatedMetadata as PaymentMetadata,
            })
            .where(eq(payments.id, payment.id));

          await this.updateOrderStatusForPayment(
            tx,
            payment.id,
            OrderStatus.PENDING,
            [OrderStatus.PENDING, OrderStatus.PROCESSING],
          );
        });

        await this.sendPaymentStatusEmail({
          paymentId: payment.id,
          status: PaymentStatus.FAILED,
          trigger: webhookResult.eventType,
          reason: this.getPaymentReasonFromEvent({
            eventType: webhookResult.eventType,
            status: PaymentStatus.FAILED,
            contextType: 'store',
          }),
          contextType: 'store',
        });

        return {
          processed: true,
          paymentId: payment.id,
          status: PaymentStatus.FAILED,
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

        await this.updateOrderStatusForPayment(
          this.database.db,
          payment.id,
          OrderStatus.PENDING,
          [OrderStatus.PENDING, OrderStatus.PROCESSING],
        );

        await this.sendPaymentStatusEmail({
          paymentId: payment.id,
          status: PaymentStatus.CANCELLED,
          trigger: webhookResult.eventType,
          reason: this.getPaymentReasonFromEvent({
            eventType: webhookResult.eventType,
            status: PaymentStatus.CANCELLED,
            contextType: 'store',
          }),
          contextType: 'store',
        });

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

    const isPreOrder = order.isPreOrder;

    if (!isPreOrder) {
      // Decrement stock for each product
      for (const orderItem of orderItemsList) {
        // todo: don't decrement stock for pre-order items
        if (orderItem.preOrderReleaseDate) {
          continue;
        }
        await tx
          .update(storeItems)
          .set({
            stock: sql`${storeItems.stock} - ${orderItem.quantity}`,
          })
          .where(eq(storeItems.productId, orderItem.productId));
      }
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

  private async updateOrderStatusForPayment(
    tx: any,
    paymentId: string,
    nextStatus: OrderStatus,
    allowedCurrentStatuses: OrderStatus[] = [OrderStatus.PENDING],
  ) {
    if (!paymentId) {
      return;
    }

    const whereCondition =
      allowedCurrentStatuses.length > 0
        ? and(
            eq(orders.paymentId, paymentId),
            inArray(orders.status, allowedCurrentStatuses),
          )
        : eq(orders.paymentId, paymentId);

    await tx.update(orders).set({ status: nextStatus }).where(whereCondition);
  }

  private mapPaymentStatusToOrderStatus(status: PaymentStatus): OrderStatus {
    return status === PaymentStatus.PAID
      ? OrderStatus.PROCESSING
      : OrderStatus.PENDING;
  }

  // Send payment status update email via notification pipeline
  private async sendPaymentStatusEmail({
    paymentId,
    status,
    reason,
    trigger,
    contextType,
  }: {
    paymentId: string;
    status: string;
    reason?: string;
    trigger?: string;
    contextType: 'store' | 'subscription';
  }) {
    if (!this.notifiablePaymentStatuses.has(status)) {
      return;
    }

    try {
      const paymentRecord = (
        await this.database.db
          .select()
          .from(payments)
          .where(eq(payments.id, paymentId))
          .limit(1)
      )[0];

      if (!paymentRecord) {
        console.warn(`[PaymentEmail] Payment ${paymentId} not found for email`);
        return;
      }

      const [orderDetails] = await this.database.db
        .select({
          orderId: orders.id,
          totalAmount: orders.totalAmount,
          userId: orders.userId,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(orders)
        .innerJoin(users, eq(orders.userId, users.id))
        .where(eq(orders.paymentId, paymentRecord.id))
        .limit(1);

      const [subscriptionDetails] = await this.database.db
        .select({
          subscriptionId: subscriptions.id,
          planName: subscriptionPlans.name,
          userId: subscriptions.userId,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.userId, users.id))
        .leftJoin(
          subscriptionPlans,
          eq(subscriptions.planId, subscriptionPlans.id),
        )
        .where(eq(subscriptions.paymentId, paymentRecord.id))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      const userDetails = orderDetails || subscriptionDetails;
      if (!userDetails) {
        console.warn(
          `[PaymentEmail] No user context found for payment ${paymentId}`,
        );
        return;
      }

      let items:
        | {
            name: string | null;
            quantity: number;
            price: number;
          }[]
        | undefined;

      if (orderDetails) {
        // Include line items for store purchases
        const orderLineItems = await this.database.db
          .select({
            name: storeItems.name,
            quantity: orderItems.quantity,
            price: orderItems.price,
          })
          .from(orderItems)
          .leftJoin(storeItems, eq(orderItems.productId, storeItems.productId))
          .where(eq(orderItems.orderId, orderDetails.orderId));

        items = orderLineItems.map((item) => ({
          name: item.name || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
        }));
      } else if (subscriptionDetails?.planName) {
        // Provide at least the subscribed plan as a single line item
        items = [
          {
            name: subscriptionDetails.planName || '',
            quantity: 1,
            price: paymentRecord.amount || 0,
          },
        ];
      }

      const frontendUrl =
        process.env.FRONTEND_URL || 'https://fiftyfirstswellness.co.uk';
      const supportEmail =
        process.env.COMPANY_EMAIL || 'support@fiftyfirstswellness.com';
      const isStoreOrder = Boolean(orderDetails);
      const copy = this.getPaymentStatusCopy(status, {
        isStoreOrder,
        frontendUrl,
      });

      const dashboardPath = isStoreOrder
        ? '/dashboard/orders'
        : '/dashboard/subscriptions';
      const baseCtaUrl = `${frontendUrl}${dashboardPath}`;

      const emailContext = {
        firstName: userDetails.firstName || '',
        lastName: userDetails.lastName || '',
        status: status || 'PENDING',
        statusTitle: copy.title || 'Payment Status Update',
        statusDescription:
          copy.description || 'Here is the latest on your payment.',
        statusVariant: copy.variant || 'info',
        reason:
          reason ||
          copy.reason ||
          'We wanted to keep you updated on your recent transaction.',
        nextSteps: copy.nextSteps || '',
        paymentType: isStoreOrder ? 'Store Order' : 'Subscription',
        paymentId: paymentRecord.id,
        providerRef: paymentRecord.providerRef || '',
        orderId: orderDetails?.orderId || '',
        subscriptionId: subscriptionDetails?.subscriptionId || '',
        subscriptionName: subscriptionDetails?.planName || '',
        amount: paymentRecord.amount || 0,
        currency: paymentRecord.currency || 'GBP',
        items: items || [],
        ctaLabel: copy.ctaLabel || 'Review your payment',
        ctaUrl: copy.ctaUrl || baseCtaUrl,
        dashboardUrl: baseCtaUrl,
        supportEmail,
        frontendUrl,
        trigger: trigger || '',
      };

      this.eventsEmitter.sendEmail({
        to: userDetails.email,
        type: EmailType.PAYMENT_STATUS_UPDATE,
        context: emailContext,
      });
    } catch (error) {
      console.error(
        `[PaymentEmail] Failed to send payment status email for ${paymentId}`,
        error,
      );
    }
  }

  // Build friendly copy used by the payment status email template
  private getPaymentStatusCopy(
    status: string,
    options: { isStoreOrder: boolean; frontendUrl: string },
  ) {
    const { isStoreOrder, frontendUrl } = options;
    const defaults = {
      title: 'Payment Update',
      description: 'Here is the latest on your recent payment.',
      reason: isStoreOrder
        ? 'We wanted to keep you posted on the status of your order.'
        : 'We wanted to share the latest status of your subscription.',
      nextSteps: isStoreOrder
        ? 'You can review your order details from your dashboard.'
        : 'Manage your subscription anytime from your dashboard.',
      ctaLabel: isStoreOrder ? 'Review order' : 'Manage subscription',
      ctaUrl: isStoreOrder
        ? `${frontendUrl}/marketplace`
        : `${frontendUrl}/dashboard/subscriptions`,
      variant: 'info',
    };

    switch (status) {
      case PaymentStatus.PAID:
        return {
          title: 'Payment Confirmed',
          description: isStoreOrder
            ? 'We received your payment successfully and began preparing your items.'
            : 'Your subscription payment cleared and your access is active.',
          reason: isStoreOrder
            ? 'Thanks for completing your purchase.'
            : 'Your membership remains active with uninterrupted benefits.',
          nextSteps: isStoreOrder
            ? 'We will send a shipping update as soon as your order leaves the warehouse.'
            : 'Feel free to dive into the latest programmes and classes.',
          ctaLabel: isStoreOrder ? 'View order' : 'View subscription',
          ctaUrl: isStoreOrder
            ? `${frontendUrl}/dashboard/orders`
            : `${frontendUrl}/dashboard/subscriptions`,
          variant: 'success',
        };
      case PaymentStatus.FAILED:
        return {
          title: 'Payment Failed',
          description: 'Unfortunately the payment attempt did not complete.',
          reason: isStoreOrder
            ? 'The selected payment method was declined or interrupted.'
            : 'We could not renew your subscription with the current billing method.',
          nextSteps: isStoreOrder
            ? 'Please try checking out again with a different payment method.'
            : 'Please update your billing details to keep your access uninterrupted.',
          ctaLabel: isStoreOrder ? 'Try checkout again' : 'Update billing',
          ctaUrl: isStoreOrder
            ? `${frontendUrl}/cart`
            : `${frontendUrl}/dashboard/billing`,
          variant: 'danger',
        };
      case PaymentStatus.CANCELLED:
        return {
          title: 'Payment Cancelled',
          description: 'This payment was cancelled before completion.',
          reason: isStoreOrder
            ? 'The checkout session ended before payment was captured.'
            : 'The subscription charge was cancelled at the provider.',
          nextSteps: isStoreOrder
            ? 'You can return to your cart anytime to complete the purchase.'
            : 'Manage your plan from the dashboard if you would like to retry.',
          ctaLabel: isStoreOrder ? 'Resume checkout' : 'Manage subscription',
          ctaUrl: isStoreOrder
            ? `${frontendUrl}/cart`
            : `${frontendUrl}/dashboard/subscriptions`,
          variant: 'warning',
        };
      case PaymentStatus.REFUNDED:
        return {
          title: 'Payment Refunded',
          description: 'A refund was issued for this payment.',
          reason: isStoreOrder
            ? 'Your order was refunded successfully.'
            : 'The subscription charge was refunded to your original payment method.',
          nextSteps:
            'Funds should reflect in your account within 5-10 business days.',
          ctaLabel: isStoreOrder ? 'Browse store' : 'View subscription',
          ctaUrl: isStoreOrder
            ? `${frontendUrl}/marketplace`
            : `${frontendUrl}/dashboard/subscriptions`,
          variant: 'info',
        };
      default:
        return defaults;
    }
  }

  // Translate webhook events into user friendly explanations
  private getPaymentReasonFromEvent({
    eventType,
    status,
    contextType,
  }: {
    eventType?: string;
    status: string;
    contextType: 'store' | 'subscription';
  }) {
    const defaults: Record<string, string> = {
      [PaymentStatus.PAID]:
        contextType === 'store'
          ? 'We received your payment and started preparing your order.'
          : 'Your subscription payment is confirmed.',
      [PaymentStatus.FAILED]:
        contextType === 'store'
          ? 'The payment attempt did not go through.'
          : 'We could not renew your subscription with the current billing method.',
      [PaymentStatus.CANCELLED]:
        contextType === 'store'
          ? 'The checkout session was cancelled before completion.'
          : 'The payment was cancelled with your provider.',
      [PaymentStatus.REFUNDED]: 'A refund has been initiated for this payment.',
    };

    const dictionary: Record<string, string> = {
      'payment_intent.succeeded':
        contextType === 'store'
          ? 'Stripe confirmed your payment and we will start fulfilling your order.'
          : 'Stripe confirmed your subscription payment.',
      'payment_intent.canceled':
        contextType === 'store'
          ? 'Your payment intent was cancelled before authorization.'
          : 'The subscription payment intent was cancelled.',
      'checkout.session.expired':
        contextType === 'store'
          ? 'The checkout session expired before you could complete payment.'
          : 'The checkout session expired before activation.',
      'invoice.payment_succeeded':
        'Your subscription invoice for this billing cycle has been paid.',
      'invoice.payment_failed':
        'The latest attempt to renew your subscription failed.',
      'customer.subscription.deleted':
        'Your subscription was cancelled with the payment provider.',
    };

    return (
      (eventType && dictionary[eventType]) ||
      defaults[status] ||
      defaults[PaymentStatus.PAID]
    );
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

      const allowedStatuses =
        webhookResult.status === PaymentStatus.PAID
          ? [OrderStatus.PENDING]
          : [OrderStatus.PENDING, OrderStatus.PROCESSING];
      await this.updateOrderStatusForPayment(
        tx,
        payment.id,
        this.mapPaymentStatusToOrderStatus(webhookResult.status),
        allowedStatuses,
      );

      await this.updateSubscriptionStatusForWebhook(
        tx,
        payment.id,
        webhookResult,
      );
    });

    await this.sendPaymentStatusEmail({
      paymentId: payment.id,
      status: webhookResult.status,
      trigger: webhookResult.eventType,
      reason: this.getPaymentReasonFromEvent({
        eventType: webhookResult.eventType,
        status: webhookResult.status,
        contextType: 'subscription',
      }),
      contextType: 'subscription',
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
        deliveryContactName: deliveryAddresses.recipientName,
        deliveryContactPhone: deliveryAddresses.contactPhone,
        deliveryAddressLine1: deliveryAddresses.addressLine1,
        deliveryPostTown: deliveryAddresses.postTown,
        deliveryPostcode: deliveryAddresses.postcode,
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
              recipientName: order.deliveryContactName,
              contactPhone: order.deliveryContactPhone,
              addressLine1: order.deliveryAddressLine1,
              postTown: order.deliveryPostTown,
              postcode: order.deliveryPostcode,
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

  /**
   * Fulfill a pre-order by capturing remaining payment and updating status
   * This should be called when the pre-order is ready to ship
   */
  async fulfillPreOrder(orderId: string): Promise<void> {
    const order = (
      await this.database.db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
    )[0];

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.isPreOrder) {
      throw new BadRequestException('Order is not a pre-order');
    }

    if (order.preOrderStatus !== PreOrderStatus.CONFIRMED) {
      throw new BadRequestException(
        `Pre-order must be in CONFIRMED status. Current status: ${order.preOrderStatus}`,
      );
    }

    const payment = order.paymentId
      ? (
          await this.database.db
            .select()
            .from(payments)
            .where(eq(payments.id, order.paymentId))
            .limit(1)
        )[0]
      : null;

    if (!payment) {
      throw new NotFoundException('Payment not found for order');
    }

    if (!payment.isPreOrderPayment) {
      throw new BadRequestException('Payment is not a pre-order payment');
    }

    // Update payment and order status
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          capturedAmount: payment.amount,
          status: PaymentStatus.PAID,
        })
        .where(eq(payments.id, payment.id));

      await tx
        .update(orders)
        .set({
          preOrderStatus: PreOrderStatus.FULFILLED,
          status: OrderStatus.PROCESSING,
        })
        .where(eq(orders.id, orderId));

      const orderItemsList = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      for (const orderItem of orderItemsList) {
        const storeItem = (
          await tx
            .select()
            .from(storeItems)
            .where(eq(storeItems.productId, orderItem.productId))
            .limit(1)
        )[0];

        if (!storeItem) {
          throw new NotFoundException(
            `Store item ${orderItem.productId} not found`,
          );
        }

        if ((storeItem.stock || 0) < orderItem.quantity) {
          throw new BadRequestException(
            `Insufficient stock to fulfill pre-order for ${storeItem.name}`,
          );
        }

        await tx
          .update(storeItems)
          .set({
            stock: sql`${storeItems.stock} - ${orderItem.quantity}`,
          })
          .where(eq(storeItems.productId, orderItem.productId));
      }

      // Finalize checkout (clear cart items)
      await this.finalizeStoreCheckout(tx, payment.id);
    });
  }
}
