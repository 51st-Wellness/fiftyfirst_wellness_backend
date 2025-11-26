import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  OrderWithRelations,
  OrderSummaryDto,
  OrderItemReviewDto,
  AdminOrderListItem,
  AdminOrderDetail,
  OrderCustomerDto,
} from './dto/order-response.dto';
import { eq, desc, inArray, sql, and, or, SQL } from 'drizzle-orm';
import {
  orders,
  orderItems,
  products,
  storeItems,
  deliveryAddresses,
  payments,
  users,
  ProductType,
  OrderStatus,
  PreOrderStatus,
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
import { EmailService } from 'src/modules/notification/email/email.service';
import { EmailType } from 'src/modules/notification/email/constants/email.enum';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { PreOrderBulkEmailDto } from './dto/pre-order-bulk-email.dto';
import { ClickDropService } from 'src/modules/tracking/royal-mail/click-drop.service';
import { CreateOrderRequest } from 'src/modules/tracking/royal-mail/click-drop.types';

@Injectable()
export class OrderService {
  private readonly frontendBaseUrl: string;
  private readonly supportEmail: string;

  constructor(
    private readonly database: DatabaseService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    private readonly reviewService: ReviewService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly clickDropService: ClickDropService,
  ) {
    const fallbackUrl = 'https://fiftyfirstswellness.com';
    const envUrl = this.configService.get(ENV.FRONTEND_URL, fallbackUrl);
    this.frontendBaseUrl = (envUrl || fallbackUrl).replace(/\/$/, '');
    this.supportEmail = this.configService.get(
      ENV.COMPANY_EMAIL,
      'support@fiftyfirstswellness.com',
    );
  }

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
    if (lastOrder.status === OrderStatus.PENDING && lastOrder.paymentId) {
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

  async getAdminOrders(params: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    search?: string;
  }): Promise<{
    orders: AdminOrderListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 10;
    const offset = (page - 1) * limit;

    const filters: SQL<unknown>[] = [];
    if (params.status) {
      filters.push(eq(orders.status, params.status));
    }
    if (params.search) {
      const likeQuery = `%${params.search}%`;
      filters.push(
        or(
          sql`${orders.id} LIKE ${likeQuery}`,
          sql`LOWER(${users.firstName} || ' ' || ${users.lastName}) LIKE LOWER(${likeQuery})`,
          sql`${users.email} LIKE ${likeQuery}`,
        ) as SQL<unknown>,
      );
    }
    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [countResult, orderRows] = await Promise.all([
      this.database.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(whereClause as any),
      this.database.db
        .select({
          order: orders,
          userId: users.id,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
          userPhone: users.phone,
          paymentStatus: payments.status,
          paymentProvider: payments.provider,
          paymentCurrency: payments.currency,
          paymentAmount: payments.amount,
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .leftJoin(payments, eq(orders.paymentId, payments.id))
        .where(whereClause as any)
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const orderIds = orderRows.map((row) => row.order.id);
    const itemsMap = new Map<
      string,
      { productId: string; name: string | null; quantity: number }[]
    >();

    if (orderIds.length > 0) {
      const orderItemsResult = await this.database.db
        .select({
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          quantity: orderItems.quantity,
          name: storeItems.name,
        })
        .from(orderItems)
        .leftJoin(storeItems, eq(orderItems.productId, storeItems.productId))
        .where(inArray(orderItems.orderId, orderIds));

      for (const item of orderItemsResult) {
        const list = itemsMap.get(item.orderId) ?? [];
        list.push({
          productId: item.productId,
          name: item.name ?? null,
          quantity: item.quantity ?? 0,
        });
        itemsMap.set(item.orderId, list);
      }
    }

    const toCustomer = (row: {
      userId: string | null;
      userFirstName: string | null;
      userLastName: string | null;
      userEmail: string | null;
      userPhone: string | null;
    }): OrderCustomerDto => ({
      id: row.userId ?? '',
      firstName: row.userFirstName ?? null,
      lastName: row.userLastName ?? null,
      email: row.userEmail ?? '',
      phone: row.userPhone ?? null,
    });

    const formattedOrders: AdminOrderListItem[] = orderRows.map((row) => {
      const items = itemsMap.get(row.order.id) ?? [];
      const totalQuantity = items.reduce(
        (sum, item) => sum + (item.quantity ?? 0),
        0,
      );
      return {
        ...row.order,
        itemCount: items.length,
        totalQuantity,
        paymentStatus: row.paymentStatus ?? null,
        paymentProvider: row.paymentProvider ?? null,
        paymentCurrency: row.paymentCurrency ?? null,
        paymentAmount: row.paymentAmount ?? null,
        customer: toCustomer({
          userId: row.userId ?? row.order.userId,
          userFirstName: row.userFirstName,
          userLastName: row.userLastName,
          userEmail: row.userEmail,
          userPhone: row.userPhone,
        }),
        items,
      };
    });

    const total = countResult[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getAdminOrder(orderId: string): Promise<AdminOrderDetail | null> {
    const record = (
      await this.database.db
        .select({
          order: orders,
          userId: users.id,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
          userPhone: users.phone,
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(eq(orders.id, orderId))
        .limit(1)
    )[0];

    if (!record) {
      return null;
    }

    const detailedOrder = await this.getUserOrder(
      record.order.userId,
      record.order.id,
    );

    if (!detailedOrder) {
      return null;
    }

    return {
      ...detailedOrder,
      customer: {
        id: record.userId ?? record.order.userId,
        firstName: record.userFirstName ?? null,
        lastName: record.userLastName ?? null,
        email: record.userEmail ?? '',
        phone: record.userPhone ?? null,
      },
    };
  }

  async updateAdminOrderStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<AdminOrderDetail | null> {
    await this.database.db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId));

    return this.getAdminOrder(orderId);
  }

  async getPreOrders(params: {
    page?: number;
    limit?: number;
    preOrderStatus?: PreOrderStatus;
    search?: string;
  }): Promise<{
    orders: AdminOrderListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 10;
    const offset = (page - 1) * limit;

    const filters: SQL<unknown>[] = [eq(orders.isPreOrder, true)];

    if (params.preOrderStatus) {
      filters.push(eq(orders.preOrderStatus, params.preOrderStatus));
    }

    if (params.search) {
      const likeQuery = `%${params.search}%`;
      filters.push(
        or(
          sql`${orders.id} LIKE ${likeQuery}`,
          sql`LOWER(${users.firstName} || ' ' || ${users.lastName}) LIKE LOWER(${likeQuery})`,
          sql`${users.email} LIKE ${likeQuery}`,
        ) as SQL<unknown>,
      );
    }

    const whereClause = and(...filters);

    const [countResult, orderRows] = await Promise.all([
      this.database.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(whereClause as any),
      this.database.db
        .select({
          order: orders,
          userId: users.id,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
          userPhone: users.phone,
          paymentStatus: payments.status,
          paymentProvider: payments.provider,
          paymentCurrency: payments.currency,
          paymentAmount: payments.amount,
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .leftJoin(payments, eq(orders.paymentId, payments.id))
        .where(whereClause as any)
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const orderIds = orderRows.map((row) => row.order.id);
    const itemsMap = new Map<
      string,
      {
        productId: string;
        name: string | null;
        quantity: number;
        price: number;
      }[]
    >();

    if (orderIds.length > 0) {
      const orderItemsResult = await this.database.db
        .select({
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          quantity: orderItems.quantity,
          price: orderItems.price,
          name: storeItems.name,
        })
        .from(orderItems)
        .leftJoin(storeItems, eq(orderItems.productId, storeItems.productId))
        .where(inArray(orderItems.orderId, orderIds));

      for (const item of orderItemsResult) {
        const list = itemsMap.get(item.orderId) ?? [];
        list.push({
          productId: item.productId,
          name: item.name ?? null,
          quantity: item.quantity ?? 0,
          price: item.price ?? 0,
        });
        itemsMap.set(item.orderId, list);
      }
    }

    const toCustomer = (row: {
      userId: string | null;
      userFirstName: string | null;
      userLastName: string | null;
      userEmail: string | null;
      userPhone: string | null;
    }): OrderCustomerDto => ({
      id: row.userId ?? '',
      firstName: row.userFirstName ?? null,
      lastName: row.userLastName ?? null,
      email: row.userEmail ?? '',
      phone: row.userPhone ?? null,
    });

    const formattedOrders: AdminOrderListItem[] = orderRows.map((row) => {
      const items = itemsMap.get(row.order.id) ?? [];
      const totalQuantity = items.reduce(
        (sum, item) => sum + (item.quantity ?? 0),
        0,
      );
      return {
        ...row.order,
        itemCount: items.length,
        totalQuantity,
        paymentStatus: row.paymentStatus ?? null,
        paymentProvider: row.paymentProvider ?? null,
        paymentCurrency: row.paymentCurrency ?? null,
        paymentAmount: row.paymentAmount ?? null,
        customer: toCustomer({
          userId: row.userId ?? row.order.userId,
          userFirstName: row.userFirstName,
          userLastName: row.userLastName,
          userEmail: row.userEmail,
          userPhone: row.userPhone,
        }),
        items: items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
        })),
      };
    });

    const total = countResult[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async sendBulkEmailToPreOrders(dto: PreOrderBulkEmailDto) {
    // Get product details
    const productResult = await this.database.db
      .select()
      .from(storeItems)
      .where(eq(storeItems.productId, dto.productId))
      .limit(1);

    if (productResult.length === 0) {
      throw new NotFoundException('Product not found');
    }

    const product = productResult[0];

    // Build filters for pre-orders
    const filters: SQL<unknown>[] = [
      eq(orders.isPreOrder, true),
      sql`EXISTS (
        SELECT 1 FROM ${orderItems} 
        WHERE ${orderItems.orderId} = ${orders.id} 
        AND ${orderItems.productId} = ${dto.productId}
      )`,
    ];

    if (dto.preOrderStatus) {
      filters.push(
        eq(orders.preOrderStatus, dto.preOrderStatus as PreOrderStatus),
      );
    }

    const whereClause = and(...filters);

    // Get all pre-orders for this product
    const preOrderRows = await this.database.db
      .select({
        order: orders,
        userId: users.id,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(whereClause as any);

    if (preOrderRows.length === 0) {
      throw new BadRequestException(
        'No pre-orders found for this product with the specified criteria',
      );
    }

    const productUrl = `${this.frontendBaseUrl}/marketplace/${dto.productId}`;

    // Send emails to all pre-order customers
    const sendResults = await Promise.allSettled(
      preOrderRows.map((row) => {
        const user = row.userEmail
          ? {
              email: row.userEmail,
              firstName: row.userFirstName,
              lastName: row.userLastName,
            }
          : null;

        if (!user?.email) {
          return Promise.resolve(false);
        }

        const fallbackName =
          user.firstName ||
          user.lastName ||
          user.email.split('@')[0] ||
          'there';

        return this.emailService.sendMail({
          to: user.email,
          type: EmailType.PRODUCT_AVAILABILITY_NOTIFICATION,
          subjectOverride: dto.subject,
          context: {
            firstName: fallbackName,
            productName: product.name,
            productDescription: product.description,
            productImage:
              (product.display as any)?.url ||
              (Array.isArray(product.images) ? product.images[0] : undefined),
            productUrl,
            ctaText: 'View Product',
            message: dto.message,
            supportEmail: this.supportEmail,
          },
        });
      }),
    );

    const successfullySent = sendResults.filter(
      (result) => result.status === 'fulfilled' && result.value === true,
    ).length;

    return {
      totalSent: successfullySent,
      totalPreOrders: preOrderRows.length,
      productName: product.name,
    };
  }

  // Submit order to Click & Drop API after payment confirmation
  async submitOrderToClickDrop(orderId: string): Promise<void> {
    try {
      // Get order with all related data
      const orderData = await this.database.db
        .select({
          order: orders,
          address: deliveryAddresses,
          user: users,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .leftJoin(
          deliveryAddresses,
          eq(orders.deliveryAddressId, deliveryAddresses.id),
        )
        .leftJoin(users, eq(orders.userId, users.id))
        .limit(1);

      if (!orderData || orderData.length === 0) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      const { order, address, user } = orderData[0];

      if (!address) {
        throw new BadRequestException(
          `Order ${orderId} has no delivery address`,
        );
      }

      if (!order.parcelWeight || !order.serviceCode) {
        throw new BadRequestException(
          `Order ${orderId} missing shipping details`,
        );
      }

      // Get order items with product details
      const items = await this.database.db
        .select({
          orderItem: orderItems,
          product: products,
          storeItem: storeItems,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(storeItems, eq(products.id, storeItems.productId));

      // Build Click & Drop order request
      const clickDropRequest: CreateOrderRequest = {
        orderReference: orderId.substring(0, 40), // Max 40 chars
        recipient: {
          address: {
            fullName: address.recipientName,
            addressLine1: address.addressLine1,
            city: address.postTown,
            postcode: address.postcode || undefined,
            countryCode: 'GB', // UK only for now
          },
          phoneNumber: address.contactPhone,
          emailAddress: user?.email,
        },
        packages: [
          {
            weightInGrams: order.parcelWeight,
            packageFormatIdentifier:
              (order.packageFormatIdentifier as any) || 'parcel',
            dimensions: order.parcelDimensions as any,
            contents: items.map((item) => {
              // Click & Drop requires both UnitValue and UnitWeightInGrams when SKU is not provided
              // Ensure both are valid positive numbers
              const unitValue =
                item.orderItem.price && item.orderItem.price > 0
                  ? item.orderItem.price
                  : 0.01; // Minimum value if price is 0 or null

              const unitWeightInGrams =
                item.storeItem?.weight && item.storeItem.weight > 0
                  ? Math.round(item.storeItem.weight)
                  : 100; // Default 100g if weight is 0, null, or undefined

              const contentItem: any = {
                name: item.storeItem?.name || 'Product',
                quantity: item.orderItem.quantity,
                unitValue,
                unitWeightInGrams,
              };

              // Include SKU if available (productId can serve as SKU)
              if (item.product?.id) {
                contentItem.SKU = item.product.id.substring(0, 100); // Max 100 chars
              }

              return contentItem;
            }),
          },
        ],
        orderDate: order.createdAt.toISOString(),
        subtotal: order.totalAmount - (order.shippingCost || 0),
        shippingCostCharged: order.shippingCost || 0,
        total: order.totalAmount,
        currencyCode: 'GBP',
        postageDetails: {
          serviceCode: order.serviceCode,
          sendNotificationsTo: 'recipient',
          // Note: receiveEmailNotification removed as OLP2 service doesn't support it
        },
        specialInstructions: address.deliveryInstructions || undefined,
      };

      // Submit to Click & Drop
      const response = await this.clickDropService.createOrders({
        items: [clickDropRequest],
      });

      // Check if order was created successfully
      if (response.createdOrders && response.createdOrders.length > 0) {
        const createdOrder = response.createdOrders[0];

        // Update order with Click & Drop details
        const statusHistory = (order.statusHistory as any[]) || [];
        statusHistory.push({
          status: 'INFORECEIVED',
          timestamp: new Date().toISOString(),
          note: 'Order submitted to Click & Drop',
          clickDropOrderIdentifier: createdOrder.orderIdentifier,
        });

        await this.database.db
          .update(orders)
          .set({
            clickDropOrderIdentifier: createdOrder.orderIdentifier,
            labelBase64: createdOrder.label,
            status: OrderStatus.INFORECEIVED,
            statusHistory,
          })
          .where(eq(orders.id, orderId));

        console.log(
          `Order ${orderId} successfully submitted to Click & Drop (ID: ${createdOrder.orderIdentifier})`,
        );
      } else if (response.failedOrders && response.failedOrders.length > 0) {
        const errors = response.failedOrders[0].errors;
        console.error(
          `Failed to submit order ${orderId} to Click & Drop:`,
          JSON.stringify(errors, null, 2),
        );
        // Don't throw - allow manual retry by admin
        // Log error prominently for admin review
      }
    } catch (error) {
      console.error(
        `Error submitting order ${orderId} to Click & Drop:`,
        error,
      );
      // Don't throw - allow order to remain in PENDING status for manual handling
    }
  }
}
