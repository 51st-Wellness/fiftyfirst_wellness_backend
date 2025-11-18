DROP INDEX "EmailVerificationOTP_userId_unique";--> statement-breakpoint
DROP INDEX "PasswordResetOTP_userId_unique";--> statement-breakpoint
DROP INDEX "Podcast_productId_unique";--> statement-breakpoint
DROP INDEX "Podcast_muxAssetId_unique";--> statement-breakpoint
DROP INDEX "Podcast_muxPlaybackId_unique";--> statement-breakpoint
DROP INDEX "Programme_productId_unique";--> statement-breakpoint
DROP INDEX "Programme_muxAssetId_unique";--> statement-breakpoint
DROP INDEX "Programme_muxPlaybackId_unique";--> statement-breakpoint
DROP INDEX "StoreItem_productId_unique";--> statement-breakpoint
DROP INDEX "User_email_unique";--> statement-breakpoint
DROP INDEX "User_googleId_unique";--> statement-breakpoint
ALTER TABLE `DeliveryAddress` ALTER COLUMN "postcode" TO "postcode" text NOT NULL DEFAULT 'NOT SET';--> statement-breakpoint
CREATE UNIQUE INDEX `EmailVerificationOTP_userId_unique` ON `EmailVerificationOTP` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `PasswordResetOTP_userId_unique` ON `PasswordResetOTP` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Podcast_productId_unique` ON `Podcast` (`productId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Podcast_muxAssetId_unique` ON `Podcast` (`muxAssetId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Podcast_muxPlaybackId_unique` ON `Podcast` (`muxPlaybackId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Programme_productId_unique` ON `Programme` (`productId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Programme_muxAssetId_unique` ON `Programme` (`muxAssetId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Programme_muxPlaybackId_unique` ON `Programme` (`muxPlaybackId`);--> statement-breakpoint
CREATE UNIQUE INDEX `StoreItem_productId_unique` ON `StoreItem` (`productId`);--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_unique` ON `User` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `User_googleId_unique` ON `User` (`googleId`);--> statement-breakpoint
ALTER TABLE `Review` ADD `orderId` text DEFAULT 'LEGACY_ORDER_LINK' NOT NULL;--> statement-breakpoint
ALTER TABLE `Review` ADD `orderItemId` text DEFAULT 'LEGACY_ORDER_ITEM_LINK' NOT NULL;--> statement-breakpoint
ALTER TABLE `Review` ADD `status` text DEFAULT 'PENDING' NOT NULL;