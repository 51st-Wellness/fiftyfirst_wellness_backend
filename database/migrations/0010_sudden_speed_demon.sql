ALTER TABLE `Order` ADD `clickDropOrderIdentifier` integer;--> statement-breakpoint
ALTER TABLE `Order` ADD `packageFormatIdentifier` text;--> statement-breakpoint
ALTER TABLE `Order` ADD `serviceCode` text;--> statement-breakpoint
ALTER TABLE `Order` ADD `shippingCost` real;--> statement-breakpoint
ALTER TABLE `Order` ADD `parcelWeight` integer;--> statement-breakpoint
ALTER TABLE `Order` ADD `parcelDimensions` text;--> statement-breakpoint
ALTER TABLE `Order` ADD `labelBase64` text;--> statement-breakpoint
ALTER TABLE `Order` ADD `statusHistory` text;--> statement-breakpoint
ALTER TABLE `Order` DROP COLUMN `trackingReference`;--> statement-breakpoint
ALTER TABLE `Order` DROP COLUMN `trackingJobId`;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `weight` real;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `length` real;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `width` real;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `height` real;