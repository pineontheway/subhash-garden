'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';

type TicketTransaction = {
  id: string;
  menTicket: number;
  womenTicket: number;
  childTicket: number;
  tagNumbers: string | null;
  subtotal: number;
  totalDue: number;
  paymentMethod: 'upi' | 'cash';
  isComplimentary: boolean;
  createdAt: string;
};

type PriceItem = {
  itemKey: string;
  price: number;
};

export default function EndSession() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [transactions, setTransactions] = useState<TicketTransaction[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  // Session info from sessionStorage
  const [startingTag, setStartingTag] = useState<string | null>(null);
  const [nextTag, setNextTag] = useState<string | null>(null);
  const [totalTagsReceived, setTotalTagsReceived] = useState<number | null>(null);

  // Get today's date in IST
  const today = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Check auth and load session info
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (!session.user.role) {
        router.push('/access-denied');
        return;
      }
      // Load session info from sessionStorage
      const savedStartingTag = sessionStorage.getItem('startingTagNumber');
      const savedNextTag = sessionStorage.getItem('nextTagNumber');
      const savedTotalTags = sessionStorage.getItem('totalTagsReceived');

      if (!savedStartingTag || !savedNextTag) {
        // No session to end
        router.push('/ticket-counter');
        return;
      }

      setStartingTag(savedStartingTag);
      setNextTag(savedNextTag);
      setTotalTagsReceived(savedTotalTags ? parseInt(savedTotalTags, 10) : null);
    } else if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, session, router]);

  // Fetch today's transactions
  useEffect(() => {
    async function fetchData() {
      try {
        // Get today's date range in IST
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + istOffset);
        const todayStr = istNow.toISOString().split('T')[0];

        const [transRes, pricesRes] = await Promise.all([
          fetch(`/api/ticket-transactions?startDate=${todayStr}&endDate=${todayStr}T23:59:59`),
          fetch('/api/prices')
        ]);

        if (transRes.ok) {
          const data = await transRes.json();
          setTransactions(data);
        }

        if (pricesRes.ok) {
          const priceData: PriceItem[] = await pricesRes.json();
          const priceMap: Record<string, number> = {};
          priceData.forEach(item => {
            priceMap[item.itemKey] = item.price;
          });
          setPrices(priceMap);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
      setLoading(false);
    }

    if (status === 'authenticated') {
      fetchData();
    }
  }, [status]);

  // Calculate summary stats
  const summary = {
    menTickets: 0,
    womenTickets: 0,
    childTickets: 0,
    totalTickets: 0,
    cashAmount: 0,
    upiAmount: 0,
    vipCount: 0,
    vipValue: 0,
    totalAmount: 0,
  };

  transactions.forEach(t => {
    summary.menTickets += t.menTicket;
    summary.womenTickets += t.womenTicket;
    summary.childTickets += t.childTicket;
    summary.totalTickets += t.menTicket + t.womenTicket + t.childTicket;

    if (t.isComplimentary) {
      summary.vipCount += t.menTicket + t.womenTicket + t.childTicket;
      summary.vipValue += t.subtotal;
    } else if (t.paymentMethod === 'cash') {
      summary.cashAmount += t.totalDue;
    } else {
      summary.upiAmount += t.totalDue;
    }
    summary.totalAmount += t.totalDue;
  });

  // Tag calculations
  const tagsUsed = startingTag && nextTag
    ? parseInt(nextTag, 10) - parseInt(startingTag, 10)
    : 0;
  const lastTagUsed = tagsUsed > 0 && startingTag
    ? (parseInt(startingTag, 10) + tagsUsed - 1).toString().padStart(6, '0')
    : null;
  const unusedTags = totalTagsReceived !== null ? totalTagsReceived - tagsUsed : null;

  const handleConfirmAndLogout = async () => {
    setConfirming(true);

    // Clear all session data
    sessionStorage.removeItem('counterType');
    sessionStorage.removeItem('ticketSessionDate');
    sessionStorage.removeItem('nextTagNumber');
    sessionStorage.removeItem('startingTagNumber');
    sessionStorage.removeItem('totalTagsReceived');

    // Logout
    await signOut({ callbackUrl: '/' });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Subhash Garden" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-xl font-bold text-gray-800">Subhash Garden</span>
          </div>
          <button
            type="button"
            onClick={() => router.push('/ticket-counter')}
            className="text-blue-600 font-medium"
          >
            Back
          </button>
        </header>

        {/* Content */}
        <main className="p-5 space-y-4 pb-32">
          {/* Session Summary Header */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold">End of Day Settlement</h1>
                <p className="text-blue-100 text-sm">{today}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-blue-100 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Cashier: <span className="text-white font-medium">{session?.user?.name}</span></span>
            </div>
          </div>

          {/* Tag Summary */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <h2 className="text-gray-800 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Tag Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Starting Tag</span>
                <span className="font-mono font-medium text-gray-900">{startingTag}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Tag Used</span>
                <span className="font-mono font-medium text-gray-900">{lastTagUsed || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tags Used</span>
                <span className="font-medium text-blue-600">{tagsUsed}</span>
              </div>
              {unusedTags !== null && (
                <div className="flex justify-between pt-2 border-t border-gray-100">
                  <span className="text-gray-600">Tags Remaining (Unused)</span>
                  <span className="font-medium text-orange-600">{unusedTags}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tickets Breakdown */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <h2 className="text-gray-800 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              Tickets Sold
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">Men Tickets</span>
                <div className="text-right">
                  <span className="text-gray-900 font-medium">{summary.menTickets}</span>
                  <span className="text-gray-500 ml-2">× ₹{prices.men_ticket || 0}</span>
                  <span className="text-gray-900 font-medium ml-2">= ₹{summary.menTickets * (prices.men_ticket || 0)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">Women Tickets</span>
                <div className="text-right">
                  <span className="text-gray-900 font-medium">{summary.womenTickets}</span>
                  <span className="text-gray-500 ml-2">× ₹{prices.women_ticket || 0}</span>
                  <span className="text-gray-900 font-medium ml-2">= ₹{summary.womenTickets * (prices.women_ticket || 0)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">Child Tickets</span>
                <div className="text-right">
                  <span className="text-gray-900 font-medium">{summary.childTickets}</span>
                  <span className="text-gray-500 ml-2">× ₹{prices.child_ticket || 0}</span>
                  <span className="text-gray-900 font-medium ml-2">= ₹{summary.childTickets * (prices.child_ticket || 0)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-gray-800 font-semibold">Total Tickets</span>
                <span className="text-gray-900 font-bold">{summary.totalTickets}</span>
              </div>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <h2 className="text-gray-800 font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Payment Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-gray-600">Cash Collected</span>
                </div>
                <span className="text-gray-900 font-medium">₹{summary.cashAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  <span className="text-gray-600">UPI Received</span>
                </div>
                <span className="text-gray-900 font-medium">₹{summary.upiAmount.toFixed(2)}</span>
              </div>
              {summary.vipCount > 0 && (
                <div className="flex justify-between items-center py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                    <span className="text-gray-600">VIP/Complimentary ({summary.vipCount})</span>
                  </div>
                  <span className="text-gray-400">₹{summary.vipValue.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-gray-800 font-semibold">Total Sales</span>
                <span className="text-gray-900 font-bold">₹{summary.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Amount to Return */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Cash to Return to Owner</p>
                <p className="text-3xl font-bold mt-1">₹{summary.cashAmount.toFixed(2)}</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-green-100 text-xs mt-3">
              UPI payments (₹{summary.upiAmount.toFixed(2)}) are already in the owner's account
            </p>
          </div>

          {/* Transactions Count */}
          <div className="text-center text-gray-500 text-sm">
            Total Transactions: {transactions.length}
          </div>
        </main>

        {/* Confirm Button */}
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 max-w-md mx-auto">
          <button
            type="button"
            onClick={handleConfirmAndLogout}
            disabled={confirming}
            className="w-full py-4 bg-blue-700 text-white text-lg font-semibold rounded-xl hover:bg-blue-800 active:bg-blue-900 cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {confirming ? 'Logging out...' : 'Confirm & Logout'}
          </button>
        </div>
      </div>
    </div>
  );
}
