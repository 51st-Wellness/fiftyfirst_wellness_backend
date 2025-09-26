ALTER TABLE `Blogs` RENAME COLUMN "tags" TO "categories";--> statement-breakpoint
ALTER TABLE `Programme` RENAME COLUMN "tags" TO "categories";--> statement-breakpoint
ALTER TABLE `StoreItem` RENAME COLUMN "tags" TO "categories";--> statement-breakpoint
CREATE TABLE `Category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`service` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
