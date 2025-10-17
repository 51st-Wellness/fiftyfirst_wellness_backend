ALTER TABLE `Podcast` ADD `categories` text;--> statement-breakpoint
ALTER TABLE `Subscription` ADD `providerSubscriptionId` text;--> statement-breakpoint
ALTER TABLE `Subscription` ADD `invoiceId` text;--> statement-breakpoint
ALTER TABLE `Subscription` ADD `billingCycle` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `Subscription` ADD `createdAt` integer NOT NULL;