CREATE TABLE `DeliveryAddress` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`contactName` text NOT NULL,
	`contactPhone` text NOT NULL,
	`deliveryAddress` text NOT NULL,
	`deliveryCity` text NOT NULL,
	`deliveryInstructions` text,
	`isDefault` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer
);
--> statement-breakpoint
ALTER TABLE `Order` ADD `deliveryAddressId` text;--> statement-breakpoint
ALTER TABLE `User` DROP COLUMN `city`;--> statement-breakpoint
ALTER TABLE `User` DROP COLUMN `address`;