import { CartItem, Product, StoreItem, User } from 'src/database/types';

export interface CartItemWithRelations extends CartItem {
  product: Product & {
    storeItem?: StoreItem | null;
  };
  user: Pick<
    User,
    | 'id'
    | 'email'
    | 'firstName'
    | 'lastName'
    | 'role'
    | 'profilePicture'
    | 'isActive'
    | 'createdAt'
    | 'updatedAt'
  >;
}

export interface CartSummary {
  totalItems: number;
  totalPrice: number;
  items: CartItemWithRelations[];
}
