import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '@/lib/db';
import { prices, users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET - List all prices (public)
  if (req.method === 'GET') {
    try {
      const allPrices = await db.select().from(prices).where(eq(prices.isActive, true));
      return res.status(200).json(allPrices);
    } catch (error) {
      console.error('Error fetching prices:', error);
      return res.status(500).json({ error: 'Failed to fetch prices' });
    }
  }

  // PUT - Update price (admin only)
  if (req.method === 'PUT') {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const user = await db.select().from(users).where(eq(users.email, session.user.email)).get();

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden - Admin only' });
    }

    try {
      const { id, price } = req.body;

      if (!id || price === undefined) {
        return res.status(400).json({ error: 'Missing id or price' });
      }

      await db.update(prices)
        .set({
          price: price,
          updatedAt: new Date().toISOString(),
          updatedBy: user.id
        })
        .where(eq(prices.id, id));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating price:', error);
      return res.status(500).json({ error: 'Failed to update price' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
