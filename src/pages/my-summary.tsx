'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

type Transaction = {
  id: string;
  customerName: string;
  customerPhone: string;
  maleCostume: number;
  femaleCostume: number;
  kidsCostume: number;
  tube: number;
  locker: number;
  subtotal: number;
  advance: number;
  totalDue: number;
  cashierName: string;
  createdAt: string;
  status: 'active' | 'advance_returned';
  advanceReturnedAt: string | null;
  totalDeduction: number | null;
  actualAmountReturned: number | null;
  isComplimentary: boolean;
  parentTransactionId?: string | null;
  linkedTransaction?: Transaction | null;
};

type TicketTransaction = {
  id: string;
  customerName: string;
  customerPhone: string;
  vehicleNumber: string | null;
  menTicket: number;
  womenTicket: number;
  childTicket: number;
  subtotal: number;
  totalDue: number;
  paymentMethod: 'upi' | 'cash';
  cashierName: string;
  createdAt: string;
  isComplimentary: boolean;
};

export default function MySummary() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ticketTransactions, setTicketTransactions] = useState<TicketTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'advance_returned' | 'linked'>('all');
  const [counterType, setCounterType] = useState<'clothes' | 'ticket'>('clothes');

  // Check user has role
  useEffect(() => {
    if (status === 'authenticated') {
      if (!session?.user?.role) {
        router.push('/access-denied');
      }
    } else if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, session, router]);

  // Get counter type from URL query
  useEffect(() => {
    if (router.isReady) {
      const { counter } = router.query;
      if (counter === 'ticket') {
        setCounterType('ticket');
      } else {
        setCounterType('clothes');
      }
    }
  }, [router.isReady, router.query]);

  // Fetch today's transactions
  useEffect(() => {
    if (session?.user?.role && router.isReady) {
      fetchTodayTransactions();
    }
  }, [session, counterType, router.isReady]);

  // Helper to get date in Indian timezone (YYYY-MM-DD format)
  const getIndianDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD format
    return formatter.format(date);
  };

  const fetchTodayTransactions = async () => {
    setLoading(true);
    try {
      // Get today's date in Indian timezone (YYYY-MM-DD format)
      const now = new Date();
      const todayStr = getIndianDate(now);

      // Tomorrow for end date
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = getIndianDate(tomorrow);

      const params = new URLSearchParams();
      params.append('startDate', todayStr);
      params.append('endDate', tomorrowStr);

      if (counterType === 'ticket') {
        const res = await fetch(`/api/ticket-transactions?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setTicketTransactions(data);
        }
      } else {
        const res = await fetch(`/api/transactions?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
    setLoading(false);
  };

  // Calculate summary for clothes counter
  const totalTransactions = transactions.length;
  const totalSales = transactions.reduce((sum, t) => sum + t.subtotal, 0);
  const totalAdvanceCollected = transactions.reduce((sum, t) => sum + t.advance, 0);
  // Use actualAmountReturned if available, otherwise fall back to advance (for older transactions)
  const totalAdvanceReturned = transactions
    .filter(t => t.status === 'advance_returned')
    .reduce((sum, t) => sum + (t.actualAmountReturned ?? t.advance), 0);
  const totalDeductions = transactions
    .filter(t => t.status === 'advance_returned' && t.totalDeduction)
    .reduce((sum, t) => sum + (t.totalDeduction ?? 0), 0);
  const activeAdvance = transactions
    .filter(t => t.status === 'active')
    .reduce((sum, t) => sum + t.advance, 0);

  // Cash to hand over = Revenue + Pending advances + Deductions kept
  // (Deductions = Advance Collected - Advance Actually Returned for completed transactions)
  const cashToHandOver = totalSales + activeAdvance + totalDeductions;

  // Filter transactions based on status
  const filteredTransactions = statusFilter === 'all'
    ? transactions
    : statusFilter === 'linked'
      ? transactions.filter(t => t.linkedTransaction)
      : transactions.filter(t => t.status === statusFilter);

  // Calculate summary for ticket counter
  const ticketTotalTransactions = ticketTransactions.length;
  const ticketTotalSales = ticketTransactions.reduce((sum, t) => sum + t.totalDue, 0);
  const ticketMenCount = ticketTransactions.reduce((sum, t) => sum + t.menTicket, 0);
  const ticketWomenCount = ticketTransactions.reduce((sum, t) => sum + t.womenTicket, 0);
  const ticketChildCount = ticketTransactions.reduce((sum, t) => sum + t.childTicket, 0);
  const ticketVipCount = ticketTransactions.filter(t => t.isComplimentary).length;
  const ticketUpiCount = ticketTransactions.filter(t => t.paymentMethod === 'upi').length;
  const ticketCashCount = ticketTransactions.filter(t => t.paymentMethod === 'cash').length;
  const ticketCashAmount = ticketTransactions.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.totalDue, 0);
  const ticketUpiAmount = ticketTransactions.filter(t => t.paymentMethod === 'upi').reduce((sum, t) => sum + t.totalDue, 0);

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
        <header className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <button
            type="button"
            onClick={() => router.push(counterType === 'ticket' ? '/ticket-counter' : '/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Subhash Garden" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-xl font-bold text-gray-800">My Day Summary</span>
          </div>
        </header>

        {/* Content */}
        <main className="p-5">
          {/* Date */}
          <div className="text-center mb-4">
            <p className="text-gray-500">
              {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            {session?.user?.name && (
              <p className="text-gray-700 font-medium mt-1">
                Cashier: {session.user.name}
                <span className={`text-xs ml-2 px-2 py-0.5 rounded-full font-medium ${counterType === 'ticket' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {counterType === 'ticket' ? 'Ticket Counter' : 'Clothes Counter'}
                </span>
              </p>
            )}
          </div>

          {/* Ticket Counter View */}
          {counterType === 'ticket' ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{ticketTotalTransactions}</p>
                  <p className="text-sm text-blue-700">Transactions</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">₹{ticketTotalSales.toFixed(0)}</p>
                  <p className="text-sm text-blue-700">Revenue</p>
                </div>
              </div>

              {/* Ticket Breakdown */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-700">{ticketMenCount}</p>
                  <p className="text-xs text-gray-600">Men</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-700">{ticketWomenCount}</p>
                  <p className="text-xs text-gray-600">Women</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-gray-700">{ticketChildCount}</p>
                  <p className="text-xs text-gray-600">Child</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-purple-600">{ticketVipCount}</p>
                  <p className="text-xs text-purple-700">VIP</p>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-green-600">₹{ticketCashAmount.toFixed(0)}</p>
                  <p className="text-sm text-green-700">Cash ({ticketCashCount})</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-blue-600">₹{ticketUpiAmount.toFixed(0)}</p>
                  <p className="text-sm text-blue-700">UPI ({ticketUpiCount})</p>
                </div>
              </div>

              {/* Cash to Hand Over */}
              <div className="bg-blue-600 rounded-xl p-5 mb-6 text-white text-center">
                <p className="text-sm opacity-90 mb-1">Cash to Hand Over</p>
                <p className="text-4xl font-bold">₹{ticketCashAmount.toFixed(2)}</p>
                <p className="text-xs opacity-75 mt-2">(Cash payments only)</p>
              </div>

              {/* Transactions List */}
              <h3 className="font-semibold text-gray-800 mb-3">Today's Ticket Sales</h3>
              {ticketTransactions.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  <p className="text-gray-500">No ticket sales yet today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ticketTransactions.map(transaction => (
                    <div key={transaction.id} className={`bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)] ${transaction.isComplimentary ? 'border-l-4 border-purple-400' : ''}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800">{transaction.customerName}</p>
                            {transaction.isComplimentary && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">VIP</span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${transaction.paymentMethod === 'upi' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                              {transaction.paymentMethod.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">+91 {transaction.customerPhone}</p>
                          {transaction.vehicleNumber && (
                            <p className="text-xs text-gray-400">{transaction.vehicleNumber}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${transaction.isComplimentary ? 'text-purple-600' : 'text-blue-600'}`}>
                            {transaction.isComplimentary ? 'FREE' : `₹${transaction.totalDue.toFixed(2)}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(transaction.createdAt + '+05:30').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-500 pt-2 border-t border-gray-100">
                        <span>TKT-{transaction.id.slice(-8).toUpperCase()}</span>
                        <span>
                          {transaction.menTicket > 0 && `${transaction.menTicket}M `}
                          {transaction.womenTicket > 0 && `${transaction.womenTicket}W `}
                          {transaction.childTicket > 0 && `${transaction.childTicket}C`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Clothes Counter View - Original */}
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{totalTransactions}</p>
                  <p className="text-sm text-blue-700">Transactions</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">₹{totalSales.toFixed(0)}</p>
                  <p className="text-sm text-green-700">Revenue</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-purple-600">₹{totalAdvanceCollected.toFixed(0)}</p>
                  <p className="text-xs text-purple-700">Adv. Collected</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-orange-600">₹{totalAdvanceReturned.toFixed(0)}</p>
                  <p className="text-xs text-orange-700">Adv. Returned</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-red-600">₹{totalDeductions.toFixed(0)}</p>
                  <p className="text-xs text-red-700">Deductions</p>
                </div>
              </div>

              {/* Cash to Hand Over */}
              <div className="bg-green-600 rounded-xl p-5 mb-6 text-white text-center">
                <p className="text-sm opacity-90 mb-1">Cash to Hand Over</p>
                <p className="text-4xl font-bold">₹{cashToHandOver.toFixed(2)}</p>
                <p className="text-xs opacity-75 mt-2">
                  {totalDeductions > 0
                    ? '(Revenue + Pending Advances + Deductions)'
                    : '(Revenue + Pending Advances)'}
                </p>
              </div>

              {/* Pending Advances Info */}
              {activeAdvance > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-medium text-yellow-800">Pending Advances: ₹{activeAdvance.toFixed(0)}</p>
                      <p className="text-sm text-yellow-700">This amount is to be returned to customers when they return items.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Filter */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All ({transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                    statusFilter === 'active'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Active ({transactions.filter(t => t.status === 'active').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('advance_returned')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                    statusFilter === 'advance_returned'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Returned ({transactions.filter(t => t.status === 'advance_returned').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('linked')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'linked'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Linked ({transactions.filter(t => t.linkedTransaction).length})
                </button>
              </div>

              {/* Transactions List */}
              <h3 className="font-semibold text-gray-800 mb-3">Today's Transactions</h3>
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500">
                    {statusFilter === 'all'
                      ? 'No transactions yet today'
                      : statusFilter === 'active'
                        ? 'No active transactions'
                        : statusFilter === 'linked'
                          ? 'No linked transactions'
                          : 'No returned transactions'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map(transaction => (
                    <div key={transaction.id}>
                      {/* Parent Transaction Card */}
                      <div className={`bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)] ${
                        transaction.linkedTransaction
                          ? 'rounded-t-xl border-2 border-b-0 border-purple-200'
                          : `rounded-xl ${transaction.isComplimentary ? 'border-l-4 border-purple-400' : ''}`
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-800">{transaction.customerName}</p>
                              {transaction.isComplimentary && (
                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">VIP</span>
                              )}
                              {transaction.linkedTransaction && (
                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                  Linked
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                transaction.status === 'active'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {transaction.status === 'active' ? 'Active' : 'Returned'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">+91 {transaction.customerPhone}</p>
                          </div>
                          <div className="text-right">
                            {transaction.isComplimentary ? (
                              <>
                                <p className="font-semibold text-purple-600">
                                  {transaction.advance > 0 ? `₹${transaction.advance.toFixed(2)}` : '₹0.00'}
                                </p>
                                <p className="text-xs text-purple-400">
                                  {transaction.advance > 0 ? 'VIP Advance' : 'Complimentary'}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-semibold text-green-600">
                                  ₹{transaction.status === 'advance_returned'
                                    ? (transaction.subtotal + (transaction.totalDeduction ?? 0)).toFixed(2)
                                    : transaction.totalDue.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(transaction.createdAt + '+05:30').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-500 pt-2 border-t border-gray-100">
                          <span>Receipt: HC-{transaction.id.slice(-8).toUpperCase()}</span>
                          {transaction.isComplimentary ? (
                            <span className="text-purple-500">
                              {transaction.status === 'advance_returned' && transaction.advance > 0
                                ? `Returned: ₹${transaction.actualAmountReturned?.toFixed(0) ?? transaction.advance.toFixed(0)}`
                                : transaction.advance > 0
                                  ? `Advance: ₹${transaction.advance.toFixed(0)}`
                                  : 'VIP - No payment'}
                            </span>
                          ) : transaction.status === 'advance_returned' && transaction.actualAmountReturned !== null ? (
                            <span>
                              Returned: ₹{transaction.actualAmountReturned.toFixed(0)}
                              {transaction.totalDeduction && transaction.totalDeduction > 0 && (
                                <span className="text-red-500 ml-1">(-₹{transaction.totalDeduction.toFixed(0)})</span>
                              )}
                            </span>
                          ) : (
                            <span>Advance: ₹{transaction.advance.toFixed(0)}</span>
                          )}
                        </div>
                      </div>

                      {/* Linked Transaction Card */}
                      {transaction.linkedTransaction && (
                        <div className="bg-purple-50 rounded-b-xl p-3 border-2 border-t-0 border-purple-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-4 h-4 border-l-2 border-b-2 border-purple-300 rounded-bl"></div>
                            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span className="text-xs font-medium text-purple-700">Linked Transaction</span>
                          </div>
                          <div className="flex justify-between items-center ml-6">
                            <div className="text-xs text-gray-600">
                              <span>HC-{transaction.linkedTransaction.id.slice(-8).toUpperCase()}</span>
                              <span className="mx-2">•</span>
                              <span>Credit: ₹{transaction.linkedTransaction.subtotal.toFixed(0)}</span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              transaction.linkedTransaction.status === 'active'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {transaction.linkedTransaction.status === 'active' ? 'Active' : 'Returned'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
