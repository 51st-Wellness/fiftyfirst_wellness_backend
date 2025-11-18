import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  OrderWithRelations,
  OrderSummaryDto,
  OrderItemReviewDto,
} from './dto/order-response.dto';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import {
  orders,
  orderItems,
  products,
  storeItems,
  deliveryAddresses,
  payments,
  ProductType,
  PaymentStatus,
} from 'src/database/schema';
import {
  StoreItem,
  DeliveryAddress,
  Payment,
  Order,
  OrderItem,
} from 'src/database/types';
import { PaymentService } from 'src/modules/payment/payment.service';
import { ReviewService } from 'src/modules/review/review.service';
import { ProductReviewDto } from 'src/modules/review/dto/review-response.dto';

@Injectable()
export class OrderService {
  constructor(
    private readonly database: DatabaseService,
    private readonly paymentService: PaymentService,
    private readonly reviewService: ReviewService,
  ) {}

  // Get lightweight summaries for all orders for a user
  async getUserOrders(userId: string): Promise<OrderSummaryDto[]> {
    const userOrders: Order[] = await this.database.db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    if (userOrders.length === 0) {
      return [];
    }

    // Automatically verify the last PENDING order if it exists
    const lastOrder = userOrders[0];
    if (lastOrder.status === PaymentStatus.PENDING && lastOrder.paymentId) {
      try {
        // Verify payment status asynchronously (don't block the response)
        // This will check Stripe API and update if payment was successful
        this.paymentService
          .verifyPaymentStatus(lastOrder.paymentId)
          .catch((error) => {
            console.error(
              `Failed to verify payment ${lastOrder.paymentId} for order ${lastOrder.id}:`,
              error,
            );
          });
      } catch (error) {
        // Silently fail - don't block order retrieval
        console.error(
          `Error initiating payment verification for order ${lastOrder.id}:`,
          error,
        );
      }
    }

    const orderIds = userOrders.map((order) => order.id);

    const orderItemAggregates = await this.database.db
      .select({
        orderId: orderItems.orderId,
        itemCount: sql<number>`COUNT(*)`,
        totalQuantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds))
      .groupBy(orderItems.orderId);

    const aggregatesMap = new Map<
      string,
      { itemCount: number; totalQuantity: number }
    >();
    for (const aggregate of orderItemAggregates) {
      aggregatesMap.set(aggregate.orderId, {
        itemCount: Number(aggregate.itemCount ?? 0),
        totalQuantity: Number(aggregate.totalQuantity ?? 0),
      });
    }

    const paymentIds = userOrders
      .map((order) => order.paymentId)
      .filter((paymentId): paymentId is string => Boolean(paymentId));

    const paymentsMap = new Map<
      string,
      {
        status: Payment['status'];
        provider: Payment['provider'];
        currency: Payment['currency'];
      }
    >();

    if (paymentIds.length > 0) {
      const paymentSummaries = await this.database.db
        .select({
          id: payments.id,
          status: payments.status,
          provider: payments.provider,
          currency: payments.currency,
        })
        .from(payments)
        .where(inArray(payments.id, paymentIds));

      for (const payment of paymentSummaries) {
        paymentsMap.set(payment.id, {
          status: payment.status,
          provider: payment.provider,
          currency: payment.currency,
        });
      }
    }

    return userOrders.map((order) => {
      const aggregate = aggregatesMap.get(order.id);
      const paymentSummary = order.paymentId
        ? paymentsMap.get(order.paymentId)
        : null;

      return {
        ...order,
        itemCount: aggregate?.itemCount ?? 0,
        totalQuantity: aggregate?.totalQuantity ?? 0,
        paymentStatus: paymentSummary?.status ?? null,
        paymentProvider: paymentSummary?.provider ?? null,
        paymentCurrency: paymentSummary?.currency ?? null,
      };
    });
  }

  // Get a single order by ID for a user
  async getUserOrder(
    userId: string,
    orderId: string,
  ): Promise<OrderWithRelations | null> {
    // Fetch the order
    const order = (
      await this.database.db.select().from(orders).where(eq(orders.id, orderId))
    )[0];

    if (!order || order.userId !== userId) {
      return null;
    }

    // Fetch order items
    const items = await this.database.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    const [enrichedItems, reviewMap] = await Promise.all([
      this.enrichOrderItems(items),
      this.reviewService.getReviewMapForOrderItems(
        items.map((item) => item.id),
      ),
    ]);

    // Fetch delivery address if exists
    let deliveryAddress: DeliveryAddress | null = null;
    if (order.deliveryAddressId) {
      const result = (
        await this.database.db
          .select()
          .from(deliveryAddresses)
          .where(eq(deliveryAddresses.id, order.deliveryAddressId))
      )[0];
      if (result) {
        deliveryAddress = result;
      }
    }

    // Fetch payment if exists
    let payment: Payment | null = null;
    if (order.paymentId) {
      const result = (
        await this.database.db
          .select()
          .from(payments)
          .where(eq(payments.id, order.paymentId))
      )[0];
      if (result) {
        payment = result;
      }
    }

    const itemCount = enrichedItems.length;
    const totalQuantity = enrichedItems.reduce(
      (total, item) => total + (item.quantity ?? 0),
      0,
    );

    return {
      ...order,
      orderItems: enrichedItems.map((item) => ({
        ...item,
        review: this.mapReviewForOrderItem(reviewMap.get(item.id)),
      })),
      deliveryAddress,
      payment,
      itemCount,
      totalQuantity,
      paymentStatus: payment?.status ?? null,
      paymentProvider: payment?.provider ?? null,
      paymentCurrency: payment?.currency ?? null,
    };
  }

  // enrichOrderItems hydrates order items with product context
  private async enrichOrderItems(orderItemsList: OrderItem[]) {
    return Promise.all(
      orderItemsList.map(async (item) => {
        const product = (
          await this.database.db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
        )[0];

        let storeItem: StoreItem | null = null;
        if (product && product.type === ProductType.STORE) {
          const result = (
            await this.database.db
              .select()
              .from(storeItems)
              .where(eq(storeItems.productId, item.productId))
          )[0];
          if (result) {
            storeItem = result;
          }
        }

        return {
          ...item,
          product: {
            ...product,
            storeItem,
          },
        };
      }),
    );
  }

  // mapReviewForOrderItem trims the review information for dashboards
  private mapReviewForOrderItem(
    review?: ProductReviewDto,
  ): OrderItemReviewDto | null {
    if (!review) {
      return null;
    }

    return {
      id: review.id,
      rating: review.rating,
      status: review.status,
      comment: review.comment,
      createdAt: review.createdAt,
    };
  }
}
