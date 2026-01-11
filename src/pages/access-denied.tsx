'use client';
import { signOut, useSession } from 'next-auth/react';

export default function AccessDenied() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
            </svg>
            <span className="text-xl font-bold text-gray-800">Subhash Garden</span>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-green-600 font-medium cursor-pointer"
          >
            Logout
          </button>
        </header>

        {/* Content */}
        <main className="p-5 flex flex-col items-center justify-center min-h-[70vh]">
          {/* Warning Icon */}
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-center mb-6 px-4">
            You don't have permission to access this application.
          </p>

          {/* User Info */}
          {session?.user && (
            <div className="bg-gray-50 rounded-xl p-4 w-full max-w-xs text-center mb-6">
              <p className="text-sm text-gray-600 mb-1">Logged in as:</p>
              <p className="font-medium text-gray-800">{session.user.name}</p>
              <p className="text-sm text-gray-500">{session.user.email}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 w-full">
            <p className="text-sm text-yellow-800 text-center">
              Please contact your administrator to request access.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
