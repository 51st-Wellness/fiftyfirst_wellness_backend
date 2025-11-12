import {
  Order,
  OrderItem,
  Product,
  StoreItem,
  DeliveryAddress,
  Payment,
} from 'src/database/types';

// Order item with product details
export interface OrderItemWithProduct extends OrderItem {
  product: Product & {
    storeItem?: StoreItem | null;
  };
}

// Order with all relations
export interface OrderWithRelations extends OrderSummaryDto {
  orderItems: OrderItemWithProduct[];
  deliveryAddress?: DeliveryAddress | null;
  payment?: Payment | null;
}

// Lightweight order summary used for listing orders quickly
export interface OrderSummaryDto extends Order {
  itemCount: number;
  totalQuantity: number;
  paymentStatus?: Payment['status'] | null;
  paymentProvider?: Payment['provider'] | null;
  paymentCurrency?: Payment['currency'] | null;
}
