import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '@/lib/db';
import { ticketTransactions, users } from '@/lib/schema';
import { eq, desc, and, gte, lte, like, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Helper to get current timestamp in IST (Indian Standard Time)
const getISTTimestamp = () => {
  const now = new Date();
  // Format: "2026-01-17 08:46:00" in IST
  return now.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
};

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

  // POST - Create new ticket transaction (cashier or admin)
  if (req.method === 'POST') {
    try {
      const {
        customerName,
        customerPhone,
        // vehicleNumber disabled per user request
        // vehicleNumber,
        menTicket,
        womenTicket,
        childTicket,
        tagNumbers,
        subtotal,
        totalDue,
        paymentMethod,
        isComplimentary
      } = req.body;

      if (!customerName || !customerPhone) {
        return res.status(400).json({ error: 'Customer name and phone required' });
      }

      if (!paymentMethod || !['upi', 'cash', 'split'].includes(paymentMethod)) {
        return res.status(400).json({ error: 'Valid payment method required (upi, cash, or split)' });
      }

      const totalTickets = (menTicket || 0) + (womenTicket || 0) + (childTicket || 0);
      if (totalTickets === 0 && !isComplimentary) {
        return res.status(400).json({ error: 'At least one ticket required' });
      }

      const transaction = {
        id: randomUUID(),
        customerName,
        customerPhone,
        // vehicleNumber disabled per user request
        vehicleNumber: null,
        menTicket: menTicket || 0,
        womenTicket: womenTicket || 0,
        childTicket: childTicket || 0,
        tagNumbers: tagNumbers || null,
        subtotal,
        totalDue,
        paymentMethod: paymentMethod as 'upi' | 'cash' | 'split',
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        isComplimentary: isComplimentary || false,
        createdAt: getISTTimestamp(), // Store in IST instead of UTC
      };

      await db.insert(ticketTransactions).values(transaction);

      return res.status(201).json({ success: true, transaction });
    } catch (error) {
      console.error('Error creating ticket transaction:', error);
      return res.status(500).json({ error: 'Failed to create ticket transaction' });
    }
  }

  // GET - List ticket transactions
  if (req.method === 'GET') {
    try {
      const { startDate, endDate, cashierId, search } = req.query;

      // Build conditions array
      const conditions = [];

      // If cashier, only show their own transactions
      if (currentUser.role === 'cashier') {
        conditions.push(eq(ticketTransactions.cashierId, currentUser.id));
      }

      // Search by phone, receipt ID, or customer name
      if (search) {
        const searchTerm = search as string;
        conditions.push(
          or(
            like(ticketTransactions.customerPhone, `%${searchTerm}%`),
            like(ticketTransactions.id, `%${searchTerm}%`),
            like(ticketTransactions.customerName, `%${searchTerm}%`)
            // vehicleNumber search disabled per user request
            // like(ticketTransactions.vehicleNumber, `%${searchTerm}%`)
          )!
        );
      }

      // Date filters (for both admin and cashier)
      if (startDate) {
        conditions.push(gte(ticketTransactions.createdAt, startDate as string));
      }
      if (endDate) {
        conditions.push(lte(ticketTransactions.createdAt, endDate as string));
      }

      // Admin-only filter: filter by specific cashier
      if (currentUser.role === 'admin' && cashierId) {
        conditions.push(eq(ticketTransactions.cashierId, cashierId as string));
      }

      let result;
      if (conditions.length > 0) {
        result = await db.select()
          .from(ticketTransactions)
          .where(and(...conditions))
          .orderBy(desc(ticketTransactions.createdAt));
      } else {
        result = await db.select()
          .from(ticketTransactions)
          .orderBy(desc(ticketTransactions.createdAt));
      }

      // Look up actual user names from users table
      const userIds = new Set<string>();
      result.forEach(t => {
        if (t.cashierId) userIds.add(t.cashierId);
      });

      const userList = await db.select().from(users);
      const userMap = new Map(userList.map(u => [u.id, u.name]));

      // Replace stored names with actual names from users table
      const enrichedResult = result.map(t => ({
        ...t,
        cashierName: userMap.get(t.cashierId) || t.cashierName,
      }));

      return res.status(200).json(enrichedResult);
    } catch (error) {
      console.error('Error fetching ticket transactions:', error);
      return res.status(500).json({ error: 'Failed to fetch ticket transactions' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
