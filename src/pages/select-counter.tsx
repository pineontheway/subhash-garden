'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';

export default function SelectCounter() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [flowSettings, setFlowSettings] = useState<{ ticket: boolean; clothes: boolean }>({ ticket: true, clothes: true });

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        setFlowSettings({
          ticket: data.enable_ticket_flow !== 'false',
          clothes: data.enable_clothes_flow !== 'false',
        });
      })
      .catch(() => {});
  }, []);

  // Check authentication and role
  useEffect(() => {
    if (status === 'authenticated') {
      if (!session?.user?.role) {
        router.push('/access-denied');
        return;
      }
      // If counter type already selected, redirect to appropriate page
      const counterType = sessionStorage.getItem('counterType');
      if (counterType === 'ticket') {
        // Check if session is started for today
        const savedDate = sessionStorage.getItem('ticketSessionDate');
        const todayDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        if (savedDate === todayDate && sessionStorage.getItem('nextTagNumber')) {
          router.push('/ticket-counter');
        } else {
          router.push('/ticket-counter/start-session');
        }
      } else if (counterType === 'clothes') {
        router.push('/');
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

  const handleSelectCounter = (counterType: 'ticket' | 'clothes') => {
    // Admins bypass flow restrictions; cashiers respect them
    if (session?.user?.role !== 'admin') {
      if (counterType === 'ticket' && !flowSettings.ticket) return;
      if (counterType === 'clothes' && !flowSettings.clothes) return;
    }
    sessionStorage.setItem('counterType', counterType);
    if (counterType === 'ticket') {
      // Check if session is already started for today
      const savedDate = sessionStorage.getItem('ticketSessionDate');
      const todayDate = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      if (savedDate === todayDate && sessionStorage.getItem('nextTagNumber')) {
        router.push('/ticket-counter');
      } else {
        router.push('/ticket-counter/start-session');
      }
    } else {
      router.push('/');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('counterType');
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
          <button type="button" onClick={handleLogout} className="text-green-600 font-medium">
            Logout
          </button>
        </header>

        {/* Welcome Banner */}
        {session?.user && (
          <div className="px-5 py-3 bg-green-50 border-b border-green-100">
            <div className="flex items-center justify-between">
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
          </div>
        )}

        {/* Content */}
        <main className="p-5 flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 140px)' }}>
          <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">Select Your Counter</h1>
          <p className="text-gray-500 mb-8 text-center">Choose which counter you&apos;re working at today</p>

          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            {/* Ticket Counter Card */}
            {(() => {
              const isAdmin = session?.user?.role === 'admin';
              const flowOff = !flowSettings.ticket;
              const clickBlocked = !isAdmin && flowOff;
              return (
                <button
                  type="button"
                  onClick={() => handleSelectCounter('ticket')}
                  disabled={clickBlocked}
                  className={`flex flex-col items-center p-6 border-2 rounded-2xl transition-all ${
                    flowOff
                      ? `bg-gray-100 border-gray-200 opacity-50 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`
                      : 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-400 cursor-pointer'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${flowOff ? 'bg-gray-200' : 'bg-blue-200'}`}>
                    <svg className={`w-8 h-8 ${flowOff ? 'text-gray-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  </div>
                  <span className={`text-lg font-semibold ${flowOff ? 'text-gray-400' : 'text-blue-800'}`}>Ticket Counter</span>
                  <span className={`text-sm mt-1 ${flowOff ? 'text-gray-400' : 'text-blue-600'}`}>
                    {flowOff ? (isAdmin ? 'Disabled (Admin)' : 'Unavailable') : 'Entry Tickets'}
                  </span>
                </button>
              );
            })()}

            {/* Clothes Counter Card */}
            {(() => {
              const isAdmin = session?.user?.role === 'admin';
              const flowOff = !flowSettings.clothes;
              const clickBlocked = !isAdmin && flowOff;
              return (
                <button
                  type="button"
                  onClick={() => handleSelectCounter('clothes')}
                  disabled={clickBlocked}
                  className={`flex flex-col items-center p-6 border-2 rounded-2xl transition-all ${
                    flowOff
                      ? `bg-gray-100 border-gray-200 opacity-50 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`
                      : 'bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-400 cursor-pointer'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${flowOff ? 'bg-gray-200' : 'bg-green-200'}`}>
                    <svg className={`w-8 h-8 ${flowOff ? 'text-gray-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className={`text-lg font-semibold ${flowOff ? 'text-gray-400' : 'text-green-800'}`}>Clothes Counter</span>
                  <span className={`text-sm mt-1 ${flowOff ? 'text-gray-400' : 'text-green-600'}`}>
                    {flowOff ? (isAdmin ? 'Disabled (Admin)' : 'Unavailable') : 'Rentals Inside'}
                  </span>
                </button>
              );
            })()}
          </div>

          <p className="text-xs text-gray-400 mt-8 text-center">
            You&apos;ll need to logout to switch counters
          </p>
        </main>
      </div>
    </div>
  );
}
