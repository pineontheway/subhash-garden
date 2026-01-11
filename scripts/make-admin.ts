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

const ADMIN_EMAIL = 'vijaymuniswamy9@gmail.com';

async function makeAdmin() {
  console.log(`Making ${ADMIN_EMAIL} an admin...`);

  // Check if user exists
  const existingUser = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL)).get();

  if (existingUser) {
    // Update existing user to admin
    await db.update(users)
      .set({ role: 'admin', updatedAt: new Date().toISOString() })
      .where(eq(users.email, ADMIN_EMAIL));
    console.log(`Updated ${ADMIN_EMAIL} to admin role`);
  } else {
    // Create new admin user (they'll need to login to get proper ID)
    await db.insert(users).values({
      id: 'admin_' + Date.now(),
      email: ADMIN_EMAIL,
      name: 'Admin',
      role: 'admin',
    });
    console.log(`Created admin user for ${ADMIN_EMAIL}`);
    console.log('Note: Login with Google to sync your profile info');
  }

  console.log('Done!');
  process.exit(0);
}

makeAdmin().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
