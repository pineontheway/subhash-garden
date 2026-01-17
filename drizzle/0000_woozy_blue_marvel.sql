CREATE TABLE `prices` (
	`id` text PRIMARY KEY NOT NULL,
	`item_key` text NOT NULL,
	`item_name` text NOT NULL,
	`price` real NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prices_item_key_unique` ON `prices` (`item_key`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`male_costume` integer DEFAULT 0 NOT NULL,
	`female_costume` integer DEFAULT 0 NOT NULL,
	`kids_costume` integer DEFAULT 0 NOT NULL,
	`tube` integer DEFAULT 0 NOT NULL,
	`locker` integer DEFAULT 0 NOT NULL,
	`subtotal` real NOT NULL,
	`advance` real NOT NULL,
	`total_due` real NOT NULL,
	`cashier_id` text NOT NULL,
	`cashier_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`is_complimentary` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`advance_returned_at` text,
	`advance_returned_by` text,
	`advance_returned_by_name` text,
	`return_details` text,
	`total_deduction` real DEFAULT 0,
	`actual_amount_returned` real,
	FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`advance_returned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`image` text,
	`role` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);