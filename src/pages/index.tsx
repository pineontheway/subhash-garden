'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { signIn, signOut, useSession } from 'next-auth/react';

// Type for existing transaction with potential linked child
type ExistingTransaction = {
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
  status: string;
  createdAt: string;
  linkedTransaction?: ExistingTransaction | null;
};

// Format date in Indian timezone
const formatIndianDate = () => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  };
  return new Date().toLocaleDateString('en-IN', options);
};

// Format time in Indian timezone
const formatIndianTime = () => {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  };
  return new Date().toLocaleTimeString('en-IN', options);
};

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [maleCostume, setMaleCostume] = useState(0);
  const [femaleCostume, setFemaleCostume] = useState(0);
  const [kidsCostume, setKidsCostume] = useState(0);
  const [tube, setTube] = useState(0);
  const [locker, setLocker] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [isAndroidWebView, setIsAndroidWebView] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Linked transaction state
  const [existingTransaction, setExistingTransaction] = useState<ExistingTransaction | null>(null);
  const [loadingTransaction, setLoadingTransaction] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  // Detect Android WebView on mount
  useEffect(() => {
    if ((window as any).Android?.print) {
      setIsAndroidWebView(true);
    }
  }, []);

  // Update date and time on mount and every minute
  useEffect(() => {
    setCurrentDate(formatIndianDate());
    setCurrentTime(formatIndianTime());

    const timer = setInterval(() => {
      setCurrentTime(formatIndianTime());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Check user role and counter selection, redirect if needed
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // User is logged in but has no role
      if (!session.user.role) {
        router.push('/access-denied');
        return;
      }
      // All users (cashiers and admins) need to select a counter type to work
      const counterType = sessionStorage.getItem('counterType');
      if (!counterType) {
        router.push('/select-counter');
      } else if (counterType === 'ticket') {
        router.push('/ticket-counter');
      }
      // If counterType === 'clothes', stay on this page
    }
  }, [status, session, router]);

  // Restore state from URL params (when coming back from checkout)
  useEffect(() => {
    if (router.isReady) {
      const { name: qName, phone: qPhone, male, female, kids, tube: qTube, locker: qLocker } = router.query;
      if (qName) setName(qName as string);
      if (qPhone) setPhone(qPhone as string);
      if (male) setMaleCostume(parseInt(male as string) || 0);
      if (female) setFemaleCostume(parseInt(female as string) || 0);
      if (kids) setKidsCostume(parseInt(kids as string) || 0);
      if (qTube) setTube(parseInt(qTube as string) || 0);
      if (qLocker) setLocker(parseInt(qLocker as string) || 0);
    }
  }, [router.isReady, router.query]);

  // Search for existing transaction when phone number is complete
  const searchExistingTransaction = useCallback(async (phoneNumber: string) => {
    if (phoneNumber.length !== 10) {
      setExistingTransaction(null);
      setIsLinking(false);
      return;
    }

    setLoadingTransaction(true);
    try {
      // Only search today's transactions (in IST)
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const res = await fetch(`/api/transactions?status=active&search=${phoneNumber}&startDate=${today}&endDate=${tomorrow}`);
      if (res.ok) {
        const data = await res.json();
        // Find a transaction that matches this phone and doesn't already have a linked child
        const matching = data.find((t: ExistingTransaction) =>
          t.customerPhone === phoneNumber && !t.linkedTransaction
        );
        setExistingTransaction(matching || null);
        if (!matching) {
          setIsLinking(false);
        }
      }
    } catch (error) {
      console.error('Error searching transactions:', error);
    }
    setLoadingTransaction(false);
  }, []);

  // Debounced phone search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (phone.length === 10 && status === 'authenticated') {
        searchExistingTransaction(phone);
      } else {
        setExistingTransaction(null);
        setIsLinking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [phone, status, searchExistingTransaction]);

  // Handle linking to existing transaction
  const handleLinkTransaction = () => {
    if (existingTransaction) {
      setIsLinking(true);
      setName(existingTransaction.customerName); // Auto-fill name from parent
    }
  };

  // Handle unlinking
  const handleUnlink = () => {
    setIsLinking(false);
  };

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    const result = await signIn('credentials', {
      email: loginEmail,
      password: loginPassword,
      redirect: false,
    });

    setLoginLoading(false);

    if (result?.error) {
      setLoginError('Invalid email or password');
    }
  };

  // Show login screen when not authenticated
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600 relative overflow-hidden">
        {/* Wave pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="white" d="M0,192L48,176C96,160,192,128,288,133.3C384,139,480,181,576,186.7C672,192,768,160,864,154.7C960,149,1056,171,1152,165.3C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 right-0 opacity-20">
          <svg className="w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="white" d="M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,90.7C672,85,768,107,864,128C960,149,1056,171,1152,165.3C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>

        {/* Mobile Container */}
        <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center p-6 relative z-10">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-white rounded-full shadow-xl flex items-center justify-center mx-auto mb-6">
              <img src="/logo.png" alt="Subhash Garden" className="w-20 h-20 rounded-full object-cover" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">Subhash Garden</h1>
            <p className="text-cyan-100 text-lg">Water Park & Resort</p>
          </div>

          {/* Welcome Card */}
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 w-full max-w-sm">
            {/* Water drop icon */}
            <div className="flex justify-center mb-4">
              <svg className="w-12 h-12 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>

            {/* Date and Time */}
            <div className="text-center mb-6">
              <p className="text-2xl font-semibold text-gray-800">{currentDate || 'Loading...'}</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{currentTime || '--:--'}</p>
            </div>

            {/* Welcome Message */}
            <div className="text-center mb-6">
              <p className="text-gray-600 text-lg">Welcome!</p>
              <p className="text-gray-500">Login to start your shift</p>
            </div>

            {/* Park Status */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-6">
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-green-700 font-medium">Open Today</span>
              </div>
              <p className="text-center text-green-600 text-sm mt-1">9:00 AM - 6:00 PM</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-red-600 text-sm font-medium">{loginError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>

          {/* Test Print Button - Only visible in Android WebView */}
          {isAndroidWebView && (
            <button
              type="button"
              onClick={() => {
                const divider = '--------------------------------';
                const lines: string[] = [];

                lines.push('<center><big>Subhash Garden</big></center>');
                lines.push('<center>Costume Rental</center>');
                lines.push(divider);
                lines.push('');
                lines.push(`Date: ${currentDate} ${currentTime}`);
                lines.push('Receipt #: HC-TEST1234');
                lines.push('Cashier: Test User');
                lines.push(divider);
                lines.push('');
                lines.push('Customer: Test Customer');
                lines.push('Phone: +91 9876543210');
                lines.push(divider);
                lines.push('');
                lines.push('Male Costume x2       Rs.400.00');
                lines.push('Female Costume x1     Rs.200.00');
                lines.push('Kids Costume x1       Rs.100.00');
                lines.push('Tube x1               Rs.150.00');
                lines.push('Locker x1             Rs.50.00');
                lines.push(divider);
                lines.push('Subtotal:           Rs.900.00');
                lines.push('Advance Paid:       Rs.500.00');
                lines.push(divider);
                lines.push('<b>TOTAL:          Rs.400.00</b>');
                lines.push('');
                lines.push(divider);
                lines.push('<center><b>PAYMENT RECEIVED</b></center>');
                lines.push(divider);
                lines.push('');
                lines.push('<center>** TEST PRINT **</center>');
                lines.push('<center>Thank you for visiting!</center>');
                lines.push('<center>Have a great swim!</center>');
                lines.push('');

                (window as any).Android.print(lines.join('\n'));
              }}
              className="mt-6 w-full max-w-sm py-3 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-xl border border-white/30 hover:bg-white/30 active:bg-white/40 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Test Print
            </button>
          )}

          {/* Footer */}
          <p className="text-cyan-100 text-sm mt-8 text-center">
            Staff Portal - Authorized Personnel Only
          </p>
        </div>
      </div>
    );
  }

  // Validate Indian phone number
  const validateIndianPhone = (phoneNumber: string): boolean => {
    // Remove spaces, dashes, and common prefixes
    const cleaned = phoneNumber.replace(/[\s-]/g, '').replace(/^(\+91|91|0)/, '');
    // Indian mobile: 10 digits starting with 6, 7, 8, or 9
    const indianMobileRegex = /^[6-9]\d{9}$/;
    return indianMobileRegex.test(cleaned);
  };

  const handleCheckout = () => {
    if (!name.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!phone.trim()) {
      alert('Please enter phone number');
      return;
    }
    if (!validateIndianPhone(phone)) {
      alert('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    const total = maleCostume + femaleCostume + kidsCostume + tube + locker;
    if (total === 0) {
      alert('Please select at least one item');
      return;
    }

    // Build checkout URL with optional parentTransactionId for linked transactions
    let checkoutUrl = `/checkout?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&male=${maleCostume}&female=${femaleCostume}&kids=${kidsCostume}&tube=${tube}&locker=${locker}`;

    if (isLinking && existingTransaction) {
      checkoutUrl += `&parentId=${existingTransaction.id}&parentAdvance=${existingTransaction.advance}`;
    }

    router.push(checkoutUrl);
  };

  // Counter button styles
  const btnMinus = "w-12 h-10 bg-gray-200 text-gray-600 text-xl font-medium rounded-l-lg hover:bg-gray-300 active:bg-gray-400 select-none cursor-pointer";
  const btnPlus = "w-12 h-10 bg-gray-200 text-green-600 text-xl font-medium rounded-r-lg hover:bg-gray-300 active:bg-gray-400 select-none cursor-pointer";
  const counterDisplay = "w-12 h-10 bg-gray-100 flex items-center justify-center text-lg font-medium text-gray-900";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Container */}
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Subhash Garden" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-xl font-bold text-gray-800">Subhash Garden</span>
          </div>
          {session ? (
            <button type="button" onClick={() => { sessionStorage.removeItem('counterType'); signOut(); }} className="text-green-600 font-medium">
              Logout
            </button>
          ) : (
            <button type="button" onClick={() => signIn()} className="text-green-600 font-medium">
              Login
            </button>
          )}
        </header>

        {/* Welcome Banner */}
        {session?.user && (
          <div className="px-5 py-3 bg-green-50 border-b border-green-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-800">
                Welcome, <span className="font-semibold">{session.user.name}</span>
                <span className="text-xs ml-2 bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                  {session.user.role === 'admin' ? 'clothes counter' : session.user.role}
                </span>
              </p>
              <div className="flex items-center gap-3">
                {session.user.role === 'admin' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.removeItem('counterType');
                        router.push('/select-counter');
                      }}
                      className="text-sm text-green-600 font-medium hover:text-green-800 cursor-pointer"
                    >
                      Switch Counter
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/admin')}
                      className="text-sm text-green-700 font-medium hover:text-green-900 cursor-pointer"
                    >
                      Admin Panel
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* Quick Actions */}
            {session.user.role && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/return-advance')}
                  className="flex-1 py-2 bg-orange-100 text-orange-700 font-medium rounded-lg hover:bg-orange-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Return Advance
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/my-summary')}
                  className="flex-1 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  My Summary
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <main className="p-5 space-y-4 pb-32">
          {/* Name Input */}
          <div>
            <label className="block text-gray-700 mb-2">Customer Name</label>
            <input
              type="text"
              placeholder="Enter customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Phone Input */}
          <div>
            <label className="block text-gray-700 mb-2">Phone Number</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-200 rounded-l-xl text-gray-600">
                +91
              </span>
              <input
                type="tel"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => {
                  // Only allow digits
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPhone(value);
                }}
                maxLength={10}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Existing Transaction Card */}
          {loadingTransaction && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-gray-500 text-center">Searching for existing transaction...</p>
            </div>
          )}

          {existingTransaction && !loadingTransaction && (
            <div className={`rounded-xl p-4 border-2 ${isLinking ? 'bg-purple-50 border-purple-300' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-amber-800">Existing Transaction Found</span>
                </div>
                {isLinking && (
                  <span className="text-xs px-2 py-1 bg-purple-200 text-purple-700 rounded-full font-medium">
                    Linking
                  </span>
                )}
              </div>

              <div className="bg-white rounded-lg p-3 mb-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-gray-800">{existingTransaction.customerName}</p>
                    <p className="text-sm text-gray-500">HC-{existingTransaction.id.slice(-8).toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">₹{existingTransaction.advance.toFixed(0)}</p>
                    <p className="text-xs text-gray-400">Advance</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                  {existingTransaction.maleCostume > 0 && <span>Male: {existingTransaction.maleCostume}</span>}
                  {existingTransaction.femaleCostume > 0 && <span>Female: {existingTransaction.femaleCostume}</span>}
                  {existingTransaction.kidsCostume > 0 && <span>Kids: {existingTransaction.kidsCostume}</span>}
                  {existingTransaction.tube > 0 && <span>Tube: {existingTransaction.tube}</span>}
                  {existingTransaction.locker > 0 && <span>Locker: {existingTransaction.locker}</span>}
                </div>
                {existingTransaction.linkedTransaction && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-red-500 font-medium">Already has a linked transaction</p>
                  </div>
                )}
              </div>

              {!existingTransaction.linkedTransaction && (
                isLinking ? (
                  <button
                    type="button"
                    onClick={handleUnlink}
                    className="w-full py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Linking
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLinkTransaction}
                    className="w-full py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Link to This Transaction
                  </button>
                )
              )}
            </div>
          )}

          {/* Costumes Card */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Costumes</h2>

            {/* Male */}
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700">Male</span>
              <div className="flex items-center">
                <button type="button" className={btnMinus} onClick={() => setMaleCostume(Math.max(0, maleCostume - 1))}>−</button>
                <div className={counterDisplay}>{maleCostume}</div>
                <button type="button" className={btnPlus} onClick={() => setMaleCostume(maleCostume + 1)}>+</button>
              </div>
            </div>

            {/* Female */}
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700">Female</span>
              <div className="flex items-center">
                <button type="button" className={btnMinus} onClick={() => setFemaleCostume(Math.max(0, femaleCostume - 1))}>−</button>
                <div className={counterDisplay}>{femaleCostume}</div>
                <button type="button" className={btnPlus} onClick={() => setFemaleCostume(femaleCostume + 1)}>+</button>
              </div>
            </div>

            {/* Kids */}
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700">Kids</span>
              <div className="flex items-center">
                <button type="button" className={btnMinus} onClick={() => setKidsCostume(Math.max(0, kidsCostume - 1))}>−</button>
                <div className={counterDisplay}>{kidsCostume}</div>
                <button type="button" className={btnPlus} onClick={() => setKidsCostume(kidsCostume + 1)}>+</button>
              </div>
            </div>
          </div>

          {/* Tube Card */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Tube</h2>
            <div className="flex justify-center">
              <div className="flex items-center">
                <button type="button" className={btnMinus} onClick={() => setTube(Math.max(0, tube - 1))}>−</button>
                <div className={counterDisplay}>{tube}</div>
                <button type="button" className={btnPlus} onClick={() => setTube(tube + 1)}>+</button>
              </div>
            </div>
          </div>

          {/* Locker Card */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Locker</h2>
            <div className="flex justify-center">
              <div className="flex items-center">
                <button type="button" className={btnMinus} onClick={() => setLocker(Math.max(0, locker - 1))}>−</button>
                <div className={counterDisplay}>{locker}</div>
                <button type="button" className={btnPlus} onClick={() => setLocker(locker + 1)}>+</button>
              </div>
            </div>
          </div>
        </main>

        {/* Checkout Button */}
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 max-w-md mx-auto">
          <button
            type="button"
            onClick={handleCheckout}
            className={`w-full py-4 text-white text-lg font-semibold rounded-xl cursor-pointer flex items-center justify-center gap-2 ${
              isLinking
                ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
                : 'bg-green-700 hover:bg-green-800 active:bg-green-900'
            }`}
          >
            {isLinking && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
            {isLinking ? 'Proceed as Credit' : 'Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
}
