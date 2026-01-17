import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table - for admins and cashiers
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // NextAuth user ID
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  image: text('image'),
  role: text('role', { enum: ['admin', 'cashier'] }), // NULL means no access
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Prices table - configurable item prices
export const prices = sqliteTable('prices', {
  id: text('id').primaryKey(),
  itemKey: text('item_key').notNull().unique(), // e.g., 'male_costume', 'tube'
  itemName: text('item_name').notNull(), // Display name
  price: real('price').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedBy: text('updated_by').references(() => users.id),
});

// Settings table - configurable business settings
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedBy: text('updated_by').references(() => users.id),
});

// Ticket Transactions table - entry ticket sales
export const ticketTransactions = sqliteTable('ticket_transactions', {
  id: text('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  vehicleNumber: text('vehicle_number'), // Optional - car/bike number
  menTicket: integer('men_ticket').default(0).notNull(),
  womenTicket: integer('women_ticket').default(0).notNull(),
  childTicket: integer('child_ticket').default(0).notNull(),
  subtotal: real('subtotal').notNull(),
  totalDue: real('total_due').notNull(), // Same as subtotal (no advance)
  paymentMethod: text('payment_method', { enum: ['upi', 'cash'] }).notNull(),
  cashierId: text('cashier_id').references(() => users.id).notNull(),
  cashierName: text('cashier_name').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  isComplimentary: integer('is_complimentary', { mode: 'boolean' }).default(false).notNull(),
});

// Transactions table - rental sales records (clothes counter)
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  maleCostume: integer('male_costume').default(0).notNull(),
  femaleCostume: integer('female_costume').default(0).notNull(),
  kidsCostume: integer('kids_costume').default(0).notNull(),
  tube: integer('tube').default(0).notNull(),
  locker: integer('locker').default(0).notNull(),
  subtotal: real('subtotal').notNull(),
  advance: real('advance').notNull(),
  totalDue: real('total_due').notNull(),
  cashierId: text('cashier_id').references(() => users.id).notNull(),
  cashierName: text('cashier_name').notNull(), // Denormalized for quick access
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // VIP/Complimentary transaction (no payment)
  isComplimentary: integer('is_complimentary', { mode: 'boolean' }).default(false).notNull(),
  // Advance return tracking
  status: text('status', { enum: ['active', 'advance_returned'] }).default('active').notNull(),
  advanceReturnedAt: text('advance_returned_at'),
  advanceReturnedBy: text('advance_returned_by').references(() => users.id),
  advanceReturnedByName: text('advance_returned_by_name'), // Denormalized for quick access
  // Item return details (for tracking condition of returned items)
  returnDetails: text('return_details'), // JSON string storing item-level return data
  totalDeduction: real('total_deduction').default(0),
  actualAmountReturned: real('actual_amount_returned'),
});

// Type exports for use in the app
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Price = typeof prices.$inferSelect;
export type NewPrice = typeof prices.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type TicketTransaction = typeof ticketTransactions.$inferSelect;
export type NewTicketTransaction = typeof ticketTransactions.$inferInsert;

// Item return tracking types
export type ItemType = 'maleCostume' | 'femaleCostume' | 'kidsCostume' | 'tube' | 'locker';

export type ItemReturnEntry = {
  type: ItemType;
  rented: number;
  returnedGood: number;
  returnedDamaged: number;
  lost: number;
  deduction: number;
};

export type ReturnDetails = {
  items: ItemReturnEntry[];
  totalDeduction: number;
  notes?: string;
};
