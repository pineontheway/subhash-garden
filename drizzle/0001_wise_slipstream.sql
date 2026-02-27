CREATE TABLE `ticket_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`vehicle_number` text,
	`men_ticket` integer DEFAULT 0 NOT NULL,
	`women_ticket` integer DEFAULT 0 NOT NULL,
	`child_ticket` integer DEFAULT 0 NOT NULL,
	`tag_numbers` text,
	`subtotal` real NOT NULL,
	`total_due` real NOT NULL,
	`payment_method` text NOT NULL,
	`cashier_id` text NOT NULL,
	`cashier_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`is_complimentary` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `locker_numbers` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `parent_transaction_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `payment_method` text;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;