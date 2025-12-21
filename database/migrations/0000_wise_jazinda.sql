CREATE TYPE "public"."access_item" AS ENUM('PODCAST_ACCESS', 'PROGRAMME_ACCESS', 'ALL_ACCESS');--> statement-breakpoint
CREATE TYPE "public"."category_service" AS ENUM('store', 'programme', 'podcast');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('USD', 'NGN', 'EUR', 'GBP');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('NONE', 'PERCENTAGE', 'FLAT');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('FAILED', 'PENDING', 'PAID', 'PROCESSING', 'NOTFOUND', 'DISPATCHED', 'TRANSIT', 'PICKUP', 'UNDELIVERED', 'DELIVERED', 'EXCEPTION', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('PAYPAL', 'STRIPE', 'FLUTTERWAVE');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."pre_order_status" AS ENUM('PLACED', 'CONFIRMED', 'FULFILLED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('ONE_TIME', 'SUBSCRIPTION', 'FREE');--> statement-breakpoint
CREATE TYPE "public"."product_subscriber_status" AS ENUM('PENDING', 'NOTIFIED');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('STORE', 'PROGRAMME', 'PODCAST');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN', 'MODERATOR');--> statement-breakpoint
CREATE TABLE "AIConversation" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"messages" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Blogs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"contentKey" text NOT NULL,
	"isFeatured" boolean DEFAULT false NOT NULL,
	"isPublished" boolean DEFAULT true NOT NULL,
	"categories" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Bookmark" (
	"id" text PRIMARY KEY NOT NULL,
	"productId" text NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CartItem" (
	"id" text PRIMARY KEY NOT NULL,
	"productId" text NOT NULL,
	"quantity" integer NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"service" "category_service" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DeliveryAddress" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"recipientName" text NOT NULL,
	"contactPhone" text NOT NULL,
	"addressLine1" text NOT NULL,
	"postTown" text NOT NULL,
	"postcode" text DEFAULT 'NOT SET' NOT NULL,
	"deliveryInstructions" text,
	"isDefault" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "EmailVerificationOTP" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"otp" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "EmailVerificationOTP_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "OrderItem" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"productId" text NOT NULL,
	"quantity" integer NOT NULL,
	"price" double precision NOT NULL,
	"preOrderReleaseDate" timestamp
);
--> statement-breakpoint
CREATE TABLE "Order" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"status" "order_status" DEFAULT 'PENDING' NOT NULL,
	"totalAmount" double precision NOT NULL,
	"previewImage" text,
	"paymentId" text,
	"deliveryAddressId" text,
	"isPreOrder" boolean DEFAULT false NOT NULL,
	"preOrderStatus" "pre_order_status",
	"expectedFulfillmentDate" timestamp,
	"fulfillmentNotes" text,
	"clickDropOrderIdentifier" integer,
	"packageFormatIdentifier" text,
	"serviceCode" text,
	"shippingCost" double precision,
	"parcelWeight" integer,
	"parcelDimensions" jsonb,
	"labelBase64" text,
	"trackingNumber" text,
	"statusHistory" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PasswordResetOTP" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"otp" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PasswordResetOTP_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "Payment" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"providerRef" text,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"currency" "currency" NOT NULL,
	"amount" double precision NOT NULL,
	"capturedAmount" double precision DEFAULT 0 NOT NULL,
	"authorizedAmount" double precision DEFAULT 0 NOT NULL,
	"isPreOrderPayment" boolean DEFAULT false NOT NULL,
	"finalPaymentId" text,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Podcast" (
	"productId" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"muxAssetId" text NOT NULL,
	"muxPlaybackId" text NOT NULL,
	"isPublished" boolean DEFAULT true NOT NULL,
	"isFeatured" boolean DEFAULT false NOT NULL,
	"thumbnail" text,
	"requiresAccess" "access_item" NOT NULL,
	"duration" integer NOT NULL,
	"categories" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"podcastProductId" text NOT NULL,
	CONSTRAINT "Podcast_productId_unique" UNIQUE("productId"),
	CONSTRAINT "Podcast_muxAssetId_unique" UNIQUE("muxAssetId"),
	CONSTRAINT "Podcast_muxPlaybackId_unique" UNIQUE("muxPlaybackId")
);
--> statement-breakpoint
CREATE TABLE "ProductSubscriber" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"productId" text NOT NULL,
	"status" "product_subscriber_status" DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Product" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "product_type" NOT NULL,
	"pricingModel" "pricing_model" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Programme" (
	"productId" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"muxAssetId" text,
	"muxPlaybackId" text,
	"isPublished" boolean DEFAULT false NOT NULL,
	"isFeatured" boolean DEFAULT false NOT NULL,
	"thumbnail" text,
	"requiresAccess" "access_item" NOT NULL,
	"duration" integer NOT NULL,
	"categories" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "Programme_productId_unique" UNIQUE("productId"),
	CONSTRAINT "Programme_muxAssetId_unique" UNIQUE("muxAssetId"),
	CONSTRAINT "Programme_muxPlaybackId_unique" UNIQUE("muxPlaybackId")
);
--> statement-breakpoint
CREATE TABLE "Review" (
	"id" text PRIMARY KEY NOT NULL,
	"productId" text NOT NULL,
	"userId" text NOT NULL,
	"orderId" text DEFAULT 'LEGACY_ORDER_LINK' NOT NULL,
	"orderItemId" text DEFAULT 'LEGACY_ORDER_ITEM_LINK' NOT NULL,
	"status" "review_status" DEFAULT 'PENDING' NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"category" text,
	"isEditable" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StoreItem" (
	"productId" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"productUsage" text,
	"productBenefits" text,
	"productIngredients" jsonb,
	"price" double precision NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"display" jsonb NOT NULL,
	"images" jsonb NOT NULL,
	"categories" jsonb NOT NULL,
	"isFeatured" boolean DEFAULT false NOT NULL,
	"isPublished" boolean DEFAULT true NOT NULL,
	"discountType" "discount_type" DEFAULT 'NONE' NOT NULL,
	"discountValue" double precision DEFAULT 0 NOT NULL,
	"discountActive" boolean DEFAULT false NOT NULL,
	"discountStart" timestamp,
	"discountEnd" timestamp,
	"preOrderEnabled" boolean DEFAULT false NOT NULL,
	"weight" double precision,
	"length" double precision,
	"width" double precision,
	"height" double precision,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "StoreItem_productId_unique" UNIQUE("productId")
);
--> statement-breakpoint
CREATE TABLE "SubscriptionAccess" (
	"id" text PRIMARY KEY NOT NULL,
	"planId" text NOT NULL,
	"accessItem" "access_item" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SubscriptionPlan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" double precision NOT NULL,
	"duration" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"planId" text NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"startDate" timestamp NOT NULL,
	"endDate" timestamp NOT NULL,
	"autoRenew" boolean DEFAULT true NOT NULL,
	"paymentId" text,
	"providerSubscriptionId" text,
	"invoiceId" text,
	"billingCycle" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"phone" text,
	"googleId" text,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"bio" text,
	"profilePicture" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"isEmailVerified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "User_email_unique" UNIQUE("email"),
	CONSTRAINT "User_googleId_unique" UNIQUE("googleId")
);
