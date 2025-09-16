CREATE TABLE `AIConversation` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text NOT NULL,
	`messages` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Blogs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`contentKey` text NOT NULL,
	`isFeatured` integer DEFAULT false NOT NULL,
	`isPublished` integer DEFAULT true NOT NULL,
	`tags` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Bookmark` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`userId` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `CartItem` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`quantity` integer NOT NULL,
	`userId` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `OrderItem` (
	`id` text PRIMARY KEY NOT NULL,
	`orderId` text NOT NULL,
	`productId` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Order` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`totalAmount` real NOT NULL,
	`paymentId` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `PasswordResetOTP` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`otp` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `PasswordResetOTP_userId_unique` ON `PasswordResetOTP` (`userId`);--> statement-breakpoint
CREATE TABLE `Payment` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`providerRef` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`currency` text NOT NULL,
	`amount` real NOT NULL,
	`metadata` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Podcast` (
	`productId` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`muxAssetId` text NOT NULL,
	`muxPlaybackId` text NOT NULL,
	`isPublished` integer DEFAULT true NOT NULL,
	`isFeatured` integer DEFAULT false NOT NULL,
	`thumbnail` text,
	`requiresAccess` text NOT NULL,
	`duration` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`podcastProductId` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Podcast_productId_unique` ON `Podcast` (`productId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Podcast_muxAssetId_unique` ON `Podcast` (`muxAssetId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Podcast_muxPlaybackId_unique` ON `Podcast` (`muxPlaybackId`);--> statement-breakpoint
CREATE TABLE `Product` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`pricingModel` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Programme` (
	`productId` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`muxAssetId` text,
	`muxPlaybackId` text,
	`isPublished` integer DEFAULT false NOT NULL,
	`isFeatured` integer DEFAULT false NOT NULL,
	`thumbnail` text,
	`requiresAccess` text NOT NULL,
	`duration` integer NOT NULL,
	`tags` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Programme_productId_unique` ON `Programme` (`productId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Programme_muxAssetId_unique` ON `Programme` (`muxAssetId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Programme_muxPlaybackId_unique` ON `Programme` (`muxPlaybackId`);--> statement-breakpoint
CREATE TABLE `Review` (
	`id` text PRIMARY KEY NOT NULL,
	`productId` text NOT NULL,
	`userId` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `StoreItem` (
	`productId` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`display` text NOT NULL,
	`images` text NOT NULL,
	`tags` text NOT NULL,
	`isFeatured` integer DEFAULT false NOT NULL,
	`isPublished` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `StoreItem_productId_unique` ON `StoreItem` (`productId`);--> statement-breakpoint
CREATE TABLE `SubscriptionAccess` (
	`id` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`accessItem` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `SubscriptionPlan` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`duration` integer NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`planId` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`startDate` integer NOT NULL,
	`endDate` integer NOT NULL,
	`autoRenew` integer DEFAULT true NOT NULL,
	`paymentId` text
);
--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`firstName` text NOT NULL,
	`lastName` text NOT NULL,
	`phone` text,
	`googleId` text,
	`role` text DEFAULT 'USER' NOT NULL,
	`city` text,
	`address` text,
	`bio` text,
	`profilePicture` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_unique` ON `User` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `User_googleId_unique` ON `User` (`googleId`);