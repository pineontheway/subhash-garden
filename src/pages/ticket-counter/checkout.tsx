'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { QRCodeSVG } from 'qrcode.react';

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
  vehicleNumber?: string;
  tagNumbers?: string[];
  cashierName: string;
  lineItems: { label: string; qty: number; price: number }[];
  total: number;
  paymentMethod: 'upi' | 'cash' | 'split';
  isVIP?: boolean;
};

export default function TicketCheckout() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [upiSettings, setUpiSettings] = useState<{ upi_id?: string; business_name?: string; tickets_upi_id?: string; tickets_business_name?: string }>({});
  const [isAndroidWebView, setIsAndroidWebView] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState({
    name: '',
    phone: '',
    vehicleNumber: '',
    tagNumbers: '',
    menTicket: 0,
    womenTicket: 0,
    childTicket: 0,
  });
  const [isVIP, setIsVIP] = useState(false);

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash' | 'split'>('upi');
  const [splitUpi, setSplitUpi] = useState(0);
  const [splitCash, setSplitCash] = useState(0);

  // Detect Android WebView on mount
  useEffect(() => {
    if ((window as any).Android?.print) {
      setIsAndroidWebView(true);
    }
  }, []);

  // Check user role and counter selection
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (!session.user.role) {
        router.push('/access-denied');
        return;
      }
      if (session.user.role === 'cashier') {
        const counterType = sessionStorage.getItem('counterType');
        if (!counterType) {
          router.push('/select-counter');
        } else if (counterType !== 'ticket') {
          router.push('/');
        }
      }
    } else if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, session, router]);

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

  // Fetch UPI settings
  useEffect(() => {
    async function fetchUpiSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setUpiSettings(data);
        }
      } catch (error) {
        console.error('Error fetching UPI settings:', error);
      }
    }
    fetchUpiSettings();
  }, []);

  // Parse items from URL
  useEffect(() => {
    if (router.isReady && Object.keys(prices).length > 0) {
      const { name, phone, vehicle, tags, men, women, child } = router.query;
      const parsedItems = {
        name: (name as string) || '',
        phone: (phone as string) || '',
        vehicleNumber: (vehicle as string) || '',
        tagNumbers: (tags as string) || '',
        menTicket: parseInt(men as string) || 0,
        womenTicket: parseInt(women as string) || 0,
        childTicket: parseInt(child as string) || 0,
      };
      setItems(parsedItems);
    }
  }, [router.isReady, router.query, prices]);

  const subtotal =
    items.menTicket * (prices.men_ticket || 0) +
    items.womenTicket * (prices.women_ticket || 0) +
    items.childTicket * (prices.child_ticket || 0);

  const totalDue = isVIP ? 0 : subtotal;

  // Build line items array for display
  const lineItems: { label: string; qty: number; price: number }[] = [];
  if (items.menTicket > 0) {
    lineItems.push({
      label: 'Men Ticket',
      qty: items.menTicket,
      price: items.menTicket * (prices.men_ticket || 0),
    });
  }
  if (items.womenTicket > 0) {
    lineItems.push({
      label: 'Women Ticket',
      qty: items.womenTicket,
      price: items.womenTicket * (prices.women_ticket || 0),
    });
  }
  if (items.childTicket > 0) {
    lineItems.push({
      label: 'Child Ticket',
      qty: items.childTicket,
      price: items.childTicket * (prices.child_ticket || 0),
    });
  }

  // Generate UPI URI for QR code (uses tickets-specific UPI settings)
  const generateUpiUri = (amount: number) => {
    const pa = upiSettings.tickets_upi_id || upiSettings.upi_id || '';
    const pn = encodeURIComponent(upiSettings.tickets_business_name || upiSettings.business_name || 'Subhash Garden');
    const am = amount.toFixed(2);
    const tn = encodeURIComponent(`Entry Ticket - ${items.name}`);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
  };

  const handlePay = async () => {
    if (!session?.user) {
      alert('Please login to complete the transaction');
      return;
    }

    if (isVIP) {
      // VIP - complete directly
      await saveTransaction('cash');
      return;
    }

    // Validate split amounts
    if (paymentMethod === 'split') {
      if (splitUpi + splitCash !== totalDue) {
        alert(`Split amounts (₹${splitUpi + splitCash}) must equal total (₹${totalDue})`);
        return;
      }
    }

    // Handle payment method
    if (paymentMethod === 'cash') {
      await saveTransaction('cash');
    } else if (paymentMethod === 'upi') {
      if ((upiSettings.tickets_upi_id || upiSettings.upi_id) && totalDue > 0) {
        setShowQRModal(true);
      } else {
        await saveTransaction('upi');
      }
    } else if (paymentMethod === 'split') {
      if (splitUpi > 0 && (upiSettings.tickets_upi_id || upiSettings.upi_id)) {
        setShowQRModal(true);
      } else {
        await saveTransaction('split');
      }
    }
  };

  const saveTransaction = async (method: 'upi' | 'cash' | 'split') => {
    setSaving(true);
    try {
      const res = await fetch('/api/ticket-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: items.name,
          customerPhone: items.phone,
          vehicleNumber: items.vehicleNumber || null,
          tagNumbers: items.tagNumbers || null,
          menTicket: items.menTicket,
          womenTicket: items.womenTicket,
          childTicket: items.childTicket,
          subtotal,
          totalDue,
          paymentMethod: method,
          isComplimentary: isVIP,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Show receipt modal
        setReceiptData({
          id: data.transaction.id.slice(-8).toUpperCase(),
          timestamp: new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          customerName: items.name,
          customerPhone: items.phone,
          vehicleNumber: items.vehicleNumber,
          tagNumbers: items.tagNumbers ? items.tagNumbers.split(',').map(t => t.trim()) : undefined,
          cashierName: session?.user?.name || 'Unknown',
          lineItems,
          total: totalDue,
          paymentMethod: method,
          isVIP,
        });
        setShowQRModal(false);
        setShowReceipt(true);

        // Increment the next tag number in sessionStorage
        if (items.tagNumbers) {
          const tags = items.tagNumbers.split(',').map(t => t.trim());
          const lastTag = tags[tags.length - 1];
          const nextTag = (parseInt(lastTag, 10) + 1).toString().padStart(6, '0');
          sessionStorage.setItem('nextTagNumber', nextTag);
        }
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
    if (isAndroidWebView && receiptData) {
      // Format receipt for 80mm thermal printer (48 chars per line)
      const W = 48;
      const divider = '-'.repeat(W);
      const blackBar = '█'.repeat(W);
      const fmt = (label: string, value: string) => `${label}${value.padStart(W - label.length)}`;
      const lines: string[] = [];

      lines.push('<center><big>Subhash Garden</big></center>');
      lines.push('<center>Entry Ticket</center>');
      lines.push('');
      lines.push(blackBar);
      lines.push(`Cashier: ${receiptData.cashierName}`);
      lines.push(`Receipt #: TKT-${receiptData.id}`);
      lines.push(`Date: ${receiptData.timestamp}`);
      lines.push(blackBar);
      lines.push('');
      lines.push(`Customer: ${receiptData.customerName}`);
      lines.push(`Phone: +91 ${receiptData.customerPhone}`);
      if (receiptData.vehicleNumber) {
        lines.push(`Vehicle: ${receiptData.vehicleNumber}`);
      }
      if (receiptData.tagNumbers && receiptData.tagNumbers.length > 0) {
        lines.push(`Tags: ${receiptData.tagNumbers.join(', ')}`);
      }
      lines.push(divider);
      lines.push('');

      // Line items
      receiptData.lineItems.forEach(item => {
        const itemLine = `${item.label} x${item.qty}`;
        const priceLine = `Rs.${item.price.toFixed(2)}`;
        lines.push(`${itemLine.padEnd(W - priceLine.length)}${priceLine}`);
      });

      lines.push(divider);
      const totalText = receiptData.isVIP ? 'FREE (VIP)' : `Rs.${receiptData.total.toFixed(2)}`;
      lines.push(`<b>${fmt('TOTAL PAID:', totalText)}</b>`);
      lines.push('');
      lines.push(divider);
      const status = receiptData.isVIP ? 'VIP - COMPLIMENTARY' : 'PAYMENT RECEIVED';
      lines.push(`<center><b>${status}</b></center>`);
      if (!receiptData.isVIP) {
        lines.push(`<center>Paid via ${receiptData.paymentMethod.toUpperCase()}</center>`);
      }
      lines.push(divider);
      lines.push('');
      lines.push('<center>Thank you for visiting!</center>');
      lines.push('<center>Have a great time!</center>');
      lines.push('');

      (window as any).Android.print(lines.join('\n'));
    }
  };

  const handleDone = () => {
    setShowReceipt(false);
    router.push('/ticket-counter');
  };

  const handleBack = () => {
    const params = new URLSearchParams({
      name: items.name,
      phone: items.phone,
      men: items.menTicket.toString(),
      women: items.womenTicket.toString(),
      child: items.childTicket.toString(),
    });
    if (items.vehicleNumber) {
      params.set('vehicle', items.vehicleNumber);
    }
    if (items.tagNumbers) {
      params.set('tags', items.tagNumbers);
    }
    router.push(`/ticket-counter?${params.toString()}`);
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
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>
          <img src="/logo.png" alt="Subhash Garden" className="w-8 h-8 rounded-full object-cover" />
          <span className="text-xl font-bold text-gray-800">Subhash Garden</span>
        </header>

        {/* Content */}
        <main className="p-5 pb-32 print:hidden">
          {/* Success Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">Ticket Checkout</h1>
          <p className="text-gray-500 text-center mb-2">Please review the ticket details</p>
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
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Phone Number</span>
              <span className="text-gray-900 font-medium">+91 {items.phone}</span>
            </div>
            {items.vehicleNumber && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Vehicle Number</span>
                <span className="text-gray-900 font-medium">{items.vehicleNumber}</span>
              </div>
            )}
            {items.tagNumbers && (
              <div className="py-2">
                <span className="text-gray-600 block mb-1">Tag Numbers</span>
                <div className="flex flex-wrap gap-2">
                  {items.tagNumbers.split(',').map((tag, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-lg text-sm font-medium">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* VIP Toggle */}
          <div className="bg-purple-50 rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] mb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-purple-800 font-medium">VIP / Complimentary</span>
                <p className="text-purple-600 text-xs mt-0.5">Free entry for special guests</p>
              </div>
              <button
                type="button"
                onClick={() => setIsVIP(!isVIP)}
                className={`relative w-14 h-8 rounded-full transition-colors cursor-pointer ${
                  isVIP ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    isVIP ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] mb-4">
            {lineItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <span className="text-gray-700">{item.label} x{item.qty}</span>
                <span className={`font-medium ${isVIP ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  ₹{item.price.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Total Card */}
          <div className={`rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] ${isVIP ? 'bg-purple-50' : 'bg-blue-50'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-lg font-medium ${isVIP ? 'text-purple-800' : 'text-blue-800'}`}>
                Total Amount
              </span>
              <span className={`text-2xl font-bold ${isVIP ? 'text-purple-600' : 'text-blue-600'}`}>
                {isVIP ? (
                  <>
                    <span className="line-through text-gray-400 text-lg mr-2">₹{subtotal.toFixed(2)}</span>
                    <span>FREE</span>
                  </>
                ) : (
                  `₹${totalDue.toFixed(2)}`
                )}
              </span>
            </div>
          </div>

          {/* Payment Method Selection - Hidden for VIP */}
          {!isVIP && (
            <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] mt-4">
              <span className="text-gray-800 font-medium block mb-3">Payment Method</span>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('upi');
                    setSplitUpi(0);
                    setSplitCash(0);
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors cursor-pointer ${
                    paymentMethod === 'upi'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  UPI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('cash');
                    setSplitUpi(0);
                    setSplitCash(0);
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('split');
                    setSplitUpi(Math.floor(totalDue / 2));
                    setSplitCash(totalDue - Math.floor(totalDue / 2));
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors cursor-pointer ${
                    paymentMethod === 'split'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Split
                </button>
              </div>

              {/* Split Payment Inputs */}
              {paymentMethod === 'split' && (
                <div className="bg-purple-50 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-gray-700 w-16">UPI</label>
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="number"
                        value={splitUpi || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSplitUpi(val);
                          setSplitCash(Math.max(0, totalDue - val));
                        }}
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-gray-700 w-16">Cash</label>
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="number"
                        value={splitCash || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSplitCash(val);
                          setSplitUpi(Math.max(0, totalDue - val));
                        }}
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-purple-200">
                    <span className="text-purple-700">Total</span>
                    <span className={`font-medium ${
                      splitUpi + splitCash === totalDue
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      ₹{(splitUpi + splitCash).toFixed(2)} / ₹{totalDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Payment Button */}
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 max-w-md mx-auto print:hidden">
          <button
            type="button"
            onClick={handlePay}
            disabled={saving}
            className={`w-full py-4 text-white text-lg font-semibold rounded-xl cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed ${
              isVIP
                ? 'bg-purple-600 hover:bg-purple-700'
                : paymentMethod === 'split'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : paymentMethod === 'cash'
                    ? 'bg-green-700 hover:bg-green-800'
                    : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {saving ? 'Processing...' : isVIP
              ? 'Complete (VIP Entry)'
              : `Pay ₹${totalDue.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* UPI QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden">
            {/* Modal Header */}
            <div className={`p-5 text-center ${paymentMethod === 'split' ? 'bg-purple-50' : 'bg-blue-50'}`}>
              <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${paymentMethod === 'split' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                <svg className={`w-6 h-6 ${paymentMethod === 'split' ? 'text-purple-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className={`text-xl font-bold ${paymentMethod === 'split' ? 'text-purple-800' : 'text-blue-800'}`}>
                {paymentMethod === 'split' ? 'Scan for UPI Portion' : 'Scan to Pay'}
              </h2>
              <p className="text-gray-600 text-sm mt-1">Ask customer to scan with any UPI app</p>
            </div>

            {/* QR Code */}
            <div className="p-6">
              <div className="bg-white border-2 border-gray-100 rounded-xl p-4 flex justify-center">
                <QRCodeSVG
                  value={generateUpiUri(paymentMethod === 'split' ? splitUpi : totalDue)}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Amount Display */}
              <div className={`mt-4 p-4 rounded-xl text-center ${paymentMethod === 'split' ? 'bg-purple-50' : 'bg-blue-50'}`}>
                <p className="text-gray-600 text-sm">
                  {paymentMethod === 'split' ? 'UPI Amount' : 'Amount to Pay'}
                </p>
                <p className={`text-3xl font-bold ${paymentMethod === 'split' ? 'text-purple-600' : 'text-blue-600'}`}>
                  ₹{(paymentMethod === 'split' ? splitUpi : totalDue).toFixed(2)}
                </p>
                {paymentMethod === 'split' && (
                  <p className="text-gray-500 text-sm mt-2">
                    + ₹{splitCash.toFixed(2)} Cash
                  </p>
                )}
              </div>

              {/* UPI ID Display */}
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Or pay manually to</p>
                <p className="text-sm font-medium text-gray-800 bg-gray-100 px-3 py-2 rounded-lg inline-block">
                  {upiSettings.tickets_upi_id || upiSettings.upi_id}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveTransaction(paymentMethod)}
                disabled={saving}
                className={`flex-1 py-3 text-white font-semibold rounded-xl cursor-pointer disabled:bg-gray-400 ${
                  paymentMethod === 'split' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? 'Processing...' : 'Payment Received'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <div className="text-2xl mb-1">🎫</div>
                <div className="flex items-center justify-center gap-2">
                  <img src="/logo.png" alt="Subhash Garden" className="w-8 h-8 rounded-full object-cover" />
                  <h2 className="text-xl font-bold text-gray-800">Subhash Garden</h2>
                </div>
                <p className="text-gray-500 text-xs">Entry Ticket</p>
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
                  <span>TKT-{receiptData.id}</span>
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
                {receiptData.vehicleNumber && (
                  <div className="flex justify-between">
                    <span>Vehicle:</span>
                    <span>{receiptData.vehicleNumber}</span>
                  </div>
                )}
                {receiptData.tagNumbers && receiptData.tagNumbers.length > 0 && (
                  <div className="pt-1">
                    <span className="block mb-1">Tag Numbers:</span>
                    <span className="font-medium text-gray-800">{receiptData.tagNumbers.join(', ')}</span>
                  </div>
                )}
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

              {/* Total */}
              <div className="flex justify-between text-lg font-bold text-gray-800">
                <span>TOTAL PAID</span>
                <span>{receiptData.isVIP ? 'FREE (VIP)' : `₹${receiptData.total.toFixed(2)}`}</span>
              </div>

              <div className="w-full border-b-2 border-dashed border-gray-300 my-4"></div>

              {/* Payment Status */}
              <div className={`text-center py-3 rounded-lg mb-4 ${receiptData.isVIP ? 'bg-purple-50' : 'bg-blue-50'}`}>
                <div className={`flex items-center justify-center gap-2 font-semibold ${receiptData.isVIP ? 'text-purple-700' : 'text-blue-700'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {receiptData.isVIP ? 'VIP - COMPLIMENTARY' : 'PAYMENT RECEIVED'}
                </div>
                {!receiptData.isVIP && (
                  <p className="text-xs text-gray-500 mt-1">
                    Paid via {receiptData.paymentMethod.toUpperCase()}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="text-center text-gray-500 text-xs">
                <p>Thank you for visiting!</p>
                <p className="mt-1">Have a great time!</p>
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
                className="flex-1 py-3 bg-blue-700 text-white font-semibold rounded-xl hover:bg-blue-800 cursor-pointer"
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
