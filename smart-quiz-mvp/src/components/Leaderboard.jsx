// src/components/Leaderboard.jsx
import React, { useEffect, useState } from "react";

export default function Leaderboard({ onClose, apiBase }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [period, setPeriod] = useState("all");
  // 1. New State for Sorting
  const [sortBy, setSortBy] = useState("score"); // 'score' or 'accuracy'

  async function loadLeaderboard(selectedPeriod = "all") {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = apiBase.replace(/\/$/, ""); 
      const resp = await fetch(`${baseUrl}/api/leaderboard?period=${encodeURIComponent(selectedPeriod)}`);
      
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${resp.status}`);
      }
      
      const data = await resp.json();
      if (!data || !data.leaderboard) {
        setRows([]);
      } else {
        setRows(data.leaderboard);
      }
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
      setError(err.message || "Failed to fetch leaderboard");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (apiBase) {
      loadLeaderboard(period);
    } else {
      setError("Configuration Error: Missing Backend URL");
      setLoading(false);
    }
  }, [period, apiBase]);

  // 2. Logic to sort rows based on selection
  const getSortedRows = () => {
    // Create a copy to avoid mutating state directly
    const sorted = [...rows];
    if (sortBy === 'accuracy') {
      // Sort by Accuracy desc, then Score desc
      return sorted.sort((a, b) => {
        const accDiff = (b.accuracy || 0) - (a.accuracy || 0);
        if (accDiff !== 0) return accDiff;
        return (b.totalCorrect || 0) - (a.totalCorrect || 0);
      });
    } else {
      // Default: Sort by Score desc
      return sorted.sort((a, b) => (b.totalCorrect || 0) - (a.totalCorrect || 0));
    }
  };

  const displayRows = getSortedRows();

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border-t-8 border-orange-500 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🏆 Leaderboard</h2>
          <p className="text-sm text-gray-500">Top performers in the community</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
          >
            <option value="score">Rank by Score</option>
            <option value="accuracy">Rank by Accuracy</option>
          </select>

          {/* Time Dropdown */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="p-2 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="1d">Last 24 hours</option>
          </select>

          <button
            onClick={() => loadLeaderboard(period)}
            className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors"
            title="Refresh"
          >
            🔄
          </button>
          
          {onClose && (
            <button onClick={onClose} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-bold">
              Close
            </button>
          )}
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Loading rankings...</div>}
      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      {!loading && !error && (
        <>
          {displayRows.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <p className="text-gray-600">No leaderboard data yet.</p>
              <p className="text-xs text-gray-400 mt-1">Complete a quiz to appear here!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="py-3 pl-2">Rank</th>
                    <th className="py-3">User</th>
                    <th className="py-3 text-center">Score</th>
                    <th className="py-3 text-center">Attempts</th>
                    <th className="py-3 text-right pr-2">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {displayRows.map((r, i) => (
                    <tr key={r.username} className="border-b border-gray-50 hover:bg-orange-50 transition-colors">
                      <td className="py-4 pl-2 font-medium w-12">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </td>
                      <td className="py-4 font-bold text-gray-800">
                        {r.username}
                        {i === 0 && <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">MVP</span>}
                      </td>
                      <td className="py-4 text-center font-mono font-bold text-orange-600">
                        {r.totalCorrect ?? 0}
                      </td>
                      <td className="py-4 text-center text-gray-500">
                        {r.totalQuestions ?? 0}
                      </td>
                      <td className="py-4 text-right pr-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          (r.accuracy || 0) >= 80 ? 'bg-green-100 text-green-700' : 
                          (r.accuracy || 0) >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {r.accuracy ?? 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}