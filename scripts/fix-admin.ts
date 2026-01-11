import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users } from '../src/lib/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client);

async function fixAdmin() {
  console.log('Checking all users in database...');

  const allUsers = await db.select().from(users);
  console.log('Users found:', allUsers);

  // Update ALL users with this email to admin
  const result = await db.update(users)
    .set({ role: 'admin', updatedAt: new Date().toISOString() })
    .where(eq(users.email, 'vijaymuniswamy9@gmail.com'));

  console.log('Updated to admin role');

  // Verify
  const updated = await db.select().from(users).where(eq(users.email, 'vijaymuniswamy9@gmail.com'));
  console.log('After update:', updated);

  process.exit(0);
}

fixAdmin().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
