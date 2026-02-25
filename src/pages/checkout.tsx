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
  cashierName: string;
  lineItems: { label: string; qty: number; price: number }[];
  subtotal: number;
  advance: number;
  totalDue: number;
  isVIP?: boolean;
  isLinked?: boolean;
  parentReceiptId?: string;
  parentAdvance?: number;
  remainingAdvance?: number;
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
  const [showQRModal, setShowQRModal] = useState(false);
  const [upiSettings, setUpiSettings] = useState<{ upi_id?: string; business_name?: string; clothes_upi_id?: string; clothes_business_name?: string }>({});
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
  const [isVIP, setIsVIP] = useState(false);

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash' | 'split'>('upi');
  const [splitUpi, setSplitUpi] = useState(0);
  const [splitCash, setSplitCash] = useState(0);

  // Linked transaction state
  const [parentTransactionId, setParentTransactionId] = useState<string | null>(null);
  const [parentAdvance, setParentAdvance] = useState(0);


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
      const { name, phone, male, female, kids, tube, locker, parentId, parentAdvance: pAdvance } = router.query;
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

      // Check if this is a linked transaction
      if (parentId) {
        setParentTransactionId(parentId as string);
        setParentAdvance(parseFloat(pAdvance as string) || 0);
        setAdvance(0); // Linked transactions don't have their own advance
      } else {
        // Calculate subtotal and set as default advance
        const subtotal =
          parsedItems.maleCostume * (prices.male_costume || 0) +
          parsedItems.femaleCostume * (prices.female_costume || 0) +
          parsedItems.kidsCostume * (prices.kids_costume || 0) +
          parsedItems.tube * (prices.tube || 0) +
          parsedItems.locker * (prices.locker || 0);
        setAdvance(subtotal);
      }
    }
  }, [router.isReady, router.query, prices]);

  const subtotal =
    items.maleCostume * (prices.male_costume || 0) +
    items.femaleCostume * (prices.female_costume || 0) +
    items.kidsCostume * (prices.kids_costume || 0) +
    items.tube * (prices.tube || 0) +
    items.locker * (prices.locker || 0);

  const totalDue = subtotal + advance;

  // For linked transactions
  const isLinked = !!parentTransactionId;
  const remainingAdvance = isLinked ? parentAdvance - subtotal : 0;
  const creditExceedsAdvance = isLinked && subtotal > parentAdvance;

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

  // Generate UPI URI for QR code (uses clothes-specific UPI settings)
  const generateUpiUri = (amount: number) => {
    const pa = upiSettings.clothes_upi_id || upiSettings.upi_id || '';
    const pn = encodeURIComponent(upiSettings.clothes_business_name || upiSettings.business_name || 'Subhash Garden');
    const am = amount.toFixed(2);
    const tn = encodeURIComponent(`Payment for rental - ${items.name}`);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
  };

  const handlePay = async () => {
    if (!session?.user) {
      alert('Please login to complete the transaction');
      return;
    }

    // For linked transactions, validate credit doesn't exceed advance
    if (isLinked && creditExceedsAdvance) {
      alert(`Credit amount (₹${subtotal}) exceeds remaining advance (₹${parentAdvance})`);
      return;
    }

    // Linked transactions don't require payment - proceed directly
    if (isLinked) {
      await saveTransaction();
      return;
    }

    const finalAmount = isVIP ? advance : totalDue;

    // VIP with 0 advance - proceed directly
    if (isVIP && advance === 0) {
      await saveTransaction();
      return;
    }

    // Validate split amounts
    if (paymentMethod === 'split') {
      if (splitUpi + splitCash !== finalAmount) {
        alert(`Split amounts (₹${splitUpi + splitCash}) must equal total (₹${finalAmount})`);
        return;
      }
    }

    // Handle payment method
    if (paymentMethod === 'cash') {
      // Cash payment - save directly
      await saveTransaction();
    } else if (paymentMethod === 'upi') {
      // UPI payment - show QR modal
      if ((upiSettings.clothes_upi_id || upiSettings.upi_id) && finalAmount > 0) {
        setShowQRModal(true);
      } else {
        await saveTransaction();
      }
    } else if (paymentMethod === 'split') {
      // Split payment - show QR modal for UPI portion if any
      if (splitUpi > 0 && (upiSettings.clothes_upi_id || upiSettings.upi_id)) {
        setShowQRModal(true);
      } else {
        await saveTransaction();
      }
    }
  };

  const saveTransaction = async () => {
    setSaving(true);
    try {
      // For linked transactions, no advance is collected
      // VIP: subtotal calculated normally, advance is optional (can be 0)
      // VIP totalDue = just the advance (they don't pay for items)
      const finalTotalDue = isLinked ? subtotal : (isVIP ? advance : totalDue);

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
          advance: isLinked ? 0 : advance,
          totalDue: finalTotalDue,
          isComplimentary: isVIP,
          parentTransactionId: parentTransactionId || undefined,
          paymentMethod: isLinked ? undefined : paymentMethod,
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
          cashierName: session?.user?.name || 'Unknown',
          lineItems,
          subtotal,
          advance: isLinked ? 0 : advance,
          totalDue: finalTotalDue,
          isVIP,
          isLinked,
          parentReceiptId: parentTransactionId ? parentTransactionId.slice(-8).toUpperCase() : undefined,
          parentAdvance: isLinked ? parentAdvance : undefined,
          remainingAdvance: isLinked ? remainingAdvance : undefined,
        });
        setShowQRModal(false);
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
    if (!receiptData) return;
    try {
      // Format receipt for 80mm thermal printer (48 chars per line)
      const W = 48;
      const divider = '-'.repeat(W);
      const blackBar = '█'.repeat(W);
      const fmt = (label: string, value: string) => `${label}${value.padStart(W - label.length)}`;
      const lines: string[] = [];

      lines.push('<center><big>Subhash Garden</big></center>');
      lines.push('<center>Costume Rental</center>');
      lines.push('');
      lines.push(blackBar);
      lines.push(`Cashier: ${receiptData.cashierName}`);
      lines.push(`Receipt #: HC-${receiptData.id}${receiptData.isLinked ? ' (Linked)' : ''}`);
      if (receiptData.isLinked && receiptData.parentReceiptId) {
        lines.push(`Linked to: HC-${receiptData.parentReceiptId}`);
      }
      lines.push(`Date: ${receiptData.timestamp}`);
      lines.push(blackBar);
      lines.push('');
      lines.push(`Customer: ${receiptData.customerName}`);
      lines.push(`Phone: +91 ${receiptData.customerPhone}`);
      lines.push(divider);
      lines.push('');

      // Line items
      receiptData.lineItems.forEach(item => {
        const itemLine = `${item.label} x${item.qty}`;
        const priceLine = `Rs.${item.price.toFixed(2)}`;
        lines.push(`${itemLine.padEnd(W - priceLine.length)}${priceLine}`);
      });

      lines.push(divider);

      if (receiptData.isLinked) {
        lines.push(fmt('Parent Advance:', `Rs.${receiptData.parentAdvance?.toFixed(2)}`));
        lines.push(fmt('Credit Used:', `-Rs.${receiptData.subtotal.toFixed(2)}`));
        lines.push(divider);
        lines.push(`<b>${fmt('REMAINING:', `Rs.${receiptData.remainingAdvance?.toFixed(2)}`)}</b>`);
      } else {
        lines.push(fmt('Subtotal:', `Rs.${receiptData.subtotal.toFixed(2)}`));
        lines.push(fmt('Advance Paid:', `Rs.${receiptData.advance.toFixed(2)}`));
        lines.push(divider);
        lines.push(`<b>${fmt('TOTAL:', `Rs.${receiptData.totalDue.toFixed(2)}`)}</b>`);
      }

      lines.push('');
      lines.push(divider);
      const status = receiptData.isLinked ? 'CREDIT APPLIED' : receiptData.isVIP ? 'VIP - COMPLIMENTARY' : 'PAYMENT RECEIVED';
      lines.push(`<center><b>${status}</b></center>`);
      lines.push(divider);
      lines.push('');
      lines.push('<center>Thank you for visiting!</center>');
      lines.push('<center>Have a great swim!</center>');
      lines.push('');

      (window as any).Android.print(lines.join('\n'));
    } catch (e: any) {
      const debugInfo = [
        `Error: ${e?.message || String(e)}`,
        `Android exists: ${typeof (window as any).Android}`,
        `Android.print exists: ${typeof (window as any).Android?.print}`,
        `receiptData: ${receiptData ? 'yes' : 'no'}`,
        `UserAgent: ${navigator.userAgent}`,
      ].join('\n');
      alert(`Print Error - Screenshot this:\n\n${debugInfo}`);
    }
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
          <img src="/logo.png" alt="Subhash Garden" className="w-8 h-8 rounded-full object-cover" />
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
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">
            {isLinked ? 'Credit Transaction' : 'Checkout'}
          </h1>
          <p className="text-gray-500 text-center mb-2">
            {isLinked ? 'Items will be deducted from existing advance' : 'Please review your charges'}
          </p>
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

          {/* Linked Transaction Banner */}
          {isLinked && (
            <div className={`rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] mb-4 ${creditExceedsAdvance ? 'bg-red-50 border-2 border-red-200' : 'bg-purple-50 border-2 border-purple-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <svg className={`w-5 h-5 ${creditExceedsAdvance ? 'text-red-600' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className={`font-semibold ${creditExceedsAdvance ? 'text-red-800' : 'text-purple-800'}`}>
                  Linked to HC-{parentTransactionId?.slice(-8).toUpperCase()}
                </span>
              </div>
              <div className="bg-white rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Parent Advance</span>
                  <span className="font-medium text-gray-800">₹{parentAdvance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">This Credit</span>
                  <span className={`font-medium ${creditExceedsAdvance ? 'text-red-600' : 'text-purple-600'}`}>-₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="text-gray-700 font-medium">Remaining Advance</span>
                  <span className={`font-semibold ${creditExceedsAdvance ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{remainingAdvance.toFixed(2)}
                  </span>
                </div>
              </div>
              {creditExceedsAdvance && (
                <p className="text-red-600 text-sm mt-3 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Credit exceeds available advance
                </p>
              )}
            </div>
          )}

          {/* VIP Toggle - Hidden for linked transactions */}
          {!isLinked && (
            <div className="bg-purple-50 rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-purple-800 font-medium">VIP / Complimentary</span>
                  <p className="text-purple-600 text-xs mt-0.5">No charge for items, advance optional</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isVIP) {
                      setAdvance(0); // Reset advance to 0 when enabling VIP
                    } else {
                      setAdvance(subtotal); // Restore advance to subtotal when disabling VIP
                    }
                    setIsVIP(!isVIP);
                  }}
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
          )}

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

          {/* Advance Card - Hidden for linked transactions */}
          {!isLinked && (
            <div className={`rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)] ${isVIP ? 'bg-purple-50' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className={`font-medium ${isVIP ? 'text-purple-800' : 'text-gray-800'}`}>
                    {isVIP ? 'Advance (Optional)' : 'Advance'}
                  </span>
                  {isVIP && <p className="text-xs text-purple-600">Refundable deposit</p>}
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setAdvance(Math.max(0, advance - 50))}
                    className="w-10 h-8 bg-gray-200 text-gray-600 rounded-l flex items-center justify-center cursor-pointer hover:bg-gray-300"
                  >
                    −
                  </button>
                  <div className={`h-8 px-3 flex items-center justify-center font-medium min-w-[80px] ${isVIP ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                    {advance.toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdvance(advance + 50)}
                    className={`w-10 h-8 text-white rounded-r flex items-center justify-center cursor-pointer ${isVIP ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className={`flex items-center justify-between pt-3 border-t ${isVIP ? 'border-purple-200' : 'border-gray-100'}`}>
                <span className={isVIP ? 'text-purple-700' : 'text-gray-500'}>
                  {isVIP ? 'Amount to Collect' : 'Total Amount'}
                </span>
                <span className={`font-semibold text-lg ${isVIP ? 'text-purple-600' : 'text-green-600'}`}>
                  ₹{isVIP ? advance.toFixed(2) : totalDue.toFixed(2)}
                  {isVIP && advance === 0 && <span className="text-sm ml-1">(VIP)</span>}
                </span>
              </div>
            </div>
          )}

          {/* Payment Method Selection - Hidden for linked and VIP with 0 advance */}
          {!isLinked && !(isVIP && advance === 0) && (
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
                    const amountToPay = isVIP ? advance : totalDue;
                    setSplitUpi(Math.floor(amountToPay / 2));
                    setSplitCash(amountToPay - Math.floor(amountToPay / 2));
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
                          const amountToPay = isVIP ? advance : totalDue;
                          setSplitUpi(val);
                          setSplitCash(Math.max(0, amountToPay - val));
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
                          const amountToPay = isVIP ? advance : totalDue;
                          setSplitCash(val);
                          setSplitUpi(Math.max(0, amountToPay - val));
                        }}
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-purple-200">
                    <span className="text-purple-700">Total</span>
                    <span className={`font-medium ${
                      splitUpi + splitCash === (isVIP ? advance : totalDue)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      ₹{(splitUpi + splitCash).toFixed(2)} / ₹{(isVIP ? advance : totalDue).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Pay Button */}
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 max-w-md mx-auto print:hidden">
          <button
            type="button"
            onClick={handlePay}
            disabled={saving || (isLinked && creditExceedsAdvance)}
            className={`w-full py-4 text-white text-lg font-semibold rounded-xl cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              isLinked
                ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
                : isVIP
                  ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
                  : 'bg-green-700 hover:bg-green-800 active:bg-green-900'
            }`}
          >
            {isLinked && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
            {saving ? 'Processing...' : isLinked
              ? `Complete Credit (₹${subtotal.toFixed(0)})`
              : isVIP
                ? (advance > 0 ? `Collect ₹${advance.toFixed(2)} (VIP)` : 'Complete (VIP)')
                : `Pay ₹${totalDue.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* UPI QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden">
            {/* Modal Header */}
            <div className={`p-5 text-center ${paymentMethod === 'split' ? 'bg-purple-50' : isVIP ? 'bg-purple-50' : 'bg-green-50'}`}>
              <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${paymentMethod === 'split' ? 'bg-purple-100' : isVIP ? 'bg-purple-100' : 'bg-green-100'}`}>
                <svg className={`w-6 h-6 ${paymentMethod === 'split' ? 'text-purple-600' : isVIP ? 'text-purple-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className={`text-xl font-bold ${paymentMethod === 'split' ? 'text-purple-800' : isVIP ? 'text-purple-800' : 'text-green-800'}`}>
                {paymentMethod === 'split' ? 'Scan for UPI Portion' : 'Scan to Pay'}
              </h2>
              <p className="text-gray-600 text-sm mt-1">Ask customer to scan with any UPI app</p>
            </div>

            {/* QR Code */}
            <div className="p-6">
              <div className="bg-white border-2 border-gray-100 rounded-xl p-4 flex justify-center">
                <QRCodeSVG
                  value={generateUpiUri(paymentMethod === 'split' ? splitUpi : (isVIP ? advance : totalDue))}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Amount Display */}
              <div className={`mt-4 p-4 rounded-xl text-center ${paymentMethod === 'split' ? 'bg-purple-50' : isVIP ? 'bg-purple-50' : 'bg-green-50'}`}>
                <p className="text-gray-600 text-sm">
                  {paymentMethod === 'split' ? 'UPI Amount' : 'Amount to Pay'}
                </p>
                <p className={`text-3xl font-bold ${paymentMethod === 'split' ? 'text-purple-600' : isVIP ? 'text-purple-600' : 'text-green-600'}`}>
                  ₹{(paymentMethod === 'split' ? splitUpi : (isVIP ? advance : totalDue)).toFixed(2)}
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
                  {upiSettings.clothes_upi_id || upiSettings.upi_id}
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
                onClick={saveTransaction}
                disabled={saving}
                className={`flex-1 py-3 text-white font-semibold rounded-xl cursor-pointer disabled:bg-gray-400 ${
                  paymentMethod === 'split'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : isVIP
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {saving ? 'Processing...' : paymentMethod === 'split' ? 'Payment Received' : 'Payment Received'}
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
                <div className="text-2xl mb-1">🏊</div>
                <div className="flex items-center justify-center gap-2">
                  <img src="/logo.png" alt="Subhash Garden" className="w-8 h-8 rounded-full object-cover" />
                  <h2 className="text-xl font-bold text-gray-800">Subhash Garden</h2>
                </div>
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
                  <span>HC-{receiptData.id}{receiptData.isLinked ? ' (Linked)' : ''}</span>
                </div>
                {receiptData.isLinked && receiptData.parentReceiptId && (
                  <div className="flex justify-between text-purple-600">
                    <span>Linked to:</span>
                    <span>HC-{receiptData.parentReceiptId}</span>
                  </div>
                )}
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
                {receiptData.isLinked ? (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Parent Advance</span>
                      <span>₹{receiptData.parentAdvance?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-purple-600">
                      <span>Credit Used</span>
                      <span>-₹{receiptData.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="w-full border-b border-gray-300 my-2"></div>
                    <div className="flex justify-between text-lg font-bold text-gray-800">
                      <span>REMAINING ADVANCE</span>
                      <span>₹{receiptData.remainingAdvance?.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <>
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
                      <span>TOTAL AMOUNT</span>
                      <span>₹{receiptData.totalDue.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="w-full border-b-2 border-dashed border-gray-300 my-4"></div>

              {/* Payment Status */}
              <div className={`text-center py-3 rounded-lg mb-4 ${receiptData.isLinked ? 'bg-purple-50' : receiptData.isVIP ? 'bg-purple-50' : 'bg-green-50'}`}>
                <div className={`flex items-center justify-center gap-2 font-semibold ${receiptData.isLinked ? 'text-purple-700' : receiptData.isVIP ? 'text-purple-700' : 'text-green-700'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {receiptData.isLinked ? 'CREDIT APPLIED' : receiptData.isVIP ? 'VIP - COMPLIMENTARY' : 'PAYMENT RECEIVED'}
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
