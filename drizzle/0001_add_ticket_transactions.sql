-- Migration: Add ticket_transactions table for ticket counter feature
CREATE TABLE `ticket_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`vehicle_number` text,
	`men_ticket` integer DEFAULT 0 NOT NULL,
	`women_ticket` integer DEFAULT 0 NOT NULL,
	`child_ticket` integer DEFAULT 0 NOT NULL,
	`subtotal` real NOT NULL,
	`total_due` real NOT NULL,
	`payment_method` text NOT NULL,
	`cashier_id` text NOT NULL,
	`cashier_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`is_complimentary` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

-- Seed ticket prices (admin can adjust later)
INSERT INTO `prices` (`id`, `item_key`, `item_name`, `price`, `is_active`) VALUES
	('ticket-men', 'men_ticket', 'Men Ticket', 100, 1),
	('ticket-women', 'women_ticket', 'Women Ticket', 100, 1),
	('ticket-child', 'child_ticket', 'Child Ticket', 50, 1);
