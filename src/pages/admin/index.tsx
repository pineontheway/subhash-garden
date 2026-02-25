'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';

type User = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: 'admin' | 'cashier' | null;
  createdAt: string;
};

type Price = {
  id: string;
  itemKey: string;
  itemName: string;
  price: number;
  isActive: boolean;
};

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
  cashierId: string;
  cashierName: string;
  createdAt: string;
  status: 'active' | 'advance_returned';
  advanceReturnedAt: string | null;
  advanceReturnedByName: string | null;
  returnDetails: string | null;
  totalDeduction: number | null;
  actualAmountReturned: number | null;
  isComplimentary: boolean;
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
  paymentMethod: 'upi' | 'cash' | 'split';
  upiAmount: number | null;
  cashAmount: number | null;
  tagNumbers: string | null;
  cashierId: string;
  cashierName: string;
  createdAt: string;
  isComplimentary: boolean;
};

type ItemReturnEntry = {
  type: 'maleCostume' | 'femaleCostume' | 'kidsCostume' | 'tube' | 'locker';
  rented: number;
  returnedGood: number;
  returnedDamaged: number;
  lost: number;
  deduction: number;
};

type ReturnDetails = {
  items: ItemReturnEntry[];
  totalDeduction: number;
  notes?: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'users' | 'prices' | 'reports' | 'inventory' | 'settings' | 'flows'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ticketTransactions, setTicketTransactions] = useState<TicketTransaction[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<Transaction[]>([]);
  const [reportFilter, setReportFilter] = useState<'all' | 'tickets' | 'clothes'>('tickets');
  const [loading, setLoading] = useState(true);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'advance_returned'>('all');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingFlows, setSavingFlows] = useState(false);

  // Date filter - default to today (using Indian timezone)
  const getTodayDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD format
    return formatter.format(new Date());
  };
  const [fromDate, setFromDate] = useState(getTodayDate());
  const [toDate, setToDate] = useState(getTodayDate());

  // Inventory date filter
  const [invFromDate, setInvFromDate] = useState(getTodayDate());
  const [invToDate, setInvToDate] = useState(getTodayDate());

  // Check admin access
  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'admin') {
        router.push('/');
      }
    } else if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, session, router]);

  // Fetch data based on active tab
  useEffect(() => {
    if (session?.user?.role === 'admin') {
      fetchData();
    }
  }, [activeTab, session, statusFilter, fromDate, toDate, invFromDate, invToDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } else if (activeTab === 'prices') {
        const res = await fetch('/api/prices');
        if (res.ok) {
          const data = await res.json();
          setPrices(data);
        }
      } else if (activeTab === 'reports') {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') {
          params.append('status', statusFilter);
        }
        if (fromDate) {
          params.append('startDate', fromDate);
        }
        if (toDate) {
          // Add one day to include the entire end date
          const endDate = new Date(toDate);
          endDate.setDate(endDate.getDate() + 1);
          params.append('endDate', endDate.toISOString().split('T')[0]);
        }
        const queryString = params.toString();

        // Fetch clothes counter transactions
        const clothesUrl = queryString ? `/api/transactions?${queryString}` : '/api/transactions';
        const clothesRes = await fetch(clothesUrl);
        if (clothesRes.ok) {
          const data = await clothesRes.json();
          setTransactions(data);
        }

        // Fetch ticket counter transactions
        const ticketParams = new URLSearchParams();
        if (fromDate) {
          ticketParams.append('startDate', fromDate);
        }
        if (toDate) {
          const endDate = new Date(toDate);
          endDate.setDate(endDate.getDate() + 1);
          ticketParams.append('endDate', endDate.toISOString().split('T')[0]);
        }
        const ticketQueryString = ticketParams.toString();
        const ticketUrl = ticketQueryString ? `/api/ticket-transactions?${ticketQueryString}` : '/api/ticket-transactions';
        const ticketRes = await fetch(ticketUrl);
        if (ticketRes.ok) {
          const data = await ticketRes.json();
          setTicketTransactions(data);
        }
      } else if (activeTab === 'inventory') {
        const params = new URLSearchParams();
        if (invFromDate) {
          params.append('startDate', invFromDate);
        }
        if (invToDate) {
          // Add one day to include the entire end date
          const endDate = new Date(invToDate);
          endDate.setDate(endDate.getDate() + 1);
          params.append('endDate', endDate.toISOString().split('T')[0]);
        }
        const queryString = params.toString();
        const url = queryString ? `/api/transactions?${queryString}` : '/api/transactions';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setInventoryTransactions(data);
        }
      } else if (activeTab === 'settings' || activeTab === 'flows') {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const updateUserRole = async (userId: string, role: 'admin' | 'cashier') => {
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const removeUserRole = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user\'s access?')) return;
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error removing user role:', error);
    }
  };

  const updatePrice = async (priceId: string) => {
    try {
      const res = await fetch('/api/prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: priceId, price: newPrice }),
      });
      if (res.ok) {
        setEditingPrice(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error updating price:', error);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, [key]: value }));
      }
    } catch (error) {
      console.error('Error updating setting:', error);
    }
    setSavingSettings(false);
  };

  const toggleFlow = async (key: 'enable_clothes_flow' | 'enable_ticket_flow', currentValue: boolean) => {
    setSavingFlows(true);
    const newValue = (!currentValue).toString();
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: newValue }),
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, [key]: newValue }));
      }
    } catch (error) {
      console.error('Error toggling flow:', error);
    }
    setSavingFlows(false);
  };

  // Calculate summary for filtered clothes transactions
  const filteredTotal = transactions.reduce((sum, t) => sum + t.subtotal, 0);
  const filteredAdvanceCollected = transactions.reduce((sum, t) => sum + t.advance, 0);
  // Use actualAmountReturned if available, otherwise fall back to advance
  const filteredAdvanceReturned = transactions
    .filter(t => t.status === 'advance_returned')
    .reduce((sum, t) => sum + (t.actualAmountReturned ?? t.advance), 0);
  const filteredActiveAdvance = transactions
    .filter(t => t.status === 'active')
    .reduce((sum, t) => sum + t.advance, 0);

  // Calculate summary for ticket transactions
  const ticketTotal = ticketTransactions.reduce((sum, t) => sum + t.totalDue, 0);
  const ticketMenCount = ticketTransactions.reduce((sum, t) => sum + t.menTicket, 0);
  const ticketWomenCount = ticketTransactions.reduce((sum, t) => sum + t.womenTicket, 0);
  const ticketChildCount = ticketTransactions.reduce((sum, t) => sum + t.childTicket, 0);
  const ticketVipCount = ticketTransactions.filter(t => t.isComplimentary).length;

  // Combined totals
  const combinedRevenue = filteredTotal + ticketTotal;

  // Calculate ticket cashier settlements
  const ticketSettlements = (() => {
    const settlementMap: Record<string, {
      cashierId: string;
      cashierName: string;
      transactions: number;
      totalRevenue: number;
      cashAmount: number;
      upiAmount: number;
      cashToReturn: number;
    }> = {};

    ticketTransactions.forEach(t => {
      if (!settlementMap[t.cashierId]) {
        settlementMap[t.cashierId] = {
          cashierId: t.cashierId,
          cashierName: t.cashierName,
          transactions: 0,
          totalRevenue: 0,
          cashAmount: 0,
          upiAmount: 0,
          cashToReturn: 0,
        };
      }

      const settlement = settlementMap[t.cashierId];
      settlement.transactions += 1;
      settlement.totalRevenue += t.totalDue;

      if (t.paymentMethod === 'cash') {
        settlement.cashAmount += t.totalDue;
        settlement.cashToReturn += t.totalDue;
      } else if (t.paymentMethod === 'upi') {
        settlement.upiAmount += t.totalDue;
      } else if (t.paymentMethod === 'split') {
        settlement.upiAmount += t.upiAmount || 0;
        settlement.cashAmount += t.cashAmount || 0;
        settlement.cashToReturn += t.cashAmount || 0;
      }
    });

    return Object.values(settlementMap);
  })();

  // Calculate clothes cashier settlements
  const clothesSettlements = (() => {
    const settlementMap: Record<string, {
      cashierId: string;
      cashierName: string;
      transactions: number;
      totalRevenue: number;
      advanceCollected: number;
      advanceReturned: number;
      deductions: number;
      netCash: number;
    }> = {};

    transactions.forEach(t => {
      if (!settlementMap[t.cashierId]) {
        settlementMap[t.cashierId] = {
          cashierId: t.cashierId,
          cashierName: t.cashierName,
          transactions: 0,
          totalRevenue: 0,
          advanceCollected: 0,
          advanceReturned: 0,
          deductions: 0,
          netCash: 0,
        };
      }

      const settlement = settlementMap[t.cashierId];
      settlement.transactions += 1;
      settlement.totalRevenue += t.subtotal;
      settlement.advanceCollected += t.advance;

      // If this cashier returned the advance
      if (t.status === 'advance_returned' && t.advanceReturnedByName === t.cashierName) {
        settlement.advanceReturned += t.actualAmountReturned ?? t.advance;
        settlement.deductions += t.totalDeduction ?? 0;
      }
    });

    // Calculate net cash for each cashier
    Object.values(settlementMap).forEach(s => {
      s.netCash = s.advanceCollected - s.advanceReturned + s.deductions;
    });

    return Object.values(settlementMap);
  })();

  // Calculate damage analytics
  const damageAnalytics = (() => {
    let totalDeductions = 0;
    let damagedItems = { maleCostume: 0, femaleCostume: 0, kidsCostume: 0, tube: 0, locker: 0 };
    let lostItems = { maleCostume: 0, femaleCostume: 0, kidsCostume: 0, tube: 0, locker: 0 };
    const damageRecords: Array<{
      transactionId: string;
      customerName: string;
      date: string;
      items: Array<{ type: string; damaged: number; lost: number; deduction: number }>;
      totalDeduction: number;
      notes?: string;
    }> = [];

    transactions.forEach(t => {
      if (t.returnDetails && t.totalDeduction && t.totalDeduction > 0) {
        try {
          const details: ReturnDetails = JSON.parse(t.returnDetails);
          totalDeductions += t.totalDeduction;

          const itemsWithDamage: Array<{ type: string; damaged: number; lost: number; deduction: number }> = [];

          details.items.forEach(item => {
            if (item.returnedDamaged > 0 || item.lost > 0) {
              damagedItems[item.type] += item.returnedDamaged;
              lostItems[item.type] += item.lost;
              itemsWithDamage.push({
                type: item.type,
                damaged: item.returnedDamaged,
                lost: item.lost,
                deduction: item.deduction,
              });
            }
          });

          if (itemsWithDamage.length > 0) {
            damageRecords.push({
              transactionId: t.id,
              customerName: t.customerName,
              date: t.advanceReturnedAt || t.createdAt,
              items: itemsWithDamage,
              totalDeduction: t.totalDeduction,
              notes: details.notes,
            });
          }
        } catch (e) {
          console.error('Error parsing return details:', e);
        }
      }
    });

    return {
      totalDeductions,
      damagedItems,
      lostItems,
      damageRecords,
      totalDamagedCount: Object.values(damagedItems).reduce((a, b) => a + b, 0),
      totalLostCount: Object.values(lostItems).reduce((a, b) => a + b, 0),
    };
  })();

  // Calculate inventory counts (accounting for lost items)
  const inventoryData = (() => {
    const itemTypes = ['maleCostume', 'femaleCostume', 'kidsCostume', 'tube', 'locker'] as const;
    const data: Record<string, { givenOut: number; returned: number; lost: number; stillOut: number }> = {};

    itemTypes.forEach(itemType => {
      const fieldMap: Record<string, keyof Transaction> = {
        maleCostume: 'maleCostume',
        femaleCostume: 'femaleCostume',
        kidsCostume: 'kidsCostume',
        tube: 'tube',
        locker: 'locker',
      };

      const field = fieldMap[itemType];
      const givenOut = inventoryTransactions.reduce((sum, t) => sum + (t[field] as number), 0);
      const stillOut = inventoryTransactions.filter(t => t.status === 'active').reduce((sum, t) => sum + (t[field] as number), 0);

      // Calculate actual returned and lost from returnDetails
      let actualReturned = 0;
      let lost = 0;

      inventoryTransactions.filter(t => t.status === 'advance_returned').forEach(t => {
        if (t.returnDetails) {
          try {
            const details: ReturnDetails = JSON.parse(t.returnDetails);
            const item = details.items.find(i => i.type === itemType);
            if (item) {
              actualReturned += item.returnedGood + item.returnedDamaged;
              lost += item.lost;
            }
          } catch (e) {
            // Fallback for old transactions without returnDetails
            actualReturned += t[field] as number;
          }
        } else {
          // Fallback for old transactions without returnDetails
          actualReturned += t[field] as number;
        }
      });

      data[itemType] = { givenOut, returned: actualReturned, lost, stillOut };
    });

    return data;
  })();

  const totalItemsOut = inventoryData.maleCostume.stillOut + inventoryData.femaleCostume.stillOut +
    inventoryData.kidsCostume.stillOut + inventoryData.tube.stillOut + inventoryData.locker.stillOut;
  const totalItemsLost = inventoryData.maleCostume.lost + inventoryData.femaleCostume.lost +
    inventoryData.kidsCostume.lost + inventoryData.tube.lost + inventoryData.locker.lost;

  // Quick date filter helpers
  const setToday = () => {
    const today = getTodayDate();
    setFromDate(today);
    setToDate(today);
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    setFromDate(dateStr);
    setToDate(dateStr);
  };

  const setThisWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek); // Sunday
    setFromDate(startOfWeek.toISOString().split('T')[0]);
    setToDate(getTodayDate());
  };

  const setThisMonth = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setFromDate(startOfMonth.toISOString().split('T')[0]);
    setToDate(getTodayDate());
  };

  // Inventory date filter helpers
  const setInvToday = () => {
    const today = getTodayDate();
    setInvFromDate(today);
    setInvToDate(today);
  };

  const setInvYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    setInvFromDate(dateStr);
    setInvToDate(dateStr);
  };

  const setInvThisWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    setInvFromDate(startOfWeek.toISOString().split('T')[0]);
    setInvToDate(getTodayDate());
  };

  const setInvThisMonth = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setInvFromDate(startOfMonth.toISOString().split('T')[0]);
    setInvToDate(getTodayDate());
  };

  // Get display label for inventory date range
  const getInvDateLabel = () => {
    const today = getTodayDate();
    if (invFromDate === today && invToDate === today) return "Today's";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (invFromDate === yesterdayStr && invToDate === yesterdayStr) return "Yesterday's";
    if (invFromDate === invToDate) return new Date(invFromDate).toLocaleDateString('en-IN', { dateStyle: 'medium' });
    return `${new Date(invFromDate).toLocaleDateString('en-IN', { dateStyle: 'short' })} - ${new Date(invToDate).toLocaleDateString('en-IN', { dateStyle: 'short' })}`;
  };

  // Get display label for date range
  const getDateLabel = () => {
    const today = getTodayDate();
    if (fromDate === today && toDate === today) return "Today's";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (fromDate === yesterdayStr && toDate === yesterdayStr) return "Yesterday's";
    if (fromDate === toDate) return new Date(fromDate).toLocaleDateString('en-IN', { dateStyle: 'medium' });
    return `${new Date(fromDate).toLocaleDateString('en-IN', { dateStyle: 'short' })} - ${new Date(toDate).toLocaleDateString('en-IN', { dateStyle: 'short' })}`;
  };

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white shadow-xl min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-800 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Subhash Garden" className="w-8 h-8 rounded-full object-cover" />
              <span className="text-xl font-bold text-gray-800">Admin Panel</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-green-600 font-medium cursor-pointer"
          >
            Logout
          </button>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-3 text-center font-medium cursor-pointer ${
              activeTab === 'users'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Users
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prices')}
            className={`flex-1 py-3 text-center font-medium cursor-pointer ${
              activeTab === 'prices'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Prices
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-3 text-center font-medium cursor-pointer ${
              activeTab === 'reports'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 py-3 text-center font-medium cursor-pointer ${
              activeTab === 'inventory'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Inventory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 text-center font-medium cursor-pointer ${
              activeTab === 'settings'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('flows')}
            className={`flex-1 py-3 text-center font-medium cursor-pointer ${
              activeTab === 'flows'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Flows
          </button>
        </div>

        {/* Content */}
        <main className="p-5">
          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Users Tab */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">User Management</h2>
                  {users.length === 0 ? (
                    <p className="text-gray-500 text-center py-10">No users found</p>
                  ) : (
                    <div className="space-y-3">
                      {users.map(user => (
                        <div key={user.id} className="bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)] flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {user.image && (
                              <img src={user.image} alt={user.name} className="w-10 h-10 rounded-full" />
                            )}
                            <div>
                              <p className="font-medium text-gray-800">{user.name}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={user.role || ''}
                              onChange={(e) => {
                                const role = e.target.value as 'admin' | 'cashier';
                                if (role) updateUserRole(user.id, role);
                              }}
                              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm cursor-pointer"
                            >
                              <option value="">No Role</option>
                              <option value="cashier">Cashier</option>
                              <option value="admin">Admin</option>
                            </select>
                            {user.role && user.id !== session?.user?.id && (
                              <button
                                type="button"
                                onClick={() => removeUserRole(user.id)}
                                className="text-red-500 hover:text-red-700 text-sm cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Prices Tab */}
              {activeTab === 'prices' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Price Management</h2>

                  {/* Entry Tickets Section */}
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h3 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                      Entry Tickets
                    </h3>
                    <div className="space-y-3">
                      {prices.filter(p => p.itemKey.includes('ticket')).map(price => (
                        <div key={price.id} className="bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)] flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-800">{price.itemName}</p>
                            <p className="text-sm text-gray-500">{price.itemKey}</p>
                          </div>
                          {editingPrice === price.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={newPrice}
                                onChange={(e) => setNewPrice(Number(e.target.value))}
                                className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-right"
                              />
                              <button
                                type="button"
                                onClick={() => updatePrice(price.id)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPrice(null)}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-semibold text-blue-600">₹{price.price}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPrice(price.id);
                                  setNewPrice(price.price);
                                }}
                                className="text-gray-500 hover:text-gray-700 cursor-pointer"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {prices.filter(p => p.itemKey.includes('ticket')).length === 0 && (
                        <p className="text-sm text-blue-600 italic">No ticket prices configured. Run the migration to add them.</p>
                      )}
                    </div>
                  </div>

                  {/* Rentals Section */}
                  <div className="bg-green-50 rounded-xl p-4">
                    <h3 className="font-medium text-green-800 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Rentals (Clothes Counter)
                    </h3>
                    <div className="space-y-3">
                      {prices.filter(p => !p.itemKey.includes('ticket')).map(price => (
                        <div key={price.id} className="bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)] flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-800">{price.itemName}</p>
                            <p className="text-sm text-gray-500">{price.itemKey}</p>
                          </div>
                          {editingPrice === price.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={newPrice}
                                onChange={(e) => setNewPrice(Number(e.target.value))}
                                className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-right"
                              />
                              <button
                                type="button"
                                onClick={() => updatePrice(price.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPrice(null)}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-semibold text-green-600">₹{price.price}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPrice(price.id);
                                  setNewPrice(price.price);
                                }}
                                className="text-gray-500 hover:text-gray-700 cursor-pointer"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Reports Tab */}
              {activeTab === 'reports' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Reports</h2>

                  {/* Date Filter */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Filter by Date
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">From</label>
                        <input
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">To</label>
                        <input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={setToday}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 cursor-pointer"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={setYesterday}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 cursor-pointer"
                      >
                        Yesterday
                      </button>
                      <button
                        type="button"
                        onClick={setThisWeek}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 cursor-pointer"
                      >
                        This Week
                      </button>
                      <button
                        type="button"
                        onClick={setThisMonth}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 cursor-pointer"
                      >
                        This Month
                      </button>
                    </div>
                  </div>

                  {/* Combined Total Revenue - Always shown */}
                  <div className="bg-purple-50 rounded-xl p-4">
                    <h3 className="font-medium text-purple-800 mb-3">{getDateLabel()} - Total Revenue</h3>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-purple-600">₹{combinedRevenue.toFixed(2)}</p>
                      <p className="text-sm text-purple-700 mt-1">{transactions.length + ticketTransactions.length} total transactions</p>
                    </div>
                  </div>

                  {/* Tickets / Clothes Tabs */}
                  <div className="flex border-b border-gray-200">
                    <button
                      type="button"
                      onClick={() => setReportFilter('tickets')}
                      className={`flex-1 py-3 text-center font-medium cursor-pointer ${
                        reportFilter === 'tickets'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                        Tickets
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportFilter('clothes')}
                      className={`flex-1 py-3 text-center font-medium cursor-pointer ${
                        reportFilter === 'clothes'
                          ? 'text-green-600 border-b-2 border-green-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Clothes
                      </span>
                    </button>
                  </div>

                  {/* TICKETS TAB CONTENT */}
                  {reportFilter === 'tickets' && (
                    <>
                      {/* Ticket Counter Summary */}
                      <div className="bg-blue-50 rounded-xl p-4">
                        <h3 className="font-medium text-blue-800 mb-3">Ticket Counter Stats</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">{ticketTransactions.length}</p>
                            <p className="text-sm text-blue-700">Transactions</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">₹{ticketTotal.toFixed(2)}</p>
                            <p className="text-sm text-blue-700">Revenue</p>
                          </div>
                        </div>
                        <div className="border-t border-blue-200 pt-3">
                          <h4 className="text-sm font-medium text-blue-800 mb-2">Ticket Breakdown</h4>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="bg-white/50 rounded-lg p-2">
                              <p className="text-lg font-bold text-blue-700">{ticketMenCount}</p>
                              <p className="text-xs text-blue-800">Men</p>
                            </div>
                            <div className="bg-white/50 rounded-lg p-2">
                              <p className="text-lg font-bold text-blue-700">{ticketWomenCount}</p>
                              <p className="text-xs text-blue-800">Women</p>
                            </div>
                            <div className="bg-white/50 rounded-lg p-2">
                              <p className="text-lg font-bold text-blue-700">{ticketChildCount}</p>
                              <p className="text-xs text-blue-800">Child</p>
                            </div>
                            <div className="bg-white/50 rounded-lg p-2">
                              <p className="text-lg font-bold text-purple-600">{ticketVipCount}</p>
                              <p className="text-xs text-purple-700">VIP</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Ticket Cashier Settlements */}
                      <div className="bg-orange-50 rounded-xl p-4">
                        <h3 className="font-medium text-orange-800 mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Cashier Settlements
                        </h3>
                        {ticketSettlements.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">No settlements for this period</p>
                        ) : (
                          <div className="space-y-3">
                            {ticketSettlements.map(settlement => (
                              <div key={settlement.cashierId} className="bg-white rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <p className="font-medium text-gray-800">{settlement.cashierName}</p>
                                    <p className="text-xs text-gray-500">{settlement.transactions} transactions</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-orange-600">₹{settlement.cashToReturn.toFixed(0)}</p>
                                    <p className="text-xs text-orange-700">Cash to Return</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-gray-100">
                                  <div className="text-center">
                                    <p className="font-medium text-gray-700">₹{settlement.totalRevenue.toFixed(0)}</p>
                                    <p className="text-gray-500">Total</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="font-medium text-green-600">₹{settlement.cashAmount.toFixed(0)}</p>
                                    <p className="text-gray-500">Cash</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="font-medium text-blue-600">₹{settlement.upiAmount.toFixed(0)}</p>
                                    <p className="text-gray-500">UPI</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* CLOTHES TAB CONTENT */}
                  {reportFilter === 'clothes' && (
                    <>
                      {/* Clothes Counter Summary */}
                      <div className="bg-green-50 rounded-xl p-4">
                        <h3 className="font-medium text-green-800 mb-3">Clothes Counter Stats</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{transactions.length}</p>
                            <p className="text-sm text-green-700">Transactions</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">₹{filteredTotal.toFixed(2)}</p>
                            <p className="text-sm text-green-700">Revenue</p>
                          </div>
                        </div>
                        <div className="border-t border-green-200 pt-3">
                          <h4 className="text-sm font-medium text-green-800 mb-2">Advance Tracking</h4>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white/50 rounded-lg p-2">
                              <p className="text-lg font-bold text-green-700">₹{filteredAdvanceCollected.toFixed(0)}</p>
                              <p className="text-xs text-green-800">Collected</p>
                            </div>
                            <div className="bg-white/50 rounded-lg p-2">
                              <p className="text-lg font-bold text-orange-600">₹{filteredAdvanceReturned.toFixed(0)}</p>
                              <p className="text-xs text-orange-700">Returned</p>
                            </div>
                            <div className="bg-white/50 rounded-lg p-2">
                              <p className="text-lg font-bold text-purple-700">₹{filteredActiveAdvance.toFixed(0)}</p>
                              <p className="text-xs text-purple-800">Pending</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Clothes Cashier Settlements */}
                      <div className="bg-orange-50 rounded-xl p-4">
                        <h3 className="font-medium text-orange-800 mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Cashier Settlements
                        </h3>
                        {clothesSettlements.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">No settlements for this period</p>
                        ) : (
                          <div className="space-y-3">
                            {clothesSettlements.map(settlement => (
                              <div key={settlement.cashierId} className="bg-white rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <p className="font-medium text-gray-800">{settlement.cashierName}</p>
                                    <p className="text-xs text-gray-500">{settlement.transactions} transactions</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-orange-600">₹{settlement.netCash.toFixed(0)}</p>
                                    <p className="text-xs text-orange-700">Net Cash</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-xs pt-2 border-t border-gray-100">
                                  <div className="text-center">
                                    <p className="font-medium text-green-600">₹{settlement.advanceCollected.toFixed(0)}</p>
                                    <p className="text-gray-500">Collected</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="font-medium text-orange-600">₹{settlement.advanceReturned.toFixed(0)}</p>
                                    <p className="text-gray-500">Returned</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="font-medium text-red-600">₹{settlement.deductions.toFixed(0)}</p>
                                    <p className="text-gray-500">Deductions</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="font-medium text-gray-700">₹{settlement.totalRevenue.toFixed(0)}</p>
                                    <p className="text-gray-500">Revenue</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Damage Analytics - Only for clothes */}
                      {(damageAnalytics.totalDamagedCount > 0 || damageAnalytics.totalLostCount > 0) && (
                        <div className="bg-red-50 rounded-xl p-4">
                          <h3 className="font-medium text-red-800 mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Damage & Loss Report
                          </h3>
                          <div className="grid grid-cols-3 gap-2 text-center mb-4">
                            <div className="bg-white/50 rounded-lg p-2">
                              <p className="text-lg font-bold text-red-700">₹{damageAnalytics.totalDeductions.toFixed(0)}</p>
                              <p className="text-xs text-red-800">Total Deductions</p>
                            </div>
                            <div className="bg-white/50 rounded-lg p-2">
                              <p className="text-lg font-bold text-orange-600">{damageAnalytics.totalDamagedCount}</p>
                              <p className="text-xs text-orange-700">Items Damaged</p>
                            </div>
                            <div className="bg-white/50 rounded-lg p-2">
                              <p className="text-lg font-bold text-gray-700">{damageAnalytics.totalLostCount}</p>
                              <p className="text-xs text-gray-600">Items Lost</p>
                            </div>
                          </div>

                          {/* Damage by item type */}
                          <div className="bg-white/50 rounded-lg p-3 mb-3">
                            <p className="text-xs font-medium text-red-800 mb-2">Breakdown by Item Type</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(damageAnalytics.damagedItems).map(([type, count]) => {
                                const lostCount = damageAnalytics.lostItems[type as keyof typeof damageAnalytics.lostItems];
                                if (count === 0 && lostCount === 0) return null;
                                const labelMap: Record<string, string> = {
                                  maleCostume: 'Male Costume',
                                  femaleCostume: 'Female Costume',
                                  kidsCostume: 'Kids Costume',
                                  tube: 'Tube',
                                  locker: 'Locker',
                                };
                                return (
                                  <div key={type} className="flex justify-between bg-white rounded px-2 py-1">
                                    <span className="text-gray-700">{labelMap[type]}</span>
                                    <span>
                                      {count > 0 && <span className="text-orange-600">{count} dmg</span>}
                                      {count > 0 && lostCount > 0 && <span className="text-gray-400"> / </span>}
                                      {lostCount > 0 && <span className="text-gray-600">{lostCount} lost</span>}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Status Filter for clothes transactions */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setStatusFilter('all')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                            statusFilter === 'all'
                              ? 'bg-gray-800 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('active')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                            statusFilter === 'active'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Active
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
                          Returned
                        </button>
                      </div>
                    </>
                  )}

                  {/* Ticket Transactions List */}
                  {reportFilter === 'tickets' && (
                    <>
                      <h3 className="font-medium text-blue-700 mt-6 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                        Ticket Transactions
                      </h3>
                      {ticketTransactions.length === 0 ? (
                        <p className="text-gray-500 text-center py-10">No ticket transactions found</p>
                      ) : (
                        <div className="space-y-3">
                          {ticketTransactions.slice(0, 20).map(transaction => (
                            <div key={transaction.id} className={`bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)] border-l-4 ${transaction.isComplimentary ? 'border-purple-400' : 'border-blue-400'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-800">{transaction.customerName}</p>
                                    {transaction.isComplimentary && (
                                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">VIP</span>
                                    )}
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      transaction.paymentMethod === 'upi' ? 'bg-blue-100 text-blue-700' :
                                      transaction.paymentMethod === 'split' ? 'bg-purple-100 text-purple-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>
                                      {transaction.paymentMethod === 'upi' ? 'UPI' :
                                       transaction.paymentMethod === 'split' ? 'Split' : 'Cash'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-500">+91 {transaction.customerPhone}</p>
                                  {transaction.vehicleNumber && (
                                    <p className="text-xs text-gray-400">{transaction.vehicleNumber}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-blue-600">
                                    {transaction.isComplimentary ? '₹0.00' : `₹${transaction.totalDue.toFixed(2)}`}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(transaction.createdAt + '+05:30').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-sm text-gray-500">
                                <span>Cashier: {transaction.cashierName}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs">
                                    M:{transaction.menTicket} W:{transaction.womenTicket} C:{transaction.childTicket}
                                  </span>
                                  {transaction.tagNumbers && (
                                    <span className="text-xs text-blue-600 font-medium">
                                      Tags: {transaction.tagNumbers}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {transaction.paymentMethod === 'split' && transaction.upiAmount && transaction.cashAmount && (
                                <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-purple-600">
                                  Split: UPI ₹{transaction.upiAmount} + Cash ₹{transaction.cashAmount}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Clothes Transactions List */}
                  {reportFilter === 'clothes' && (
                    <>
                      <h3 className="font-medium text-green-700 mt-6 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Clothes Transactions
                      </h3>
                      {transactions.length === 0 ? (
                        <p className="text-gray-500 text-center py-10">No clothes transactions found</p>
                      ) : (
                        <div className="space-y-3">
                          {transactions.slice(0, 20).map(transaction => (
                            <div key={transaction.id} className={`bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)] border-l-4 ${transaction.isComplimentary ? 'border-purple-400' : 'border-green-400'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-800">{transaction.customerName}</p>
                                    {transaction.isComplimentary && (
                                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">VIP</span>
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
                              <div className="flex justify-between items-center text-sm text-gray-500">
                                <span>Cashier: {transaction.cashierName}</span>
                                {transaction.isComplimentary ? (
                                  <span className="text-purple-500">
                                    {transaction.advance > 0 ? `Advance: ₹${transaction.advance.toFixed(2)}` : 'VIP - No payment'}
                                  </span>
                                ) : (
                                  <span>Advance: ₹{transaction.advance.toFixed(2)}</span>
                                )}
                              </div>
                              {transaction.status === 'advance_returned' && transaction.advanceReturnedByName && (
                                <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-orange-600">
                                  Returned by {transaction.advanceReturnedByName} on {new Date(transaction.advanceReturnedAt! + '+05:30').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}
                                  {!transaction.isComplimentary && transaction.totalDeduction && transaction.totalDeduction > 0 && (
                                    <span className="ml-2 text-red-600 font-medium">
                                      (Deduction: ₹{transaction.totalDeduction.toFixed(0)})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Inventory Tab */}
              {activeTab === 'inventory' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Inventory Tracking</h2>

                  {/* Date Filter */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Filter by Date
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">From</label>
                        <input
                          type="date"
                          value={invFromDate}
                          onChange={(e) => setInvFromDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">To</label>
                        <input
                          type="date"
                          value={invToDate}
                          onChange={(e) => setInvToDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={setInvToday}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 cursor-pointer"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={setInvYesterday}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 cursor-pointer"
                      >
                        Yesterday
                      </button>
                      <button
                        type="button"
                        onClick={setInvThisWeek}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 cursor-pointer"
                      >
                        This Week
                      </button>
                      <button
                        type="button"
                        onClick={setInvThisMonth}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 cursor-pointer"
                      >
                        This Month
                      </button>
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-orange-500 rounded-xl p-5 text-white text-center">
                      <p className="text-sm opacity-90 mb-1">{getInvDateLabel()} Items Still Out</p>
                      <p className="text-4xl font-bold">{totalItemsOut}</p>
                      <p className="text-xs opacity-75 mt-2">With customers</p>
                    </div>
                    <div className="bg-red-500 rounded-xl p-5 text-white text-center">
                      <p className="text-sm opacity-90 mb-1">{getInvDateLabel()} Items Lost</p>
                      <p className="text-4xl font-bold">{totalItemsLost}</p>
                      <p className="text-xs opacity-75 mt-2">Not returned</p>
                    </div>
                  </div>

                  {/* Inventory Table */}
                  <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.08)] overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-800">{getInvDateLabel()} Item Breakdown</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Item</th>
                            <th className="text-center py-3 px-3 text-sm font-medium text-blue-600">Given Out</th>
                            <th className="text-center py-3 px-3 text-sm font-medium text-green-600">Returned</th>
                            <th className="text-center py-3 px-3 text-sm font-medium text-red-600">Lost</th>
                            <th className="text-center py-3 px-3 text-sm font-medium text-orange-600">Still Out</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-gray-100">
                            <td className="py-3 px-4 text-gray-800">Male Costume</td>
                            <td className="py-3 px-3 text-center text-blue-600 font-medium">{inventoryData.maleCostume.givenOut}</td>
                            <td className="py-3 px-3 text-center text-green-600 font-medium">{inventoryData.maleCostume.returned}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${inventoryData.maleCostume.lost > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                {inventoryData.maleCostume.lost}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${inventoryData.maleCostume.stillOut > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                {inventoryData.maleCostume.stillOut}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="py-3 px-4 text-gray-800">Female Costume</td>
                            <td className="py-3 px-3 text-center text-blue-600 font-medium">{inventoryData.femaleCostume.givenOut}</td>
                            <td className="py-3 px-3 text-center text-green-600 font-medium">{inventoryData.femaleCostume.returned}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${inventoryData.femaleCostume.lost > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                {inventoryData.femaleCostume.lost}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${inventoryData.femaleCostume.stillOut > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                {inventoryData.femaleCostume.stillOut}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="py-3 px-4 text-gray-800">Kids Costume</td>
                            <td className="py-3 px-3 text-center text-blue-600 font-medium">{inventoryData.kidsCostume.givenOut}</td>
                            <td className="py-3 px-3 text-center text-green-600 font-medium">{inventoryData.kidsCostume.returned}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${inventoryData.kidsCostume.lost > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                {inventoryData.kidsCostume.lost}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${inventoryData.kidsCostume.stillOut > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                {inventoryData.kidsCostume.stillOut}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="py-3 px-4 text-gray-800">Tube</td>
                            <td className="py-3 px-3 text-center text-blue-600 font-medium">{inventoryData.tube.givenOut}</td>
                            <td className="py-3 px-3 text-center text-green-600 font-medium">{inventoryData.tube.returned}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${inventoryData.tube.lost > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                {inventoryData.tube.lost}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${inventoryData.tube.stillOut > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                {inventoryData.tube.stillOut}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="py-3 px-4 text-gray-800">Locker</td>
                            <td className="py-3 px-3 text-center text-blue-600 font-medium">{inventoryData.locker.givenOut}</td>
                            <td className="py-3 px-3 text-center text-green-600 font-medium">{inventoryData.locker.returned}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${inventoryData.locker.lost > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                {inventoryData.locker.lost}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${inventoryData.locker.stillOut > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                {inventoryData.locker.stillOut}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                          <tr>
                            <td className="py-3 px-4 font-semibold text-gray-800">Total</td>
                            <td className="py-3 px-3 text-center font-bold text-blue-600">
                              {inventoryData.maleCostume.givenOut + inventoryData.femaleCostume.givenOut + inventoryData.kidsCostume.givenOut + inventoryData.tube.givenOut + inventoryData.locker.givenOut}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-green-600">
                              {inventoryData.maleCostume.returned + inventoryData.femaleCostume.returned + inventoryData.kidsCostume.returned + inventoryData.tube.returned + inventoryData.locker.returned}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-500 text-white">
                                {totalItemsLost}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-3 py-1 rounded-full text-sm font-bold bg-orange-500 text-white">
                                {totalItemsOut}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Info Note */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-medium text-blue-800">How to read this data</p>
                        <p className="text-sm text-blue-700 mt-1">
                          <strong>Given Out:</strong> Total items rented in this period<br />
                          <strong>Returned:</strong> Items returned (good + damaged condition)<br />
                          <strong>Lost:</strong> Items not returned by customers<br />
                          <strong>Still Out:</strong> Items currently with customers (active rentals)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Business Settings</h2>

                  {/* Clothes Counter UPI Settings Card */}
                  <div className="bg-white rounded-xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                    <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Clothes Counter UPI
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      UPI settings for costume rental payments at the clothes counter.
                    </p>

                    <div className="space-y-4">
                      {/* Clothes UPI ID */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          UPI ID (VPA)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={settings.clothes_upi_id || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, clothes_upi_id: e.target.value }))}
                            placeholder="clothes@upi"
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateSetting('clothes_upi_id', settings.clothes_upi_id || '')}
                            disabled={savingSettings}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 cursor-pointer"
                          >
                            {savingSettings ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Example: subhashclothes@paytm, subhashclothes@ybl
                        </p>
                      </div>

                      {/* Clothes Business Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Business Name (for QR display)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={settings.clothes_business_name || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, clothes_business_name: e.target.value }))}
                            placeholder="Subhash Garden Clothes"
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateSetting('clothes_business_name', settings.clothes_business_name || '')}
                            disabled={savingSettings}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 cursor-pointer"
                          >
                            {savingSettings ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          This name will appear when customers scan the QR code
                        </p>
                      </div>
                    </div>

                    {/* Clothes Preview */}
                    {settings.clothes_upi_id && (
                      <div className="mt-4 bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <h4 className="font-medium text-purple-800 text-sm mb-1">Preview</h4>
                        <code className="text-xs text-purple-700 break-all">
                          upi://pay?pa={settings.clothes_upi_id}&pn={encodeURIComponent(settings.clothes_business_name || 'Subhash Garden')}&am=100&cu=INR
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Tickets Counter UPI Settings Card */}
                  <div className="bg-white rounded-xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                    <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Tickets Counter UPI
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      UPI settings for entry ticket payments at the ticket counter.
                    </p>

                    <div className="space-y-4">
                      {/* Tickets UPI ID */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          UPI ID (VPA)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={settings.tickets_upi_id || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, tickets_upi_id: e.target.value }))}
                            placeholder="tickets@upi"
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateSetting('tickets_upi_id', settings.tickets_upi_id || '')}
                            disabled={savingSettings}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 cursor-pointer"
                          >
                            {savingSettings ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Example: subhashtickets@paytm, subhashtickets@ybl
                        </p>
                      </div>

                      {/* Tickets Business Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Business Name (for QR display)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={settings.tickets_business_name || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, tickets_business_name: e.target.value }))}
                            placeholder="Subhash Garden Tickets"
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateSetting('tickets_business_name', settings.tickets_business_name || '')}
                            disabled={savingSettings}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 cursor-pointer"
                          >
                            {savingSettings ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          This name will appear when customers scan the QR code
                        </p>
                      </div>
                    </div>

                    {/* Tickets Preview */}
                    {settings.tickets_upi_id && (
                      <div className="mt-4 bg-green-50 rounded-lg p-3 border border-green-200">
                        <h4 className="font-medium text-green-800 text-sm mb-1">Preview</h4>
                        <code className="text-xs text-green-700 break-all">
                          upi://pay?pa={settings.tickets_upi_id}&pn={encodeURIComponent(settings.tickets_business_name || 'Subhash Garden')}&am=100&cu=INR
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Info Note */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-medium text-blue-800">How UPI QR works</p>
                        <p className="text-sm text-blue-700 mt-1">
                          When a cashier clicks "Pay" at checkout, a QR code will be shown that customers can scan with any UPI app (GPay, PhonePe, Paytm, etc.). The payment amount will be pre-filled. Each counter uses its own UPI configuration.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Flows Tab */}
              {activeTab === 'flows' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Flow Controls</h2>
                  <p className="text-sm text-gray-500">Enable or disable each counter flow. Disabled flows will be greyed out on the counter selection screen.</p>

                  {/* Ticket Counter Flow */}
                  <div className="bg-white rounded-xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">Ticket Counter</p>
                          <p className="text-sm text-gray-500">Entry ticket sales with tag numbers</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={savingFlows}
                        onClick={() => toggleFlow('enable_ticket_flow', settings.enable_ticket_flow !== 'false')}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                          settings.enable_ticket_flow !== 'false' ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            settings.enable_ticket_flow !== 'false' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className={`mt-3 text-xs font-medium ${settings.enable_ticket_flow !== 'false' ? 'text-blue-600' : 'text-gray-400'}`}>
                      {settings.enable_ticket_flow !== 'false' ? 'Enabled — Ticket counter is active' : 'Disabled — Ticket counter is hidden from cashiers'}
                    </p>
                  </div>

                  {/* Clothes Counter Flow */}
                  <div className="bg-white rounded-xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">Clothes Counter</p>
                          <p className="text-sm text-gray-500">Costume rentals with advance system</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={savingFlows}
                        onClick={() => toggleFlow('enable_clothes_flow', settings.enable_clothes_flow !== 'false')}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                          settings.enable_clothes_flow !== 'false' ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            settings.enable_clothes_flow !== 'false' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className={`mt-3 text-xs font-medium ${settings.enable_clothes_flow !== 'false' ? 'text-green-600' : 'text-gray-400'}`}>
                      {settings.enable_clothes_flow !== 'false' ? 'Enabled — Clothes counter is active' : 'Disabled — Clothes counter is hidden from cashiers'}
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-amber-800">Disabling a flow hides it from cashiers on the counter selection screen. Admins can always access both flows.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
