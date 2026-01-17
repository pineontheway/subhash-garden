// Script to clean all transaction data from the database
require('dotenv').config({ path: '.env.local' });

import { createClient } from '@libsql/client/web';
import { drizzle } from 'drizzle-orm/libsql';
import { transactions, ticketTransactions } from '../src/lib/schema';

async function cleanTransactions() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  console.log('Cleaning transaction data...\n');

  // Delete all ticket transactions
  const ticketResult = await db.delete(ticketTransactions).returning();
  console.log(`Deleted ${ticketResult.length} ticket transactions`);

  // Delete all clothes counter transactions
  const clothesResult = await db.delete(transactions).returning();
  console.log(`Deleted ${clothesResult.length} clothes counter transactions`);

  console.log('\nDone! All transaction data has been cleaned.');
  process.exit(0);
}

cleanTransactions().catch((error) => {
  console.error('Error cleaning transactions:', error);
  process.exit(1);
});
