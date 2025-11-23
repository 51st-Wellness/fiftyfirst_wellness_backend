ALTER TABLE `Order` ADD `trackingReference` text;--> statement-breakpoint
ALTER TABLE `Order` ADD `trackingStatus` text;--> statement-breakpoint
ALTER TABLE `Order` ADD `trackingLastChecked` integer;--> statement-breakpoint
ALTER TABLE `Order` ADD `trackingStatusUpdated` integer;--> statement-breakpoint
ALTER TABLE `Order` ADD `trackingEvents` text;--> statement-breakpoint
ALTER TABLE `Order` ADD `trackingJobId` text;--> statement-breakpoint
ALTER TABLE `Order` DROP COLUMN `preOrderDepositAmount`;--> statement-breakpoint
ALTER TABLE `StoreItem` DROP COLUMN `preOrderStart`;--> statement-breakpoint
ALTER TABLE `StoreItem` DROP COLUMN `preOrderEnd`;--> statement-breakpoint
ALTER TABLE `StoreItem` DROP COLUMN `preOrderFulfillmentDate`;--> statement-breakpoint
ALTER TABLE `StoreItem` DROP COLUMN `preOrderDepositRequired`;--> statement-breakpoint
ALTER TABLE `StoreItem` DROP COLUMN `preOrderDepositAmount`;--> statement-breakpoint
ALTER TABLE `StoreItem` DROP COLUMN `reservedPreOrderQuantity`;