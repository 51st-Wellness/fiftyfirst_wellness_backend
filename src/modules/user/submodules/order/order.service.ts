import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OrderWithRelations, OrderSummaryDto } from './dto/order-response.dto';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import {
  orders,
  orderItems,
  products,
  storeItems,
  deliveryAddresses,
  payments,
  ProductType,
} from 'src/database/schema';
import { StoreItem, DeliveryAddress, Payment, Order } from 'src/database/types';

@Injectable()
export class OrderService {
  constructor(private readonly database: DatabaseService) {}

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

    // Enrich order items with product details
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
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
      orderItems: enrichedItems,
      deliveryAddress,
      payment,
      itemCount,
      totalQuantity,
      paymentStatus: payment?.status ?? null,
      paymentProvider: payment?.provider ?? null,
      paymentCurrency: payment?.currency ?? null,
    };
  }
}
