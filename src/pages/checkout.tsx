'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

type PriceItem = {
  id: string;
  itemKey: string;
  itemName: string;
  price: number;
};

type ReceiptData = {
  id: string;
  timestamp: string;
  customerName: string;
  customerPhone: string;
  cashierName: string;
  lineItems: { label: string; qty: number; price: number }[];
  subtotal: number;
  advance: number;
  totalDue: number;
};

export default function Checkout() {
  const router = useRouter();
  const { data: session } = useSession();
  const [advance, setAdvance] = useState(0);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState({
    name: '',
    phone: '',
    maleCostume: 0,
    femaleCostume: 0,
    kidsCostume: 0,
    tube: 0,
    locker: 0,
  });

  // Fetch prices from API
  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch('/api/prices');
        if (res.ok) {
          const data: PriceItem[] = await res.json();
          const priceMap: Record<string, number> = {};
          data.forEach(item => {
            priceMap[item.itemKey] = item.price;
          });
          setPrices(priceMap);
        }
      } catch (error) {
        console.error('Error fetching prices:', error);
      }
      setLoading(false);
    }
    fetchPrices();
  }, []);

  // Parse items from URL
  useEffect(() => {
    if (router.isReady && Object.keys(prices).length > 0) {
      const { name, phone, male, female, kids, tube, locker } = router.query;
      const parsedItems = {
        name: (name as string) || '',
        phone: (phone as string) || '',
        maleCostume: parseInt(male as string) || 0,
        femaleCostume: parseInt(female as string) || 0,
        kidsCostume: parseInt(kids as string) || 0,
        tube: parseInt(tube as string) || 0,
        locker: parseInt(locker as string) || 0,
      };
      setItems(parsedItems);

      // Calculate subtotal and set as default advance
      const subtotal =
        parsedItems.maleCostume * (prices.male_costume || 0) +
        parsedItems.femaleCostume * (prices.female_costume || 0) +
        parsedItems.kidsCostume * (prices.kids_costume || 0) +
        parsedItems.tube * (prices.tube || 0) +
        parsedItems.locker * (prices.locker || 0);
      setAdvance(subtotal);
    }
  }, [router.isReady, router.query, prices]);

  const subtotal =
    items.maleCostume * (prices.male_costume || 0) +
    items.femaleCostume * (prices.female_costume || 0) +
    items.kidsCostume * (prices.kids_costume || 0) +
    items.tube * (prices.tube || 0) +
    items.locker * (prices.locker || 0);

  const totalDue = subtotal + advance;

  // Build line items array for display
  const lineItems: { label: string; qty: number; price: number }[] = [];
  if (items.maleCostume > 0) {
    lineItems.push({
      label: 'Male Costume',
      qty: items.maleCostume,
      price: items.maleCostume * (prices.male_costume || 0),
    });
  }
  if (items.femaleCostume > 0) {
    lineItems.push({
      label: 'Female Costume',
      qty: items.femaleCostume,
      price: items.femaleCostume * (prices.female_costume || 0),
    });
  }
  if (items.kidsCostume > 0) {
    lineItems.push({
      label: 'Kids Costume',
      qty: items.kidsCostume,
      price: items.kidsCostume * (prices.kids_costume || 0),
    });
  }
  if (items.tube > 0) {
    lineItems.push({
      label: 'Tube',
      qty: items.tube,
      price: items.tube * (prices.tube || 0),
    });
  }
  if (items.locker > 0) {
    lineItems.push({
      label: 'Locker',
      qty: items.locker,
      price: items.locker * (prices.locker || 0),
    });
  }

  const handlePay = async () => {
    if (!session?.user) {
      alert('Please login to complete the transaction');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: items.name,
          customerPhone: items.phone,
          maleCostume: items.maleCostume,
          femaleCostume: items.femaleCostume,
          kidsCostume: items.kidsCostume,
          tube: items.tube,
          locker: items.locker,
          subtotal,
          advance,
          totalDue,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Show receipt modal
        setReceiptData({
          id: data.transaction.id.slice(-8).toUpperCase(),
          timestamp: new Date().toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          customerName: items.name,
          customerPhone: items.phone,
          cashierName: session.user.name || 'Unknown',
          lineItems,
          subtotal,
          advance,
          totalDue,
        });
        setShowReceipt(true);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to save transaction'}`);
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction');
    }
    setSaving(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDone = () => {
    setShowReceipt(false);
    router.push('/');
  };

  if (loading) {
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
        <header className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 print:hidden">
          <button
            type="button"
            onClick={() => router.push(`/?name=${encodeURIComponent(items.name)}&phone=${encodeURIComponent(items.phone)}&male=${items.maleCostume}&female=${items.femaleCostume}&kids=${items.kidsCostume}&tube=${items.tube}&locker=${items.locker}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>
          <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
          </svg>
          <span className="text-xl font-bold text-gray-800">Subhash Garden</span>
        </header>

        {/* Content */}
        <main className="p-5 pb-32 print:hidden">
          {/* Success Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">Checkout</h1>
          <p className="text-gray-500 text-center mb-2">Please review your charges</p>
          {session?.user?.name && (
            <p className="text-gray-700 text-center text-lg mb-6">
              Cashier: <span className="font-bold text-gray-900">{session.user.name}</span>
            </p>
          )}

          {/* Customer Info Card */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] mb-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Customer Name</span>
              <span className="text-gray-900 font-medium">{items.name}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600">Phone Number</span>
              <span className="text-gray-900 font-medium">+91 {items.phone}</span>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] mb-4">
            {lineItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <span className="text-gray-700">{item.label} x{item.qty}</span>
                <span className="text-gray-800 font-medium">₹{item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Subtotal */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] mb-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-800 font-medium">Subtotal</span>
              <span className="text-gray-800 font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Advance Card */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-800 font-medium">Advance</span>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setAdvance(Math.max(0, advance - 50))}
                  className="w-10 h-8 bg-gray-200 text-gray-600 rounded-l flex items-center justify-center cursor-pointer hover:bg-gray-300"
                >
                  −
                </button>
                <div className="h-8 px-3 bg-gray-100 flex items-center justify-center text-gray-800 font-medium min-w-[80px]">
                  {advance.toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => setAdvance(advance + 50)}
                  className="w-10 h-8 bg-green-600 text-white rounded-r flex items-center justify-center cursor-pointer hover:bg-green-700"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-gray-500">Total Due</span>
              <span className="text-green-600 font-semibold text-lg">₹{totalDue.toFixed(2)}</span>
            </div>
          </div>
        </main>

        {/* Pay Button */}
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 max-w-md mx-auto print:hidden">
          <button
            type="button"
            onClick={handlePay}
            disabled={saving}
            className="w-full py-4 bg-green-700 text-white text-lg font-semibold rounded-xl hover:bg-green-800 active:bg-green-900 cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Processing...' : `Pay ₹${totalDue.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:bg-white print:p-0">
          <div
            ref={receiptRef}
            className="bg-white rounded-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:rounded-none print:shadow-none"
          >
            {/* Receipt Content */}
            <div className="p-6 font-mono text-sm">
              {/* Header */}
              <div className="text-center mb-4">
                <div className="text-2xl mb-1">🏊</div>
                <h2 className="text-xl font-bold text-gray-800">Subhash Garden</h2>
                <div className="w-full border-b-2 border-dashed border-gray-300 my-3"></div>
              </div>

              {/* Receipt Info */}
              <div className="space-y-1 text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{receiptData.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span>Receipt #:</span>
                  <span>HC-{receiptData.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{receiptData.cashierName}</span>
                </div>
              </div>

              <div className="w-full border-b-2 border-dashed border-gray-300 my-3"></div>

              {/* Customer Info */}
              <div className="space-y-1 text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{receiptData.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span>+91 {receiptData.customerPhone}</span>
                </div>
              </div>

              <div className="w-full border-b-2 border-dashed border-gray-300 my-3"></div>

              {/* Line Items */}
              <div className="space-y-2 mb-4">
                {receiptData.lineItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-gray-700">
                    <span>{item.label} x{item.qty}</span>
                    <span>₹{item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="w-full border-b-2 border-dashed border-gray-300 my-3"></div>

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{receiptData.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Advance Paid</span>
                  <span>₹{receiptData.advance.toFixed(2)}</span>
                </div>
                <div className="w-full border-b border-gray-300 my-2"></div>
                <div className="flex justify-between text-lg font-bold text-gray-800">
                  <span>TOTAL DUE</span>
                  <span>₹{receiptData.totalDue.toFixed(2)}</span>
                </div>
              </div>

              <div className="w-full border-b-2 border-dashed border-gray-300 my-4"></div>

              {/* Payment Status */}
              <div className="text-center py-3 bg-green-50 rounded-lg mb-4">
                <div className="flex items-center justify-center gap-2 text-green-700 font-semibold">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  PAYMENT RECEIVED
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-gray-500 text-xs">
                <p>Thank you for visiting!</p>
                <p className="mt-1">Have a great swim!</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-100 flex gap-3 print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                type="button"
                onClick={handleDone}
                className="flex-1 py-3 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 cursor-pointer"
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
