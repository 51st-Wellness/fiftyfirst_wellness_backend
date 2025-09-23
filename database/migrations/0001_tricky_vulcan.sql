CREATE TABLE `EmailVerificationOTP` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`otp` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `EmailVerificationOTP_userId_unique` ON `EmailVerificationOTP` (`userId`);--> statement-breakpoint
ALTER TABLE `User` ADD `isEmailVerified` integer DEFAULT false NOT NULL;