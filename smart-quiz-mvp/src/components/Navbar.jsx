import React from 'react';

export default function Navbar({ user, setPage, onLogout }) {
  return (
    <nav className="bg-white shadow-sm border-b border-orange-100 sticky top-0 z-40">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <button onClick={() => setPage('home')} className="text-2xl font-black flex gap-2 items-center">
          <span className="text-3xl">🧠</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">SmartQuiz</span>
        </button>
        <div className="flex gap-4 text-sm font-bold text-gray-500">
          <button onClick={() => setPage('leaderboard')} className="hover:text-orange-600">🏆 Leaderboard</button>
          {user && (
            <>
              <button onClick={() => setPage('dashboard')} className="hover:text-orange-600">📊 Dashboard</button>
              <button onClick={onLogout} className="text-red-500 hover:text-red-700">Logout</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}