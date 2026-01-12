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
};

export default function ReturnAdvance() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [returning, setReturning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [returnedAmount, setReturnedAmount] = useState(0);

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

  const searchTransactions = async () => {
    if (!searchQuery.trim()) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/transactions?status=active&search=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error('Error searching transactions:', error);
    }
    setLoading(false);
  };

  // Search on enter or when search query changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 3) {
        searchTransactions();
      } else {
        setTransactions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleReturnAdvance = async () => {
    if (!selectedTransaction) return;

    setReturning(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: selectedTransaction.id }),
      });

      if (res.ok) {
        const data = await res.json();
        setReturnedAmount(data.advanceAmount);
        setShowConfirm(false);
        setShowSuccess(true);
        // Remove from list
        setTransactions(prev => prev.filter(t => t.id !== selectedTransaction.id));
        setSelectedTransaction(null);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error returning advance:', error);
      alert('Failed to return advance');
    }
    setReturning(false);
  };

  if (status === 'loading') {
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
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Subhash Garden" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-xl font-bold text-gray-800">Return Advance</span>
          </div>
        </header>

        {/* Search Section */}
        <div className="p-5">
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Search Customer</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Phone number, name, or receipt ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-10 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 mt-1">Enter at least 3 characters to search</p>
          </div>

          {/* Results */}
          {loading ? (
            <div className="text-center py-10 text-gray-500">Searching...</div>
          ) : transactions.length === 0 && searchQuery.length >= 3 ? (
            <div className="text-center py-10">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">No active transactions found</p>
              <p className="text-gray-400 text-sm">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map(transaction => (
                <div
                  key={transaction.id}
                  onClick={() => {
                    setSelectedTransaction(transaction);
                    setShowConfirm(true);
                  }}
                  className="bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)] cursor-pointer hover:shadow-[0_4px_15px_rgba(0,0,0,0.12)] transition-shadow border-2 border-transparent hover:border-green-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{transaction.customerName}</p>
                      <p className="text-sm text-gray-500">+91 {transaction.customerPhone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">₹{transaction.advance.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">Advance</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-100">
                    <span>Receipt: HC-{transaction.id.slice(-8).toUpperCase()}</span>
                    <span>{new Date(transaction.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Return Modal */}
      {showConfirm && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">Return Advance</h3>
                <p className="text-gray-500">Confirm advance return for this customer</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Customer</span>
                  <span className="font-medium text-gray-800">{selectedTransaction.customerName}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Phone</span>
                  <span className="font-medium text-gray-800">+91 {selectedTransaction.customerPhone}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Receipt</span>
                  <span className="font-medium text-gray-800">HC-{selectedTransaction.id.slice(-8).toUpperCase()}</span>
                </div>

                {/* Items to collect */}
                <div className="border-t border-gray-200 my-3"></div>
                <p className="text-sm font-medium text-gray-700 mb-2">Items to Collect:</p>
                <div className="space-y-1 text-sm">
                  {selectedTransaction.maleCostume > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Male Costume</span>
                      <span className="font-medium text-gray-800">{selectedTransaction.maleCostume}</span>
                    </div>
                  )}
                  {selectedTransaction.femaleCostume > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Female Costume</span>
                      <span className="font-medium text-gray-800">{selectedTransaction.femaleCostume}</span>
                    </div>
                  )}
                  {selectedTransaction.kidsCostume > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Kids Costume</span>
                      <span className="font-medium text-gray-800">{selectedTransaction.kidsCostume}</span>
                    </div>
                  )}
                  {selectedTransaction.tube > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tube</span>
                      <span className="font-medium text-gray-800">{selectedTransaction.tube}</span>
                    </div>
                  )}
                  {selectedTransaction.locker > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Locker</span>
                      <span className="font-medium text-gray-800">{selectedTransaction.locker}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 my-3"></div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-800 font-medium">Advance to Return</span>
                  <span className="text-2xl font-bold text-green-600">₹{selectedTransaction.advance.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirm(false);
                    setSelectedTransaction(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReturnAdvance}
                  disabled={returning}
                  className="flex-1 py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 cursor-pointer disabled:bg-gray-400"
                >
                  {returning ? 'Processing...' : 'Return Advance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full">
            <div className="p-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Advance Returned!</h3>
              <p className="text-gray-500 mb-4">Successfully returned advance to customer</p>
              <p className="text-3xl font-bold text-green-600 mb-6">₹{returnedAmount.toFixed(2)}</p>
              <button
                type="button"
                onClick={() => {
                  setShowSuccess(false);
                  setSearchQuery('');
                }}
                className="w-full py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
