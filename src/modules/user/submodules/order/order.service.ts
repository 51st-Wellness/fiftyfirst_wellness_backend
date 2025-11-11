import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OrderWithRelations } from './dto/order-response.dto';
import { eq, desc } from 'drizzle-orm';
import {
  orders,
  orderItems,
  products,
  storeItems,
  deliveryAddresses,
  payments,
  ProductType,
} from 'src/database/schema';
import { StoreItem, DeliveryAddress, Payment } from 'src/database/types';

@Injectable()
export class OrderService {
  constructor(private readonly database: DatabaseService) {}

  // Get all orders for a user with full details
  async getUserOrders(userId: string): Promise<OrderWithRelations[]> {
    // Fetch all orders for the user
    const userOrders = await this.database.db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    // Enrich each order with order items, delivery address, and payment
    const enrichedOrders: OrderWithRelations[] = [];

    for (const order of userOrders) {
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

      enrichedOrders.push({
        ...order,
        orderItems: enrichedItems,
        deliveryAddress,
        payment,
      });
    }

    return enrichedOrders;
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

    return {
      ...order,
      orderItems: enrichedItems,
      deliveryAddress,
      payment,
    };
  }
}
