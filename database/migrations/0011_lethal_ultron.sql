ALTER TABLE `Order` ADD `trackingNumber` text;--> statement-breakpoint
ALTER TABLE `Order` DROP COLUMN `trackingStatus`;--> statement-breakpoint
ALTER TABLE `Order` DROP COLUMN `trackingLastChecked`;--> statement-breakpoint
ALTER TABLE `Order` DROP COLUMN `trackingStatusUpdated`;--> statement-breakpoint
ALTER TABLE `Order` DROP COLUMN `trackingEvents`;