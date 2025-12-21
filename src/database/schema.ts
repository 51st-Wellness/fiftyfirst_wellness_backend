import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums as const assertions for type safety and Postgres Enums
export const userRoles = ['USER', 'ADMIN', 'MODERATOR'] as const;
export const userRoleEnum = pgEnum('user_role', userRoles);
export type UserRole = (typeof userRoles)[number];

export const paymentStatuses = [
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;
export const paymentStatusEnum = pgEnum('payment_status', paymentStatuses);
export type PaymentStatus = (typeof paymentStatuses)[number];

export const orderStatuses = [
  'FAILED',
  'PENDING',
  'PAID',
  'PROCESSING',
  'NOTFOUND',
  'DISPATCHED',
  'TRANSIT',
  'PICKUP',
  'UNDELIVERED',
  'DELIVERED',
  'EXCEPTION',
  'EXPIRED',
] as const;
export const orderStatusEnum = pgEnum('order_status', orderStatuses);
export type OrderStatus = (typeof orderStatuses)[number];

export const paymentProviders = ['PAYPAL', 'STRIPE', 'FLUTTERWAVE'] as const;
export const paymentProviderEnum = pgEnum('payment_provider', paymentProviders);
export type PaymentProvider = (typeof paymentProviders)[number];

export const currencies = ['USD', 'NGN', 'EUR', 'GBP'] as const;
export const currencyEnum = pgEnum('currency', currencies);
export type Currency = (typeof currencies)[number];

export const accessItems = [
  'PODCAST_ACCESS',
  'PROGRAMME_ACCESS',
  'ALL_ACCESS',
] as const;
export const accessItemEnum = pgEnum('access_item', accessItems);
export type AccessItem = (typeof accessItems)[number];

export const productTypes = ['STORE', 'PROGRAMME', 'PODCAST'] as const;
export const productTypeEnum = pgEnum('product_type', productTypes);
export type ProductType = (typeof productTypes)[number];

export const categoryServices = ['store', 'programme', 'podcast'] as const;
export const categoryServiceEnum = pgEnum('category_service', categoryServices);
export type CategoryService = (typeof categoryServices)[number];

export const pricingModels = ['ONE_TIME', 'SUBSCRIPTION', 'FREE'] as const;
export const pricingModelEnum = pgEnum('pricing_model', pricingModels);
export type PricingModel = (typeof pricingModels)[number];

export const reviewStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const reviewStatusEnum = pgEnum('review_status', reviewStatuses);
export type ReviewStatus = (typeof reviewStatuses)[number];

export const preOrderStatuses = [
  'PLACED',
  'CONFIRMED',
  'FULFILLED',
  'CANCELLED',
] as const;
export const preOrderStatusEnum = pgEnum('pre_order_status', preOrderStatuses);
export type PreOrderStatus = (typeof preOrderStatuses)[number];

export const productSubscriberStatuses = ['PENDING', 'NOTIFIED'] as const;
export const productSubscriberStatusEnum = pgEnum(
  'product_subscriber_status',
  productSubscriberStatuses,
);
export type ProductSubscriberStatus =
  (typeof productSubscriberStatuses)[number];

export const discountTypes = ['NONE', 'PERCENTAGE', 'FLAT'] as const;
export const discountTypeEnum = pgEnum('discount_type', discountTypes);
export type DiscountType = (typeof discountTypes)[number];

// Enum objects for backwards compatibility with Prisma code
export const UserRole = {
  USER: 'USER' as const,
  ADMIN: 'ADMIN' as const,
  MODERATOR: 'MODERATOR' as const,
};

export const PaymentStatus = {
  PENDING: 'PENDING' as const,
  PAID: 'PAID' as const,
  FAILED: 'FAILED' as const,
  CANCELLED: 'CANCELLED' as const,
  REFUNDED: 'REFUNDED' as const,
};

export const OrderStatus = {
  FAILED: 'FAILED' as const,
  PENDING: 'PENDING' as const,
  PAID: 'PAID' as const,
  PROCESSING: 'PROCESSING' as const,
  DISPATCHED: 'DISPATCHED' as const,
  TRANSIT: 'TRANSIT' as const,
  PICKUP: 'PICKUP' as const,
  UNDELIVERED: 'UNDELIVERED' as const,
  DELIVERED: 'DELIVERED' as const,
  NOTFOUND: 'NOTFOUND' as const,
  EXCEPTION: 'EXCEPTION' as const,
  EXPIRED: 'EXPIRED' as const,
};

export const PaymentProvider = {
  PAYPAL: 'PAYPAL' as const,
  STRIPE: 'STRIPE' as const,
  FLUTTERWAVE: 'FLUTTERWAVE' as const,
};

export const Currency = {
  USD: 'USD' as const,
  NGN: 'NGN' as const,
  EUR: 'EUR' as const,
  GBP: 'GBP' as const,
};

export const AccessItem = {
  PODCAST_ACCESS: 'PODCAST_ACCESS' as const,
  PROGRAMME_ACCESS: 'PROGRAMME_ACCESS' as const,
  ALL_ACCESS: 'ALL_ACCESS' as const,
};

export const ProductType = {
  STORE: 'STORE' as const,
  PROGRAMME: 'PROGRAMME' as const,
  PODCAST: 'PODCAST' as const,
};

export const PricingModel = {
  ONE_TIME: 'ONE_TIME' as const,
  SUBSCRIPTION: 'SUBSCRIPTION' as const,
  FREE: 'FREE' as const,
};

export const ReviewStatus = {
  PENDING: 'PENDING' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
};

export const PreOrderStatus = {
  PLACED: 'PLACED' as const,
  CONFIRMED: 'CONFIRMED' as const,
  FULFILLED: 'FULFILLED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export const ProductSubscriberStatus = {
  PENDING: 'PENDING' as const,
  NOTIFIED: 'NOTIFIED' as const,
};

// Core tables
export const users = pgTable('User', {
  id: text('id').primaryKey(), // Keeping text to match previous behavior
  email: text('email').notNull().unique(),
  password: text('password'),
  firstName: text('firstName').notNull(),
  lastName: text('lastName').notNull(),
  phone: text('phone'),
  googleId: text('googleId').unique(),
  role: userRoleEnum('role').notNull().default('USER'),
  bio: text('bio'),
  profilePicture: text('profilePicture'),
  isActive: boolean('isActive').notNull().default(true),
  isEmailVerified: boolean('isEmailVerified').notNull().default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
  deletedAt: timestamp('deletedAt'),
});

export const passwordResetOTPs = pgTable('PasswordResetOTP', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().unique(),
  otp: text('otp').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const emailVerificationOTPs = pgTable('EmailVerificationOTP', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().unique(),
  otp: text('otp').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const subscriptionPlans = pgTable('SubscriptionPlan', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: doublePrecision('price').notNull(),
  duration: integer('duration').notNull(),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const subscriptionAccess = pgTable('SubscriptionAccess', {
  id: text('id').primaryKey(),
  planId: text('planId').notNull(),
  accessItem: accessItemEnum('accessItem').notNull(),
});

export const subscriptions = pgTable('Subscription', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  planId: text('planId').notNull(),
  status: paymentStatusEnum('status').notNull().default('PENDING'),
  startDate: timestamp('startDate').notNull(),
  endDate: timestamp('endDate').notNull(),
  autoRenew: boolean('autoRenew').notNull().default(true),
  paymentId: text('paymentId'),
  providerSubscriptionId: text('providerSubscriptionId'),
  invoiceId: text('invoiceId'),
  billingCycle: integer('billingCycle').notNull().default(1),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const payments = pgTable('Payment', {
  id: text('id').primaryKey(),
  provider: paymentProviderEnum('provider').notNull(),
  providerRef: text('providerRef'),
  status: paymentStatusEnum('status').notNull().default('PENDING'),
  currency: currencyEnum('currency').notNull(),
  amount: doublePrecision('amount').notNull(),
  capturedAmount: doublePrecision('capturedAmount').notNull().default(0),
  authorizedAmount: doublePrecision('authorizedAmount').notNull().default(0),
  isPreOrderPayment: boolean('isPreOrderPayment').notNull().default(false),
  finalPaymentId: text('finalPaymentId'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const products = pgTable('Product', {
  id: text('id').primaryKey(),
  type: productTypeEnum('type').notNull(),
  pricingModel: pricingModelEnum('pricingModel').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const storeItems = pgTable('StoreItem', {
  productId: text('productId').primaryKey().unique(),
  name: text('name').notNull(),
  description: text('description'),
  productUsage: text('productUsage'),
  productBenefits: text('productBenefits'),
  productIngredients: jsonb('productIngredients'),
  price: doublePrecision('price').notNull(),
  stock: integer('stock').notNull().default(0),
  display: jsonb('display').notNull(),
  images: jsonb('images').notNull(),
  categories: jsonb('categories').notNull(),
  isFeatured: boolean('isFeatured').notNull().default(false),
  isPublished: boolean('isPublished').notNull().default(true),
  discountType: discountTypeEnum('discountType').notNull().default('NONE'),
  discountValue: doublePrecision('discountValue').notNull().default(0),
  discountActive: boolean('discountActive').notNull().default(false),
  discountStart: timestamp('discountStart'),
  discountEnd: timestamp('discountEnd'),
  preOrderEnabled: boolean('preOrderEnabled').notNull().default(false),
  weight: doublePrecision('weight'),
  length: doublePrecision('length'),
  width: doublePrecision('width'),
  height: doublePrecision('height'),
  deletedAt: timestamp('deletedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const programmes = pgTable('Programme', {
  productId: text('productId').primaryKey().unique(),
  title: text('title').notNull(),
  description: text('description'),
  muxAssetId: text('muxAssetId').unique(),
  muxPlaybackId: text('muxPlaybackId').unique(),
  isPublished: boolean('isPublished').notNull().default(false),
  isFeatured: boolean('isFeatured').notNull().default(false),
  thumbnail: text('thumbnail'),
  requiresAccess: accessItemEnum('requiresAccess').notNull(),
  duration: integer('duration').notNull(),
  categories: jsonb('categories'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const podcasts = pgTable('Podcast', {
  productId: text('productId').primaryKey().unique(),
  title: text('title').notNull(),
  description: text('description'),
  muxAssetId: text('muxAssetId').notNull().unique(),
  muxPlaybackId: text('muxPlaybackId').notNull().unique(),
  isPublished: boolean('isPublished').notNull().default(true),
  isFeatured: boolean('isFeatured').notNull().default(false),
  thumbnail: text('thumbnail'),
  requiresAccess: accessItemEnum('requiresAccess').notNull(),
  duration: integer('duration').notNull(),
  categories: jsonb('categories'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
  podcastProductId: text('podcastProductId').notNull(),
});

export const deliveryAddresses = pgTable('DeliveryAddress', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  recipientName: text('recipientName').notNull(),
  contactPhone: text('contactPhone').notNull(),
  addressLine1: text('addressLine1').notNull(),
  postTown: text('postTown').notNull(),
  postcode: text('postcode').notNull().default('NOT SET'),
  deliveryInstructions: text('deliveryInstructions'),
  isDefault: boolean('isDefault').notNull().default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
  deletedAt: timestamp('deletedAt'),
});

export const settings = pgTable('Setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  category: text('category'),
  isEditable: boolean('isEditable').notNull().default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const orders = pgTable('Order', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  status: orderStatusEnum('status').notNull().default('PENDING'),
  totalAmount: doublePrecision('totalAmount').notNull(),
  previewImage: text('previewImage'),
  paymentId: text('paymentId'),
  deliveryAddressId: text('deliveryAddressId'),
  isPreOrder: boolean('isPreOrder').notNull().default(false),
  preOrderStatus: preOrderStatusEnum('preOrderStatus'),
  expectedFulfillmentDate: timestamp('expectedFulfillmentDate'),
  fulfillmentNotes: text('fulfillmentNotes'),
  clickDropOrderIdentifier: integer('clickDropOrderIdentifier'),
  packageFormatIdentifier: text('packageFormatIdentifier'),
  serviceCode: text('serviceCode'),
  shippingCost: doublePrecision('shippingCost'),
  parcelWeight: integer('parcelWeight'),
  parcelDimensions: jsonb('parcelDimensions'),
  labelBase64: text('labelBase64'),
  trackingNumber: text('trackingNumber'),
  statusHistory: jsonb('statusHistory'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const orderItems = pgTable('OrderItem', {
  id: text('id').primaryKey(),
  orderId: text('orderId').notNull(),
  productId: text('productId').notNull(),
  quantity: integer('quantity').notNull(),
  price: doublePrecision('price').notNull(),
  preOrderReleaseDate: timestamp('preOrderReleaseDate'),
});

export const reviews = pgTable('Review', {
  id: text('id').primaryKey(),
  productId: text('productId').notNull(),
  userId: text('userId').notNull(),
  orderId: text('orderId').notNull().default('LEGACY_ORDER_LINK'),
  orderItemId: text('orderItemId').notNull().default('LEGACY_ORDER_ITEM_LINK'),
  status: reviewStatusEnum('status').notNull().default('PENDING'),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const blogs = pgTable('Blogs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  contentKey: text('contentKey').notNull(),
  isFeatured: boolean('isFeatured').notNull().default(false),
  isPublished: boolean('isPublished').notNull().default(true),
  categories: jsonb('categories').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const cartItems = pgTable('CartItem', {
  id: text('id').primaryKey(),
  productId: text('productId').notNull(),
  quantity: integer('quantity').notNull(),
  userId: text('userId').notNull(),
});

export const bookmarks = pgTable('Bookmark', {
  id: text('id').primaryKey(),
  productId: text('productId').notNull(),
  userId: text('userId').notNull(),
});

export const aiConversations = pgTable('AIConversation', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  messages: jsonb('messages').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const categories = pgTable('Category', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  service: categoryServiceEnum('service').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const productSubscribers = pgTable('ProductSubscriber', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  productId: text('productId').notNull(),
  status: productSubscriberStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .$onUpdateFn(() => new Date()),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  passwordResetOTP: one(passwordResetOTPs, {
    fields: [users.id],
    references: [passwordResetOTPs.userId],
  }),
  emailVerificationOTP: one(emailVerificationOTPs, {
    fields: [users.id],
    references: [emailVerificationOTPs.userId],
  }),
  orders: many(orders),
  aiConversations: many(aiConversations),
  cartItems: many(cartItems),
  bookmarks: many(bookmarks),
  reviews: many(reviews),
  subscriptions: many(subscriptions),
  deliveryAddresses: many(deliveryAddresses),
  productSubscribers: many(productSubscribers),
}));

export const passwordResetOTPsRelations = relations(
  passwordResetOTPs,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetOTPs.userId],
      references: [users.id],
    }),
  }),
);

export const emailVerificationOTPsRelations = relations(
  emailVerificationOTPs,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationOTPs.userId],
      references: [users.id],
    }),
  }),
);

export const subscriptionPlansRelations = relations(
  subscriptionPlans,
  ({ many }) => ({
    subscriptionAccess: many(subscriptionAccess),
    subscriptions: many(subscriptions),
  }),
);

export const subscriptionAccessRelations = relations(
  subscriptionAccess,
  ({ one }) => ({
    plan: one(subscriptionPlans, {
      fields: [subscriptionAccess.planId],
      references: [subscriptionPlans.id],
    }),
  }),
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptions.planId],
    references: [subscriptionPlans.id],
  }),
  payment: one(payments, {
    fields: [subscriptions.paymentId],
    references: [payments.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ many }) => ({
  orders: many(orders),
  subscriptions: many(subscriptions),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  storeItem: one(storeItems, {
    fields: [products.id],
    references: [storeItems.productId],
  }),
  programme: one(programmes, {
    fields: [products.id],
    references: [programmes.productId],
  }),
  podcast: one(podcasts, {
    fields: [products.id],
    references: [podcasts.productId],
  }),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
  bookmarks: many(bookmarks),
  reviews: many(reviews),
  productSubscribers: many(productSubscribers),
}));

export const storeItemsRelations = relations(storeItems, ({ one }) => ({
  product: one(products, {
    fields: [storeItems.productId],
    references: [products.id],
  }),
}));

export const programmesRelations = relations(programmes, ({ one }) => ({
  product: one(products, {
    fields: [programmes.productId],
    references: [products.id],
  }),
}));

export const podcastsRelations = relations(podcasts, ({ one }) => ({
  product: one(products, {
    fields: [podcasts.productId],
    references: [products.id],
  }),
}));

export const deliveryAddressesRelations = relations(
  deliveryAddresses,
  ({ one, many }) => ({
    user: one(users, {
      fields: [deliveryAddresses.userId],
      references: [users.id],
    }),
    orders: many(orders),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  payment: one(payments, {
    fields: [orders.paymentId],
    references: [payments.id],
  }),
  deliveryAddress: one(deliveryAddresses, {
    fields: [orders.deliveryAddressId],
    references: [deliveryAddresses.id],
  }),
  orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  product: one(products, {
    fields: [bookmarks.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
}));

export const aiConversationsRelations = relations(
  aiConversations,
  ({ one }) => ({
    user: one(users, {
      fields: [aiConversations.userId],
      references: [users.id],
    }),
  }),
);

export const categoriesRelations = relations(categories, ({ many }) => ({}));

export const productSubscribersRelations = relations(
  productSubscribers,
  ({ one }) => ({
    user: one(users, {
      fields: [productSubscribers.userId],
      references: [users.id],
    }),
    product: one(products, {
      fields: [productSubscribers.productId],
      references: [products.id],
    }),
  }),
);
