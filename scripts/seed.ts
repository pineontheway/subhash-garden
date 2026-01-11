import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { prices } from '../src/lib/schema';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

const initialPrices = [
  { id: 'price_1', itemKey: 'male_costume', itemName: 'Male Costume', price: 100 },
  { id: 'price_2', itemKey: 'female_costume', itemName: 'Female Costume', price: 100 },
  { id: 'price_3', itemKey: 'kids_costume', itemName: 'Kids Costume', price: 100 },
  { id: 'price_4', itemKey: 'tube', itemName: 'Tube', price: 50 },
  { id: 'price_5', itemKey: 'locker', itemName: 'Locker', price: 100 },
];

async function seed() {
  console.log('Seeding prices...');

  for (const price of initialPrices) {
    await db.insert(prices).values(price).onConflictDoNothing();
    console.log(`  - ${price.itemName}: $${price.price}`);
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
