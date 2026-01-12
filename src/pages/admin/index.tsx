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
};

export default function AdminDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'users' | 'prices' | 'reports'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'advance_returned'>('all');

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
  }, [activeTab, session, statusFilter, fromDate, toDate]);

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
        const url = queryString ? `/api/transactions?${queryString}` : '/api/transactions';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
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

  // Calculate summary for filtered transactions
  const filteredTotal = transactions.reduce((sum, t) => sum + t.subtotal, 0);
  const filteredAdvanceCollected = transactions.reduce((sum, t) => sum + t.advance, 0);
  const filteredAdvanceReturned = transactions
    .filter(t => t.status === 'advance_returned')
    .reduce((sum, t) => sum + t.advance, 0);
  const filteredActiveAdvance = transactions
    .filter(t => t.status === 'active')
    .reduce((sum, t) => sum + t.advance, 0);

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
                  <div className="space-y-3">
                    {prices.map(price => (
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

                  {/* Summary */}
                  <div className="bg-green-50 rounded-xl p-4">
                    <h3 className="font-medium text-green-800 mb-3">{getDateLabel()} Summary</h3>
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

                  {/* Status Filter */}
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

                  {/* Recent Transactions */}
                  <h3 className="font-medium text-gray-700 mt-6">Recent Transactions</h3>
                  {transactions.length === 0 ? (
                    <p className="text-gray-500 text-center py-10">No transactions found</p>
                  ) : (
                    <div className="space-y-3">
                      {transactions.slice(0, 20).map(transaction => (
                        <div key={transaction.id} className="bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-800">{transaction.customerName}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  transaction.status === 'active'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {transaction.status === 'active' ? 'Active' : 'Returned'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">+91 {transaction.customerPhone}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">₹{transaction.totalDue.toFixed(2)}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(transaction.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-sm text-gray-500">
                            <span>Cashier: {transaction.cashierName}</span>
                            <span>Advance: ₹{transaction.advance.toFixed(2)}</span>
                          </div>
                          {transaction.status === 'advance_returned' && transaction.advanceReturnedByName && (
                            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-orange-600">
                              Returned by {transaction.advanceReturnedByName} on {new Date(transaction.advanceReturnedAt!).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
