import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '@/lib/db';
import { settings, users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET - Fetch all settings (public - needed for UPI QR on checkout)
  if (req.method === 'GET') {
    try {
      const allSettings = await db.select().from(settings);
      // Convert to key-value object for easier access
      const settingsMap: Record<string, string> = {};
      allSettings.forEach(s => {
        settingsMap[s.key] = s.value;
      });
      return res.status(200).json(settingsMap);
    } catch (error) {
      console.error('Error fetching settings:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  // PUT - Update setting (admin only)
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
      const { key, value } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({ error: 'Missing key or value' });
      }

      // Check if setting exists
      const existing = await db.select().from(settings).where(eq(settings.key, key)).get();

      if (existing) {
        // Update existing setting
        await db.update(settings)
          .set({
            value: value,
            updatedAt: new Date().toISOString(),
            updatedBy: user.id
          })
          .where(eq(settings.key, key));
      } else {
        // Insert new setting
        await db.insert(settings).values({
          key: key,
          value: value,
          updatedAt: new Date().toISOString(),
          updatedBy: user.id
        });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating setting:', error);
      return res.status(500).json({ error: 'Failed to update setting' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
