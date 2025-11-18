ALTER TABLE `DeliveryAddress` RENAME COLUMN "contactName" TO "recipientName";--> statement-breakpoint
ALTER TABLE `DeliveryAddress` RENAME COLUMN "deliveryAddress" TO "addressLine1";--> statement-breakpoint
ALTER TABLE `DeliveryAddress` RENAME COLUMN "deliveryCity" TO "postTown";--> statement-breakpoint
CREATE TABLE `Setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`category` text,
	`isEditable` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `DeliveryAddress` ADD `postcode` text DEFAULT 'NOT SET' NOT NULL;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `discountType` text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `discountValue` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `discountActive` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `discountStart` integer;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `discountEnd` integer;