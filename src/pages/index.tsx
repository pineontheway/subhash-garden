'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn, signOut, useSession } from 'next-auth/react';

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

  // Check user role and redirect if needed
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // User is logged in but has no role
      if (!session.user.role) {
        router.push('/access-denied');
      }
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

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
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
    router.push(`/checkout?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&male=${maleCostume}&female=${femaleCostume}&kids=${kidsCostume}&tube=${tube}&locker=${locker}`);
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
            <button type="button" onClick={() => signOut()} className="text-green-600 font-medium">
              Logout
            </button>
          ) : (
            <button type="button" onClick={() => signIn('google')} className="text-green-600 font-medium">
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
                  {session.user.role}
                </span>
              </p>
              {session.user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => router.push('/admin')}
                  className="text-sm text-green-700 font-medium hover:text-green-900 cursor-pointer"
                >
                  Admin Panel
                </button>
              )}
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
            <label className="block text-gray-700 mb-2">Name</label>
            <input
              type="text"
              placeholder="Enter your name"
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
            className="w-full py-4 bg-green-700 text-white text-lg font-semibold rounded-xl hover:bg-green-800 active:bg-green-900 cursor-pointer"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
