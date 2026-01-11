import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '@/lib/db';
import { transactions, users } from '@/lib/schema';
import { eq, desc, and, gte, lte, like, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get current user
  const currentUser = await db.select().from(users).where(eq(users.email, session.user.email)).get();

  if (!currentUser || !currentUser.role) {
    return res.status(403).json({ error: 'Forbidden - No role assigned' });
  }

  // POST - Create new transaction (cashier or admin)
  if (req.method === 'POST') {
    try {
      const {
        customerName,
        customerPhone,
        maleCostume,
        femaleCostume,
        kidsCostume,
        tube,
        locker,
        subtotal,
        advance,
        totalDue
      } = req.body;

      if (!customerName || !customerPhone) {
        return res.status(400).json({ error: 'Customer name and phone required' });
      }

      const transaction = {
        id: randomUUID(),
        customerName,
        customerPhone,
        maleCostume: maleCostume || 0,
        femaleCostume: femaleCostume || 0,
        kidsCostume: kidsCostume || 0,
        tube: tube || 0,
        locker: locker || 0,
        subtotal,
        advance,
        totalDue,
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        status: 'active' as const,
      };

      await db.insert(transactions).values(transaction);

      return res.status(201).json({ success: true, transaction });
    } catch (error) {
      console.error('Error creating transaction:', error);
      return res.status(500).json({ error: 'Failed to create transaction' });
    }
  }

  // PATCH - Mark advance as returned
  if (req.method === 'PATCH') {
    try {
      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({ error: 'Transaction ID required' });
      }

      // Get the transaction
      const transaction = await db.select()
        .from(transactions)
        .where(eq(transactions.id, transactionId))
        .get();

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.status === 'advance_returned') {
        return res.status(400).json({ error: 'Advance already returned for this transaction' });
      }

      // Update the transaction
      await db.update(transactions)
        .set({
          status: 'advance_returned',
          advanceReturnedAt: new Date().toISOString(),
          advanceReturnedBy: currentUser.id,
          advanceReturnedByName: currentUser.name,
        })
        .where(eq(transactions.id, transactionId));

      return res.status(200).json({
        success: true,
        message: 'Advance returned successfully',
        advanceAmount: transaction.advance
      });
    } catch (error) {
      console.error('Error returning advance:', error);
      return res.status(500).json({ error: 'Failed to return advance' });
    }
  }

  // GET - List transactions
  if (req.method === 'GET') {
    try {
      const { startDate, endDate, cashierId, status, search } = req.query;

      // Build conditions array
      let conditions = [];

      // If cashier, only show their own transactions
      if (currentUser.role === 'cashier') {
        conditions.push(eq(transactions.cashierId, currentUser.id));
      }

      // Filter by status
      if (status && (status === 'active' || status === 'advance_returned')) {
        conditions.push(eq(transactions.status, status));
      }

      // Search by phone or receipt ID
      if (search) {
        const searchTerm = search as string;
        conditions.push(
          or(
            like(transactions.customerPhone, `%${searchTerm}%`),
            like(transactions.id, `%${searchTerm}%`),
            like(transactions.customerName, `%${searchTerm}%`)
          )!
        );
      }

      // Admin filters
      if (currentUser.role === 'admin') {
        if (startDate) {
          conditions.push(gte(transactions.createdAt, startDate as string));
        }
        if (endDate) {
          conditions.push(lte(transactions.createdAt, endDate as string));
        }
        if (cashierId) {
          conditions.push(eq(transactions.cashierId, cashierId as string));
        }
      }

      let result;
      if (conditions.length > 0) {
        result = await db.select()
          .from(transactions)
          .where(and(...conditions))
          .orderBy(desc(transactions.createdAt));
      } else {
        result = await db.select()
          .from(transactions)
          .orderBy(desc(transactions.createdAt));
      }

      // Look up actual user names from users table
      const userIds = new Set<string>();
      result.forEach(t => {
        if (t.cashierId) userIds.add(t.cashierId);
        if (t.advanceReturnedBy) userIds.add(t.advanceReturnedBy);
      });

      const userList = await db.select().from(users);
      const userMap = new Map(userList.map(u => [u.id, u.name]));

      // Replace stored names with actual names from users table
      const enrichedResult = result.map(t => ({
        ...t,
        cashierName: userMap.get(t.cashierId) || t.cashierName,
        advanceReturnedByName: t.advanceReturnedBy
          ? (userMap.get(t.advanceReturnedBy) || t.advanceReturnedByName)
          : t.advanceReturnedByName,
      }));

      return res.status(200).json(enrichedResult);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
