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
export interface OrderWithRelations extends Order {
  orderItems: OrderItemWithProduct[];
  deliveryAddress?: DeliveryAddress | null;
  payment?: Payment | null;
}
