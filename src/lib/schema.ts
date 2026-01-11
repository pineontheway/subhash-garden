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

// Transactions table - sales records
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
  // Advance return tracking
  status: text('status', { enum: ['active', 'advance_returned'] }).default('active').notNull(),
  advanceReturnedAt: text('advance_returned_at'),
  advanceReturnedBy: text('advance_returned_by').references(() => users.id),
  advanceReturnedByName: text('advance_returned_by_name'), // Denormalized for quick access
});

// Type exports for use in the app
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Price = typeof prices.$inferSelect;
export type NewPrice = typeof prices.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
