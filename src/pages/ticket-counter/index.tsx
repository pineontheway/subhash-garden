'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';

export default function TicketCounter() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // Vehicle number disabled per user request
  // const [vehicleNumber, setVehicleNumber] = useState('');
  const [menTicket, setMenTicket] = useState(0);
  const [womenTicket, setWomenTicket] = useState(0);
  const [childTicket, setChildTicket] = useState(0);
  const [nextTagNumber, setNextTagNumber] = useState<string | null>(null);
  const [startingTagNumber, setStartingTagNumber] = useState<string | null>(null);

  // Check user role, counter selection, and session setup
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (!session.user.role) {
        router.push('/access-denied');
        return;
      }
      // Verify cashier selected ticket counter
      if (session.user.role === 'cashier') {
        const counterType = sessionStorage.getItem('counterType');
        if (!counterType) {
          router.push('/select-counter');
          return;
        } else if (counterType !== 'ticket') {
          router.push('/');
          return;
        }
      }
      // Check if session is started for today
      const savedDate = sessionStorage.getItem('ticketSessionDate');
      const todayDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      const savedNextTag = sessionStorage.getItem('nextTagNumber');
      if (savedDate !== todayDate || !savedNextTag) {
        router.push('/ticket-counter/start-session');
        return;
      }
      setNextTagNumber(savedNextTag);
      setStartingTagNumber(sessionStorage.getItem('startingTagNumber'));
    } else if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, session, router]);

  // Restore state from URL params (when coming back from checkout)
  useEffect(() => {
    if (router.isReady) {
      const { name: qName, phone: qPhone, vehicle, men, women, child } = router.query;
      if (qName) setName(qName as string);
      if (qPhone) setPhone(qPhone as string);
      // Vehicle number disabled per user request
      // if (vehicle) setVehicleNumber(vehicle as string);
      if (men) setMenTicket(parseInt(men as string) || 0);
      if (women) setWomenTicket(parseInt(women as string) || 0);
      if (child) setChildTicket(parseInt(child as string) || 0);
    }
  }, [router.isReady, router.query]);

  // Refresh next tag number from sessionStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setNextTagNumber(sessionStorage.getItem('nextTagNumber'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Show loading while checking auth
  if (status === 'loading' || nextTagNumber === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Indian phone validation disabled per user request
  // const validateIndianPhone = (phoneNumber: string): boolean => {
  //   const cleaned = phoneNumber.replace(/[\s-]/g, '').replace(/^(\+91|91|0)/, '');
  //   const indianMobileRegex = /^[6-9]\d{9}$/;
  //   return indianMobileRegex.test(cleaned);
  // };

  // Generate tag numbers for this transaction
  const generateTagNumbers = (count: number): string[] => {
    const tags: string[] = [];
    let currentTag = parseInt(nextTagNumber || '0', 10);
    for (let i = 0; i < count; i++) {
      tags.push(currentTag.toString().padStart(6, '0'));
      currentTag++;
    }
    return tags;
  };

  const totalTickets = menTicket + womenTicket + childTicket;
  const assignedTags = totalTickets > 0 ? generateTagNumbers(totalTickets) : [];

  const handleCheckout = () => {
    if (!name.trim()) {
      alert('Please enter customer name');
      return;
    }
    if (!phone.trim()) {
      alert('Please enter phone number');
      return;
    }
    // Indian phone validation disabled per user request
    // if (!validateIndianPhone(phone)) {
    //   alert('Please enter a valid 10-digit Indian mobile number');
    //   return;
    // }
    if (totalTickets === 0) {
      alert('Please select at least one ticket');
      return;
    }
    const params = new URLSearchParams({
      name,
      phone,
      men: menTicket.toString(),
      women: womenTicket.toString(),
      child: childTicket.toString(),
      tags: assignedTags.join(','),
    });
    // Vehicle number disabled per user request
    // if (vehicleNumber.trim()) {
    //   params.set('vehicle', vehicleNumber.trim());
    // }
    router.push(`/ticket-counter/checkout?${params.toString()}`);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('counterType');
    sessionStorage.removeItem('ticketSessionDate');
    sessionStorage.removeItem('nextTagNumber');
    sessionStorage.removeItem('startingTagNumber');
    sessionStorage.removeItem('totalTagsReceived');
    signOut();
  };

  const handleEndSession = () => {
    router.push('/ticket-counter/end-session');
  };

  // Counter button styles
  const btnMinus = "w-12 h-10 bg-gray-200 text-gray-600 text-xl font-medium rounded-l-lg hover:bg-gray-300 active:bg-gray-400 select-none cursor-pointer";
  const btnPlus = "w-12 h-10 bg-gray-200 text-blue-600 text-xl font-medium rounded-r-lg hover:bg-gray-300 active:bg-gray-400 select-none cursor-pointer";
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
          <button type="button" onClick={handleLogout} className="text-blue-600 font-medium">
            Logout
          </button>
        </header>

        {/* Welcome Banner */}
        {session?.user && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-blue-800">
                Welcome, <span className="font-semibold">{session.user.name}</span>
                <span className="text-xs ml-2 bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                  ticket counter
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
                      className="text-sm text-blue-600 font-medium hover:text-blue-800 cursor-pointer"
                    >
                      Switch Counter
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/admin')}
                      className="text-sm text-blue-700 font-medium hover:text-blue-900 cursor-pointer"
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
                  onClick={() => router.push('/my-summary?counter=ticket')}
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
          {/* Session Info Card */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Next Tag Number</p>
                <p className="text-2xl font-bold font-mono tracking-wider">{nextTagNumber}</p>
                <p className="text-blue-200 text-xs mt-1">Started from: {startingTagNumber}</p>
              </div>
              <button
                type="button"
                onClick={handleEndSession}
                className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                End Session
              </button>
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-gray-700 mb-2">Customer Name</label>
            <input
              type="text"
              placeholder="Enter customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPhone(value);
                }}
                maxLength={10}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Vehicle Number Input - disabled per user request */}
          {/* <div>
            <label className="block text-gray-700 mb-2">Vehicle Number <span className="text-gray-400 text-sm">(Optional)</span></label>
            <input
              type="text"
              placeholder="e.g., KA 01 AB 1234"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div> */}

          {/* Tickets Card */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Entry Tickets</h2>

            {/* Men */}
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700">Men</span>
              <div className="flex items-center">
                <button type="button" className={btnMinus} onClick={() => setMenTicket(Math.max(0, menTicket - 1))}>-</button>
                <div className={counterDisplay}>{menTicket}</div>
                <button type="button" className={btnPlus} onClick={() => setMenTicket(menTicket + 1)}>+</button>
              </div>
            </div>

            {/* Women */}
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700">Women</span>
              <div className="flex items-center">
                <button type="button" className={btnMinus} onClick={() => setWomenTicket(Math.max(0, womenTicket - 1))}>-</button>
                <div className={counterDisplay}>{womenTicket}</div>
                <button type="button" className={btnPlus} onClick={() => setWomenTicket(womenTicket + 1)}>+</button>
              </div>
            </div>

            {/* Child */}
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700">Child</span>
              <div className="flex items-center">
                <button type="button" className={btnMinus} onClick={() => setChildTicket(Math.max(0, childTicket - 1))}>-</button>
                <div className={counterDisplay}>{childTicket}</div>
                <button type="button" className={btnPlus} onClick={() => setChildTicket(childTicket + 1)}>+</button>
              </div>
            </div>
          </div>

          {/* Auto-assigned Tags Preview */}
          {totalTickets > 0 && (
            <div className="bg-blue-50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span className="text-blue-800 font-medium">Tags to be assigned</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {assignedTags.map((tag, index) => (
                  <span key={index} className="bg-white text-blue-700 px-3 py-1.5 rounded-lg text-sm font-mono font-medium shadow-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Checkout Button */}
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 max-w-md mx-auto">
          <button
            type="button"
            onClick={handleCheckout}
            className="w-full py-4 bg-blue-700 text-white text-lg font-semibold rounded-xl hover:bg-blue-800 active:bg-blue-900 cursor-pointer"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
