ALTER TABLE `OrderItem` ADD `preOrderReleaseDate` integer;--> statement-breakpoint
ALTER TABLE `Order` ADD `isPreOrder` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `Order` ADD `preOrderStatus` text;--> statement-breakpoint
ALTER TABLE `Order` ADD `expectedFulfillmentDate` integer;--> statement-breakpoint
ALTER TABLE `Order` ADD `fulfillmentNotes` text;--> statement-breakpoint
ALTER TABLE `Order` ADD `preOrderDepositAmount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `Payment` ADD `capturedAmount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `Payment` ADD `authorizedAmount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `Payment` ADD `isPreOrderPayment` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `Payment` ADD `finalPaymentId` text;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `productUsage` text;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `productBenefits` text;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `productIngredients` text;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `preOrderEnabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `preOrderStart` integer;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `preOrderEnd` integer;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `preOrderFulfillmentDate` integer;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `preOrderDepositRequired` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `preOrderDepositAmount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `StoreItem` ADD `reservedPreOrderQuantity` integer DEFAULT 0 NOT NULL;