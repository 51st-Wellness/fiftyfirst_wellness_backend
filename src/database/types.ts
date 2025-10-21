import {
  users,
  products,
  storeItems,
  programmes,
  podcasts,
  orders,
  orderItems,
  payments,
  subscriptions,
  subscriptionPlans,
  subscriptionAccess,
  passwordResetOTPs,
  emailVerificationOTPs,
  reviews,
  blogs,
  cartItems,
  bookmarks,
  aiConversations,
} from './schema';

// Infer types from Drizzle schema
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Export individual table types for backward compatibility
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;

export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type StoreItem = typeof storeItems.$inferSelect;
export type NewStoreItem = typeof storeItems.$inferInsert;

export type Programme = typeof programmes.$inferSelect;
export type NewProgramme = typeof programmes.$inferInsert;

export type Podcast = typeof podcasts.$inferSelect;
export type NewPodcast = typeof podcasts.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export type SubscriptionAccess = typeof subscriptionAccess.$inferSelect;
export type NewSubscriptionAccess = typeof subscriptionAccess.$inferInsert;

export type PasswordResetOTP = typeof passwordResetOTPs.$inferSelect;
export type NewPasswordResetOTP = typeof passwordResetOTPs.$inferInsert;

export type EmailVerificationOTP = typeof emailVerificationOTPs.$inferSelect;
export type NewEmailVerificationOTP = typeof emailVerificationOTPs.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;

export type Blog = typeof blogs.$inferSelect;
export type NewBlog = typeof blogs.$inferInsert;

export type AIConversation = typeof aiConversations.$inferSelect;
export type NewAIConversation = typeof aiConversations.$inferInsert;

// Complex types for relations
export type UserWithRelations = User & {
  orders?: Order[];
  aiConversations?: AIConversation[];
  cart?: CartItem[];
  bookmarks?: Bookmark[];
  reviews?: Review[];
  subscriptions?: Subscription[];
};

export type ProductWithStoreItem = Product & {
  storeItem?: StoreItem;
};

export type OrderWithItems = Order & {
  orderItems?: (OrderItem & {
    product?: ProductWithStoreItem;
  })[];
};

export type PaymentWithRelations = Payment & {
  orders?: OrderWithItems[];
  subscriptions?: (Subscription & {
    plan?: SubscriptionPlan;
  })[];
};

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}
