'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import type { ItemType, ItemReturnEntry, ReturnDetails } from '@/lib/schema';

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
  isComplimentary: boolean;
};

type ItemReturnState = {
  lost: number;
};

const ITEM_CONFIG: { type: ItemType; label: string; field: keyof Transaction; priceKey: string }[] = [
  { type: 'maleCostume', label: 'Male Costume', field: 'maleCostume', priceKey: 'male_costume' },
  { type: 'femaleCostume', label: 'Female Costume', field: 'femaleCostume', priceKey: 'female_costume' },
  { type: 'kidsCostume', label: 'Kids Costume', field: 'kidsCostume', priceKey: 'kids_costume' },
  { type: 'tube', label: 'Tube', field: 'tube', priceKey: 'tube' },
  { type: 'locker', label: 'Locker', field: 'locker', priceKey: 'locker' },
];

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
  const [totalDeductionReturned, setTotalDeductionReturned] = useState(0);
  const [wasVIPTransaction, setWasVIPTransaction] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Item return tracking state - simplified to just track lost items
  const [itemReturns, setItemReturns] = useState<Record<ItemType, ItemReturnState>>({
    maleCostume: { lost: 0 },
    femaleCostume: { lost: 0 },
    kidsCostume: { lost: 0 },
    tube: { lost: 0 },
    locker: { lost: 0 },
  });
  const [deductionNotes, setDeductionNotes] = useState('');

  // Fetch prices on mount
  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch('/api/prices');
        if (res.ok) {
          const data = await res.json();
          const priceMap: Record<string, number> = {};
          data.forEach((item: { itemKey: string; price: number }) => {
            priceMap[item.itemKey] = item.price;
          });
          setPrices(priceMap);
        }
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
    }
    fetchPrices();
  }, []);

  // Initialize item returns when transaction is selected
  useEffect(() => {
    if (selectedTransaction) {
      const initialState: Record<ItemType, ItemReturnState> = {
        maleCostume: { lost: 0 },
        femaleCostume: { lost: 0 },
        kidsCostume: { lost: 0 },
        tube: { lost: 0 },
        locker: { lost: 0 },
      };
      setItemReturns(initialState);
      setDeductionNotes('');
    }
  }, [selectedTransaction]);

  // Calculate total deduction based on lost items × item price
  const totalDeduction = useMemo(() => {
    let total = 0;
    ITEM_CONFIG.forEach(({ type, priceKey }) => {
      const lost = itemReturns[type].lost;
      const price = prices[priceKey] || 0;
      total += lost * price;
    });
    return total;
  }, [itemReturns, prices]);

  // Calculate amount to return
  const amountToReturn = useMemo(() => {
    if (!selectedTransaction) return 0;
    return Math.max(0, selectedTransaction.advance - totalDeduction);
  }, [selectedTransaction, totalDeduction]);

  // Validation: check lost doesn't exceed given
  const validationErrors = useMemo(() => {
    if (!selectedTransaction) return [];
    const errors: string[] = [];

    ITEM_CONFIG.forEach(({ type, label, field }) => {
      const given = selectedTransaction[field] as number;
      if (given === 0) return;

      const lost = itemReturns[type].lost;
      if (lost > given) {
        errors.push(`${label}: Lost (${lost}) cannot exceed given (${given})`);
      }
    });

    return errors;
  }, [selectedTransaction, itemReturns]);

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
    if (!selectedTransaction || validationErrors.length > 0) return;

    setReturning(true);
    try {
      // Build return details (same deduction logic for VIP and regular)
      const items: ItemReturnEntry[] = ITEM_CONFIG
        .filter(({ field }) => (selectedTransaction[field] as number) > 0)
        .map(({ type, field, priceKey }) => {
          const given = selectedTransaction[field] as number;
          const lost = itemReturns[type].lost;
          const returned = given - lost;
          const price = prices[priceKey] || 0;
          return {
            type,
            rented: given,
            returnedGood: returned,
            returnedDamaged: 0,
            lost,
            deduction: lost * price,
          };
        });

      const returnDetails: ReturnDetails = {
        items,
        totalDeduction,
        notes: deductionNotes || undefined,
      };

      const res = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: selectedTransaction.id, returnDetails }),
      });

      if (res.ok) {
        const data = await res.json();
        setReturnedAmount(data.actualAmountReturned);
        setTotalDeductionReturned(data.totalDeduction);
        setWasVIPTransaction(selectedTransaction.isComplimentary);
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

  const updateLostCount = (type: ItemType, value: number) => {
    setItemReturns(prev => ({
      ...prev,
      [type]: { lost: value },
    }));
  };

  // Generate options for dropdown (0 to max)
  const generateOptions = (max: number) => {
    return Array.from({ length: max + 1 }, (_, i) => i);
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
                  className={`bg-white rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)] cursor-pointer hover:shadow-[0_4px_15px_rgba(0,0,0,0.12)] transition-shadow border-2 border-transparent ${
                    transaction.isComplimentary ? 'hover:border-purple-200' : 'hover:border-green-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">{transaction.customerName}</p>
                        {transaction.isComplimentary && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">VIP</span>
                        )}
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
                          <p className="font-semibold text-green-600">₹{transaction.advance.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">Advance</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-100">
                    <span>Receipt: HC-{transaction.id.slice(-8).toUpperCase()}</span>
                    <span>{new Date(transaction.createdAt + '+05:30').toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}</span>
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
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 ${selectedTransaction.isComplimentary ? 'bg-purple-100' : 'bg-orange-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  {selectedTransaction.isComplimentary ? (
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h3 className="text-xl font-bold text-gray-800">
                    {selectedTransaction.isComplimentary ? 'Collect Items' : 'Return Advance'}
                  </h3>
                  {selectedTransaction.isComplimentary && (
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">VIP</span>
                  )}
                </div>
                <p className="text-gray-500">
                  {selectedTransaction.isComplimentary
                    ? 'Mark any lost items for VIP checkout'
                    : 'Mark any lost items to calculate deduction'}
                </p>
              </div>

              {/* Customer Info */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Customer</span>
                  <span className="font-medium text-gray-800">{selectedTransaction.customerName}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Phone</span>
                  <span className="font-medium text-gray-800">+91 {selectedTransaction.customerPhone}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Receipt</span>
                  <span className="font-medium text-gray-800">HC-{selectedTransaction.id.slice(-8).toUpperCase()}</span>
                </div>
              </div>

              {/* Item Selection */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Items to Collect:</p>
                <div className="space-y-3">
                  {ITEM_CONFIG.map(({ type, label, field, priceKey }) => {
                    const given = selectedTransaction[field] as number;
                    if (given === 0) return null;

                    const lost = itemReturns[type].lost;
                    const price = prices[priceKey] || 0;
                    const deduction = lost * price;

                    return (
                      <div key={type} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <span className="font-medium text-gray-800">{label}</span>
                            <p className="text-xs text-gray-500">₹{price} each</p>
                          </div>
                          <div className="flex items-center gap-4">
                            {/* Given (read-only) */}
                            <div className="text-center">
                              <p className="text-xs text-gray-500 mb-1">Given</p>
                              <div className="w-12 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="font-semibold text-blue-700">{given}</span>
                              </div>
                            </div>
                            {/* Lost (dropdown) */}
                            <div className="text-center">
                              <p className="text-xs text-red-600 mb-1">Lost</p>
                              <select
                                value={lost}
                                onChange={(e) => updateLostCount(type, parseInt(e.target.value))}
                                className="w-14 h-9 px-2 border border-gray-200 rounded-lg text-sm text-gray-900 font-medium text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                              >
                                {generateOptions(given).map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                        {/* Auto-calculated deduction - same for VIP and regular */}
                        {lost > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                            <span className="text-xs text-gray-600">Deduction ({lost} × ₹{price})</span>
                            <span className="text-sm font-medium text-red-600">₹{deduction.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Notes */}
              <div className="mb-4">
                <label className="block text-xs text-gray-600 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={deductionNotes}
                  onChange={(e) => setDeductionNotes(e.target.value)}
                  placeholder="e.g., Costume torn at sleeve"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm font-medium text-red-800 mb-1">Please fix the following:</p>
                  <ul className="list-disc list-inside text-xs text-red-600 space-y-1">
                    {validationErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary */}
              {selectedTransaction.isComplimentary ? (
                <div className="bg-purple-50 rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Transaction Type</span>
                    <span className="font-medium text-purple-700">VIP</span>
                  </div>
                  {selectedTransaction.advance > 0 && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Advance Collected</span>
                      <span className="font-medium text-gray-800">₹{selectedTransaction.advance.toFixed(2)}</span>
                    </div>
                  )}
                  {totalDeduction > 0 && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-red-600">Total Deduction</span>
                      <span className="font-medium text-red-600">-₹{totalDeduction.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-purple-200 mt-2 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800 font-medium">Amount to Return</span>
                      <span className="text-2xl font-bold text-purple-600">₹{amountToReturn.toFixed(2)}</span>
                    </div>
                    {selectedTransaction.advance === 0 && totalDeduction === 0 && (
                      <p className="text-xs text-purple-500 mt-1">No payment required for VIP guests</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Original Advance</span>
                    <span className="font-medium text-gray-800">₹{selectedTransaction.advance.toFixed(2)}</span>
                  </div>
                  {totalDeduction > 0 && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-red-600">Total Deduction</span>
                      <span className="font-medium text-red-600">-₹{totalDeduction.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-green-200 mt-2 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800 font-medium">Amount to Return</span>
                      <span className="text-2xl font-bold text-green-600">₹{amountToReturn.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

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
                  disabled={returning || validationErrors.length > 0}
                  className={`flex-1 py-3 text-white font-semibold rounded-xl cursor-pointer disabled:bg-gray-400 ${
                    selectedTransaction.isComplimentary
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-green-700 hover:bg-green-800'
                  }`}
                >
                  {returning ? 'Processing...' : selectedTransaction.isComplimentary
                  ? (amountToReturn > 0 ? `Return ₹${amountToReturn.toFixed(0)} (VIP)` : 'Complete (VIP)')
                  : 'Return Advance'}
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
              {wasVIPTransaction ? (
                // VIP Success
                <>
                  <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">VIP Checkout Complete!</h3>
                  <p className="text-gray-500 mb-4">Items collected from VIP guest</p>
                  {totalDeductionReturned > 0 && (
                    <div className="bg-orange-50 rounded-lg p-3 mb-4 text-left">
                      <p className="text-sm text-orange-800">
                        Deduction applied: <span className="font-semibold">₹{totalDeductionReturned.toFixed(2)}</span>
                      </p>
                    </div>
                  )}
                  {returnedAmount > 0 || totalDeductionReturned > 0 ? (
                    <p className="text-3xl font-bold text-purple-600 mb-6">₹{returnedAmount.toFixed(2)}</p>
                  ) : (
                    <div className="bg-purple-50 rounded-lg p-3 mb-6">
                      <p className="text-sm text-purple-700">No payment required</p>
                    </div>
                  )}
                </>
              ) : (
                // Regular Success
                <>
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Advance Returned!</h3>
                  <p className="text-gray-500 mb-4">Successfully returned advance to customer</p>

                  {totalDeductionReturned > 0 && (
                    <div className="bg-orange-50 rounded-lg p-3 mb-4 text-left">
                      <p className="text-sm text-orange-800">
                        Deduction applied: <span className="font-semibold">₹{totalDeductionReturned.toFixed(2)}</span>
                      </p>
                    </div>
                  )}

                  <p className="text-3xl font-bold text-green-600 mb-6">₹{returnedAmount.toFixed(2)}</p>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSuccess(false);
                  setSearchQuery('');
                  setTotalDeductionReturned(0);
                  setWasVIPTransaction(false);
                }}
                className={`w-full py-3 text-white font-semibold rounded-xl cursor-pointer ${
                  wasVIPTransaction
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-green-700 hover:bg-green-800'
                }`}
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
