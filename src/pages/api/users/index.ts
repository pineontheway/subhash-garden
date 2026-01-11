import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin
  const currentUser = await db.select().from(users).where(eq(users.email, session.user.email)).get();

  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden - Admin only' });
  }

  // GET - List all users
  if (req.method === 'GET') {
    try {
      const allUsers = await db.select().from(users);
      return res.status(200).json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  // PUT - Update user role
  if (req.method === 'PUT') {
    try {
      const { id, role } = req.body;

      if (!id || !role) {
        return res.status(400).json({ error: 'Missing id or role' });
      }

      if (!['admin', 'cashier'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be admin or cashier' });
      }

      await db.update(users)
        .set({
          role: role,
          updatedAt: new Date().toISOString()
        })
        .where(eq(users.id, id));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }

  // DELETE - Remove user role (set to null)
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing user id' });
      }

      // Don't allow admin to remove their own role
      if (id === currentUser.id) {
        return res.status(400).json({ error: 'Cannot remove your own role' });
      }

      await db.update(users)
        .set({
          role: null,
          updatedAt: new Date().toISOString()
        })
        .where(eq(users.id, id));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error removing user role:', error);
      return res.status(500).json({ error: 'Failed to remove user role' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
