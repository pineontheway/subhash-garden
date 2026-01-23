'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';

export default function StartSession() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [startingTag, setStartingTag] = useState('');
  const [totalTags, setTotalTags] = useState('');
  const [error, setError] = useState('');

  // Get today's date in IST
  const today = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Check user role
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (!session.user.role) {
        router.push('/access-denied');
        return;
      }
      // Check if session already started today
      const savedDate = sessionStorage.getItem('ticketSessionDate');
      const todayDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      if (savedDate === todayDate && sessionStorage.getItem('nextTagNumber')) {
        // Session already started today, go to ticket counter
        router.push('/ticket-counter');
      }
    } else if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, session, router]);

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const handleStartSession = () => {
    setError('');

    // Validate tag number
    const trimmed = startingTag.trim();
    if (!trimmed) {
      setError('Please enter a starting tag number');
      return;
    }
    if (!/^\d{6}$/.test(trimmed)) {
      setError('Tag number must be exactly 6 digits');
      return;
    }

    // Save to sessionStorage
    const todayDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    sessionStorage.setItem('counterType', 'ticket');
    sessionStorage.setItem('ticketSessionDate', todayDate);
    sessionStorage.setItem('nextTagNumber', trimmed);
    sessionStorage.setItem('startingTagNumber', trimmed);

    // Save total tags if provided
    if (totalTags.trim()) {
      sessionStorage.setItem('totalTagsReceived', totalTags.trim());
    } else {
      sessionStorage.removeItem('totalTagsReceived');
    }

    // Navigate to ticket counter
    router.push('/ticket-counter');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('counterType');
    sessionStorage.removeItem('ticketSessionDate');
    sessionStorage.removeItem('nextTagNumber');
    sessionStorage.removeItem('startingTagNumber');
    sessionStorage.removeItem('totalTagsReceived');
    signOut();
  };

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

        {/* Content */}
        <main className="p-5 space-y-6">
          {/* Welcome Card */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">Ticket Counter</h1>
                <p className="text-blue-100 text-sm">Start your session</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-blue-100">Cashier:</span>
                <span className="font-semibold">{session?.user?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-blue-100">Date:</span>
                <span className="font-semibold">{today}</span>
              </div>
            </div>
          </div>

          {/* Starting Tag Input */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Starting Tag Number</h2>
            <p className="text-sm text-gray-500 mb-4">
              Enter the first tag number you received today. Tags will auto-increment from this number.
            </p>

            <input
              type="text"
              placeholder="e.g., 100001"
              value={startingTag}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setStartingTag(value);
                setError('');
              }}
              maxLength={6}
              className="w-full px-4 py-4 text-2xl text-center font-mono tracking-widest border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {error && (
              <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
            )}

            <p className="text-xs text-gray-400 mt-3 text-center">
              Must be exactly 6 digits
            </p>
          </div>

          {/* Total Tags Input (Optional) */}
          <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Total Tags Received <span className="text-gray-400 font-normal text-sm">(Optional)</span>
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              How many tags did you receive from the owner? This helps track unused tags.
            </p>

            <input
              type="text"
              placeholder="e.g., 100"
              value={totalTags}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setTotalTags(value);
              }}
              className="w-full px-4 py-3 text-xl text-center font-mono border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 rounded-2xl p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="space-y-1 text-blue-700">
                  <li>Tags will be assigned automatically</li>
                  <li>Each customer gets sequential tags</li>
                  <li>3 tickets = 3 consecutive tag numbers</li>
                </ul>
              </div>
            </div>
          </div>
        </main>

        {/* Start Button */}
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-100 max-w-md mx-auto">
          <button
            type="button"
            onClick={handleStartSession}
            disabled={!startingTag}
            className="w-full py-4 bg-blue-700 text-white text-lg font-semibold rounded-xl hover:bg-blue-800 active:bg-blue-900 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Start Session
          </button>
        </div>
      </div>
    </div>
  );
}
