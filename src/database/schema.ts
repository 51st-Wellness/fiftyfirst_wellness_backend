import {
  sqliteTable,
  text,
  integer,
  real,
  blob,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Enums as const assertions for type safety
// Enums and constants - exported for use throughout the app
export const userRoles = ['USER', 'ADMIN', 'MODERATOR'] as const;
export type UserRole = (typeof userRoles)[number];

export const paymentStatuses = [
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const orderStatuses = [
  'PENDING',
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
export type OrderStatus = (typeof orderStatuses)[number];

export const paymentProviders = ['PAYPAL', 'STRIPE', 'FLUTTERWAVE'] as const;
export type PaymentProvider = (typeof paymentProviders)[number];

export const currencies = ['USD', 'NGN', 'EUR', 'GBP'] as const;
export type Currency = (typeof currencies)[number];

export const accessItems = [
  'PODCAST_ACCESS',
  'PROGRAMME_ACCESS',
  'ALL_ACCESS',
] as const;
export type AccessItem = (typeof accessItems)[number];

export const productTypes = ['STORE', 'PROGRAMME', 'PODCAST'] as const;
export type ProductType = (typeof productTypes)[number];

export const categoryServices = ['store', 'programme', 'podcast'] as const;
export type CategoryService = (typeof categoryServices)[number];

export const pricingModels = ['ONE_TIME', 'SUBSCRIPTION', 'FREE'] as const;
export type PricingModel = (typeof pricingModels)[number];

export const reviewStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const preOrderStatuses = [
  'PLACED',
  'CONFIRMED',
  'FULFILLED',
  'CANCELLED',
] as const;
export type PreOrderStatus = (typeof preOrderStatuses)[number];

export const productSubscriberStatuses = ['PENDING', 'NOTIFIED'] as const;
export type ProductSubscriberStatus =
  (typeof productSubscriberStatuses)[number];

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
  PENDING: 'PENDING' as const,
  // TODO: make RECEIVED the next after successful payment
  RECEIVED: 'RECEIVED' as const,
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
export const users = sqliteTable('User', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password'), // Optional for Google OAuth users
  firstName: text('firstName').notNull(),
  lastName: text('lastName').notNull(),
  phone: text('phone'), // Optional for Google OAuth users
  googleId: text('googleId').unique(), // Google OAuth ID
  role: text('role', { enum: userRoles }).notNull().default('USER'),
  bio: text('bio'),
  profilePicture: text('profilePicture'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  isEmailVerified: integer('isEmailVerified', { mode: 'boolean' })
    .notNull()
    .default(false), // Email verification status
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
  deletedAt: integer('deletedAt', { mode: 'timestamp' }),
});

export const passwordResetOTPs = sqliteTable('PasswordResetOTP', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().unique(),
  otp: text('otp').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const emailVerificationOTPs = sqliteTable('EmailVerificationOTP', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().unique(),
  otp: text('otp').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const subscriptionPlans = sqliteTable('SubscriptionPlan', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull(),
  duration: integer('duration').notNull(), // in days
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const subscriptionAccess = sqliteTable('SubscriptionAccess', {
  id: text('id').primaryKey(),
  planId: text('planId').notNull(),
  accessItem: text('accessItem', { enum: accessItems }).notNull(),
});

export const subscriptions = sqliteTable('Subscription', {
  id: text('id').primaryKey(), // Use payment_intent ID or checkout_session ID directly
  userId: text('userId').notNull(),
  planId: text('planId').notNull(),
  status: text('status', { enum: paymentStatuses })
    .notNull()
    .default('PENDING'),
  startDate: integer('startDate', { mode: 'timestamp' }).notNull(),
  endDate: integer('endDate', { mode: 'timestamp' }).notNull(),
  autoRenew: integer('autoRenew', { mode: 'boolean' }).notNull().default(true),
  paymentId: text('paymentId'), // Link to payments table
  providerSubscriptionId: text('providerSubscriptionId'), // Stripe subscription ID for grouping
  invoiceId: text('invoiceId'), // Invoice ID for recurring payments
  billingCycle: integer('billingCycle').notNull().default(1), // Which billing cycle this is
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const payments = sqliteTable('Payment', {
  id: text('id').primaryKey(),
  provider: text('provider', { enum: paymentProviders }).notNull(),
  providerRef: text('providerRef'), // Stripe payment intent/charge id
  status: text('status', { enum: paymentStatuses })
    .notNull()
    .default('PENDING'),
  currency: text('currency', { enum: currencies }).notNull(),
  amount: real('amount').notNull(),
  capturedAmount: real('capturedAmount').notNull().default(0), // For pre-orders: amount actually captured
  authorizedAmount: real('authorizedAmount').notNull().default(0), // For pre-orders: amount authorized but not captured
  isPreOrderPayment: integer('isPreOrderPayment', { mode: 'boolean' })
    .notNull()
    .default(false),
  finalPaymentId: text('finalPaymentId'), // Link to final payment if this is a deposit
  metadata: text('metadata', { mode: 'json' }), // JSON field
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const products = sqliteTable('Product', {
  id: text('id').primaryKey(),
  type: text('type', { enum: productTypes }).notNull(),
  pricingModel: text('pricingModel', { enum: pricingModels }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const discountTypes = ['NONE', 'PERCENTAGE', 'FLAT'] as const;
export type DiscountType = (typeof discountTypes)[number];

export const storeItems = sqliteTable('StoreItem', {
  productId: text('productId').primaryKey().unique(),
  name: text('name').notNull(),
  description: text('description'),
  productUsage: text('productUsage'),
  productBenefits: text('productBenefits'),
  productIngredients: text('productIngredients', { mode: 'json' }), // [string] -> serialized as JSON
  price: real('price').notNull(),
  stock: integer('stock').notNull().default(0),
  display: text('display', { mode: 'json' }).notNull(), // {url: string, type: image/video}
  images: text('images', { mode: 'json' }).notNull(), // [string] -> urls
  categories: text('categories', { mode: 'json' }).notNull(), // [string] -> category names
  isFeatured: integer('isFeatured', { mode: 'boolean' })
    .notNull()
    .default(false),
  isPublished: integer('isPublished', { mode: 'boolean' })
    .notNull()
    .default(true),
  discountType: text('discountType', { enum: discountTypes })
    .notNull()
    .default('NONE'),
  discountValue: real('discountValue').notNull().default(0),
  discountActive: integer('discountActive', { mode: 'boolean' })
    .notNull()
    .default(false),
  discountStart: integer('discountStart', { mode: 'timestamp' }),
  discountEnd: integer('discountEnd', { mode: 'timestamp' }),
  preOrderEnabled: integer('preOrderEnabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  weight: real('weight'), // Weight in grams for Click & Drop
  length: real('length'), // Length in mm for Click & Drop
  width: real('width'), // Width in mm for Click & Drop
  height: real('height'), // Height in mm for Click & Drop
  deletedAt: integer('deletedAt', { mode: 'timestamp' }),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const programmes = sqliteTable('Programme', {
  productId: text('productId').primaryKey().unique(),
  title: text('title').notNull(),
  description: text('description'),
  muxAssetId: text('muxAssetId').unique(),
  muxPlaybackId: text('muxPlaybackId').unique(),
  isPublished: integer('isPublished', { mode: 'boolean' })
    .notNull()
    .default(false),
  isFeatured: integer('isFeatured', { mode: 'boolean' })
    .notNull()
    .default(false),
  thumbnail: text('thumbnail'),
  requiresAccess: text('requiresAccess', { enum: accessItems }).notNull(),
  duration: integer('duration').notNull(), // in seconds
  categories: text('categories', { mode: 'json' }), // [string] -> category names
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const podcasts = sqliteTable('Podcast', {
  productId: text('productId').primaryKey().unique(),
  title: text('title').notNull(),
  description: text('description'),
  muxAssetId: text('muxAssetId').notNull().unique(),
  muxPlaybackId: text('muxPlaybackId').notNull().unique(),
  isPublished: integer('isPublished', { mode: 'boolean' })
    .notNull()
    .default(true),
  isFeatured: integer('isFeatured', { mode: 'boolean' })
    .notNull()
    .default(false),
  thumbnail: text('thumbnail'),
  requiresAccess: text('requiresAccess', { enum: accessItems }).notNull(), // Always PODCAST_ACCESS
  duration: integer('duration').notNull(), // in seconds
  categories: text('categories', { mode: 'json' }), // [string] -> category names
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
  podcastProductId: text('podcastProductId').notNull(),
});

export const deliveryAddresses = sqliteTable('DeliveryAddress', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  recipientName: text('recipientName').notNull(),
  contactPhone: text('contactPhone').notNull(),
  addressLine1: text('addressLine1').notNull(),
  postTown: text('postTown').notNull(),
  postcode: text('postcode').notNull().default('NOT SET'),
  deliveryInstructions: text('deliveryInstructions'),
  isDefault: integer('isDefault', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
  deletedAt: integer('deletedAt', { mode: 'timestamp' }),
});

export const settings = sqliteTable('Setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  category: text('category'),
  isEditable: integer('isEditable', { mode: 'boolean' })
    .notNull()
    .default(true),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const orders = sqliteTable('Order', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  status: text('status', { enum: orderStatuses }).notNull().default('PENDING'),
  totalAmount: real('totalAmount').notNull(),
  previewImage: text('previewImage'),
  paymentId: text('paymentId'),
  deliveryAddressId: text('deliveryAddressId'), // Foreign key to deliveryAddresses
  isPreOrder: integer('isPreOrder', { mode: 'boolean' })
    .notNull()
    .default(false),
  preOrderStatus: text('preOrderStatus', { enum: preOrderStatuses }),
  expectedFulfillmentDate: integer('expectedFulfillmentDate', {
    mode: 'timestamp',
  }),
  fulfillmentNotes: text('fulfillmentNotes'),
  // Click & Drop fields
  clickDropOrderIdentifier: integer('clickDropOrderIdentifier'), // Order identifier from Click & Drop API
  packageFormatIdentifier: text('packageFormatIdentifier'), // 'smallParcel', 'mediumParcel', 'largeParcel', etc.
  serviceCode: text('serviceCode'), // Royal Mail service code (account-specific)
  shippingCost: real('shippingCost'), // Shipping cost charged to customer
  parcelWeight: integer('parcelWeight'), // Total weight in grams
  parcelDimensions: text('parcelDimensions', { mode: 'json' }), // {height, width, depth} in mm
  labelBase64: text('labelBase64'), // Base64 encoded PDF label
  trackingNumber: text('trackingNumber'), // Royal Mail tracking number (from Click & Drop / Tracking API)
  statusHistory: text('statusHistory', { mode: 'json' }), // Array of status changes for audit
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const orderItems = sqliteTable('OrderItem', {
  id: text('id').primaryKey(),
  orderId: text('orderId').notNull(),
  productId: text('productId').notNull(),
  quantity: integer('quantity').notNull(),
  price: real('price').notNull(),
  preOrderReleaseDate: integer('preOrderReleaseDate', { mode: 'timestamp' }),
});

export const reviews = sqliteTable('Review', {
  id: text('id').primaryKey(),
  productId: text('productId').notNull(),
  userId: text('userId').notNull(),
  orderId: text('orderId').notNull().default('LEGACY_ORDER_LINK'),
  orderItemId: text('orderItemId').notNull().default('LEGACY_ORDER_ITEM_LINK'),
  status: text('status', { enum: reviewStatuses }).notNull().default('PENDING'),
  rating: integer('rating').notNull(), // 1-5 scale
  comment: text('comment'),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const blogs = sqliteTable('Blogs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  contentKey: text('contentKey').notNull(), // storage bucket file key
  isFeatured: integer('isFeatured', { mode: 'boolean' })
    .notNull()
    .default(false),
  isPublished: integer('isPublished', { mode: 'boolean' })
    .notNull()
    .default(true),
  categories: text('categories', { mode: 'json' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const cartItems = sqliteTable('CartItem', {
  id: text('id').primaryKey(),
  productId: text('productId').notNull(),
  quantity: integer('quantity').notNull(),
  userId: text('userId').notNull(),
});

export const bookmarks = sqliteTable('Bookmark', {
  id: text('id').primaryKey(),
  productId: text('productId').notNull(),
  userId: text('userId').notNull(),
});

export const aiConversations = sqliteTable('AIConversation', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  messages: text('messages', { mode: 'json' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const categories = sqliteTable('Category', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  service: text('service', { enum: categoryServices }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export const productSubscribers = sqliteTable('ProductSubscriber', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  productId: text('productId').notNull(),
  status: text('status', { enum: productSubscriberStatuses })
    .notNull()
    .default('PENDING'),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .$onUpdateFn(() => new Date()),
});
// export const blogs = sqliteTable('Blogs', {
//   id: text('id').primaryKey(),
//   title: text('title').notNull(),
//   contentKey: text('contentKey').notNull(),
//   isFeatured: integer('isFeatured', { mode: 'boolean' }).notNull().default(false),
//   isPublished: integer('isPublished', { mode: 'boolean' }).notNull().default(true),
// });
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
