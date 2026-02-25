import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

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

  // POST - Create a new user with password
  if (req.method === 'POST') {
    try {
      const { email, name, password, role } = req.body;

      if (!email || !name || !password) {
        return res.status(400).json({ error: 'Missing email, name, or password' });
      }

      if (role && !['admin', 'cashier'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be admin or cashier' });
      }

      // Check if user already exists
      const existing = await db.select().from(users).where(eq(users.email, email)).get();
      if (existing) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const id = crypto.randomUUID();

      await db.insert(users).values({
        id,
        email,
        name,
        passwordHash,
        role: role || null,
      });

      return res.status(201).json({ success: true, id });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }
  }

  // PUT - Update user role and/or reset password
  if (req.method === 'PUT') {
    try {
      const { id, role, password } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing user id' });
      }

      if (!role && !password) {
        return res.status(400).json({ error: 'Nothing to update' });
      }

      const updateData: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };

      if (role) {
        if (!['admin', 'cashier'].includes(role)) {
          return res.status(400).json({ error: 'Invalid role. Must be admin or cashier' });
        }
        updateData.role = role;
      }

      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      await db.update(users)
        .set(updateData)
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
