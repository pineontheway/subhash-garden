import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { db } from '@/lib/db';
import { transactions, users, type ReturnDetails } from '@/lib/schema';
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
        totalDue,
        isComplimentary,
        parentTransactionId
      } = req.body;

      if (!customerName || !customerPhone) {
        return res.status(400).json({ error: 'Customer name and phone required' });
      }

      // If this is a linked transaction, validate the parent
      if (parentTransactionId) {
        // Get parent transaction
        const parentTransaction = await db.select()
          .from(transactions)
          .where(eq(transactions.id, parentTransactionId))
          .get();

        if (!parentTransaction) {
          return res.status(404).json({ error: 'Parent transaction not found' });
        }

        if (parentTransaction.status !== 'active') {
          return res.status(400).json({ error: 'Parent transaction is already returned' });
        }

        // Check if parent already has a linked child
        const existingChild = await db.select()
          .from(transactions)
          .where(eq(transactions.parentTransactionId, parentTransactionId))
          .get();

        if (existingChild) {
          return res.status(400).json({ error: 'Parent transaction already has a linked transaction' });
        }

        // Calculate remaining advance (parent advance - any linked items cost)
        const remainingAdvance = parentTransaction.advance;

        // Validate credit doesn't exceed remaining advance
        if (subtotal > remainingAdvance) {
          return res.status(400).json({
            error: `Credit amount (₹${subtotal}) exceeds remaining advance (₹${remainingAdvance})`
          });
        }
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
        advance: parentTransactionId ? 0 : advance, // Linked transactions have no advance
        totalDue: parentTransactionId ? subtotal : totalDue, // For linked, totalDue = subtotal (the credit amount)
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        status: 'active' as const,
        isComplimentary: isComplimentary || false,
        createdAt: getISTTimestamp(),
        parentTransactionId: parentTransactionId || null,
      };

      await db.insert(transactions).values(transaction);

      return res.status(201).json({ success: true, transaction });
    } catch (error) {
      console.error('Error creating transaction:', error);
      return res.status(500).json({ error: 'Failed to create transaction' });
    }
  }

  // PATCH - Mark advance as returned with item-level details
  if (req.method === 'PATCH') {
    try {
      const { transactionId, returnDetails, linkedReturnDetails } = req.body as {
        transactionId: string;
        returnDetails: ReturnDetails;
        linkedReturnDetails?: ReturnDetails; // For linked child transaction
      };

      if (!transactionId) {
        return res.status(400).json({ error: 'Transaction ID required' });
      }

      if (!returnDetails || !returnDetails.items) {
        return res.status(400).json({ error: 'Return details required' });
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

      // Check if this is a linked child (cannot return child directly)
      if (transaction.parentTransactionId) {
        return res.status(400).json({ error: 'Cannot return linked transaction directly. Return the parent transaction instead.' });
      }

      // Check for linked child transaction
      const linkedChild = await db.select()
        .from(transactions)
        .where(eq(transactions.parentTransactionId, transactionId))
        .get();

      // If there's a linked child, linkedReturnDetails is required
      if (linkedChild && !linkedReturnDetails) {
        return res.status(400).json({ error: 'Linked transaction return details required' });
      }

      // Validate that quantities match the original transaction
      const itemTypeToField: Record<string, keyof typeof transaction> = {
        maleCostume: 'maleCostume',
        femaleCostume: 'femaleCostume',
        kidsCostume: 'kidsCostume',
        tube: 'tube',
        locker: 'locker',
      };

      for (const item of returnDetails.items) {
        const originalQty = transaction[itemTypeToField[item.type]] as number;
        const totalReturned = item.returnedGood + item.returnedDamaged + item.lost;

        if (totalReturned !== originalQty) {
          return res.status(400).json({
            error: `Invalid quantities for ${item.type}: expected ${originalQty}, got ${totalReturned}`
          });
        }

        // Validate deduction is provided when there are damaged or lost items (skip for VIP)
        if (!transaction.isComplimentary && (item.returnedDamaged > 0 || item.lost > 0) && item.deduction <= 0) {
          return res.status(400).json({
            error: `Deduction required for damaged/lost ${item.type}`
          });
        }
      }

      // Validate linked child return details if present
      let linkedDeduction = 0;
      if (linkedChild && linkedReturnDetails) {
        for (const item of linkedReturnDetails.items) {
          const originalQty = linkedChild[itemTypeToField[item.type]] as number;
          const totalReturned = item.returnedGood + item.returnedDamaged + item.lost;

          if (totalReturned !== originalQty) {
            return res.status(400).json({
              error: `Invalid quantities for linked ${item.type}: expected ${originalQty}, got ${totalReturned}`
            });
          }
        }
        linkedDeduction = linkedReturnDetails.totalDeduction;
      }

      // Calculate totals
      // For parent with linked child:
      // actualAmountReturned = parentAdvance - linkedItemsCost - parentDeduction - linkedDeduction
      const linkedItemsCost = linkedChild ? linkedChild.subtotal : 0;
      const totalDeduction = returnDetails.totalDeduction + linkedDeduction;
      const actualAmountReturned = transaction.advance - linkedItemsCost - totalDeduction;

      if (actualAmountReturned < 0) {
        return res.status(400).json({
          error: 'Total deduction cannot exceed remaining advance amount'
        });
      }

      const returnTimestamp = getISTTimestamp();

      // Update the parent transaction
      await db.update(transactions)
        .set({
          status: 'advance_returned',
          advanceReturnedAt: returnTimestamp,
          advanceReturnedBy: currentUser.id,
          advanceReturnedByName: currentUser.name,
          returnDetails: JSON.stringify(returnDetails),
          totalDeduction: returnDetails.totalDeduction,
          actualAmountReturned,
        })
        .where(eq(transactions.id, transactionId));

      // Update the linked child transaction if present
      if (linkedChild && linkedReturnDetails) {
        await db.update(transactions)
          .set({
            status: 'advance_returned',
            advanceReturnedAt: returnTimestamp,
            advanceReturnedBy: currentUser.id,
            advanceReturnedByName: currentUser.name,
            returnDetails: JSON.stringify(linkedReturnDetails),
            totalDeduction: linkedDeduction,
            actualAmountReturned: 0, // Child has no advance to return
          })
          .where(eq(transactions.id, linkedChild.id));
      }

      return res.status(200).json({
        success: true,
        message: 'Advance returned successfully',
        advanceAmount: transaction.advance,
        linkedItemsCost,
        totalDeduction,
        actualAmountReturned,
        returnDetails,
        linkedReturnDetails: linkedChild ? linkedReturnDetails : undefined,
      });
    } catch (error) {
      console.error('Error returning advance:', error);
      return res.status(500).json({ error: 'Failed to return advance' });
    }
  }

  // GET - List transactions
  if (req.method === 'GET') {
    try {
      const { startDate, endDate, cashierId, status, search, includeLinked } = req.query;

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

      // Date filters (for both admin and cashier)
      if (startDate) {
        conditions.push(gte(transactions.createdAt, startDate as string));
      }
      if (endDate) {
        conditions.push(lte(transactions.createdAt, endDate as string));
      }

      // Admin-only filter: filter by specific cashier
      if (currentUser.role === 'admin' && cashierId) {
        conditions.push(eq(transactions.cashierId, cashierId as string));
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

      // Get all linked children for the result set
      const parentIds = result.filter(t => !t.parentTransactionId).map(t => t.id);
      const allLinkedChildren = parentIds.length > 0
        ? await db.select().from(transactions).where(
            or(...parentIds.map(id => eq(transactions.parentTransactionId, id)))!
          )
        : [];

      // Create a map of parent ID to linked child
      const linkedChildMap = new Map(allLinkedChildren.map(child => [child.parentTransactionId, child]));

      // Replace stored names with actual names from users table
      // Also add linked child info and filter out children from main list
      const enrichedResult = result
        .filter(t => !t.parentTransactionId) // Exclude linked children from main list
        .map(t => {
          const linkedChild = linkedChildMap.get(t.id);
          return {
            ...t,
            cashierName: userMap.get(t.cashierId) || t.cashierName,
            advanceReturnedByName: t.advanceReturnedBy
              ? (userMap.get(t.advanceReturnedBy) || t.advanceReturnedByName)
              : t.advanceReturnedByName,
            // Add linked child if present
            linkedTransaction: linkedChild ? {
              ...linkedChild,
              cashierName: userMap.get(linkedChild.cashierId) || linkedChild.cashierName,
              advanceReturnedByName: linkedChild.advanceReturnedBy
                ? (userMap.get(linkedChild.advanceReturnedBy) || linkedChild.advanceReturnedByName)
                : linkedChild.advanceReturnedByName,
            } : null,
          };
        });

      // If search is active and includeLinked=true, also search in linked transactions
      // and return parent if child matches
      if (search && includeLinked === 'true') {
        const searchTerm = search as string;
        // Find linked children that match the search but whose parent wasn't in the result
        const matchingChildren = allLinkedChildren.filter(child =>
          child.customerPhone.includes(searchTerm) ||
          child.id.includes(searchTerm) ||
          child.customerName.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Get parents of matching children that aren't already in result
        const existingIds = new Set(enrichedResult.map(t => t.id));
        const missingParentIds = matchingChildren
          .map(c => c.parentTransactionId)
          .filter((id): id is string => id !== null && !existingIds.has(id));

        if (missingParentIds.length > 0) {
          const missingParents = await db.select().from(transactions).where(
            or(...missingParentIds.map(id => eq(transactions.id, id)))!
          );

          for (const parent of missingParents) {
            const linkedChild = linkedChildMap.get(parent.id);
            enrichedResult.push({
              ...parent,
              cashierName: userMap.get(parent.cashierId) || parent.cashierName,
              advanceReturnedByName: parent.advanceReturnedBy
                ? (userMap.get(parent.advanceReturnedBy) || parent.advanceReturnedByName)
                : parent.advanceReturnedByName,
              linkedTransaction: linkedChild ? {
                ...linkedChild,
                cashierName: userMap.get(linkedChild.cashierId) || linkedChild.cashierName,
                advanceReturnedByName: linkedChild.advanceReturnedBy
                  ? (userMap.get(linkedChild.advanceReturnedBy) || linkedChild.advanceReturnedByName)
                  : linkedChild.advanceReturnedByName,
              } : null,
            });
          }
        }
      }

      return res.status(200).json(enrichedResult);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
