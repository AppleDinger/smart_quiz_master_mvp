// src/components/Leaderboard.jsx
import React, { useEffect, useState } from "react";

// ✅ ADD apiBase to props here
export default function Leaderboard({ onClose, apiBase }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [period, setPeriod] = useState("all");

  async function loadLeaderboard(selectedPeriod = "all") {
    setLoading(true);
    setError(null);
    try {
      // ✅ USE apiBase INSTEAD OF LOCALHOST
      // Ensure we handle the case where apiBase might have a trailing slash or not
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
    // Only load if we have a valid URL
    if (apiBase) {
      loadLeaderboard(period);
    } else {
      setError("Configuration Error: Missing Backend URL");
      setLoading(false);
    }
  }, [period, apiBase]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Leaderboard</h2>
          <p className="text-sm text-gray-600">Top performers (based on saved quiz attempts)</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="p-2 border rounded-md bg-white"
            aria-label="Select period"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="1d">Last 24 hours</option>
          </select>
          <button
            onClick={() => loadLeaderboard(period)}
            className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Refresh
          </button>
          {onClose && (
            <button onClick={onClose} className="px-3 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Close</button>
          )}
        </div>
      </div>

      {loading && <p className="text-gray-600">Loading leaderboard...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <>
          {rows.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-600">No leaderboard data yet.</p>
              <p className="text-xs text-gray-400 mt-1">Complete a quiz to appear here!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-sm text-gray-500 border-b">
                    <th className="py-2">Rank</th>
                    <th className="py-2">User</th>
                    <th className="py-2">Score</th>
                    <th className="py-2">Questions</th>
                    <th className="py-2">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.username} className="border-t hover:bg-gray-50">
                      <td className="py-3 text-sm font-medium w-12 pl-2">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </td>
                      <td className="py-3 text-sm font-semibold text-gray-800">{r.username}</td>
                      <td className="py-3 text-sm text-indigo-600 font-bold">{r.totalCorrect ?? 0}</td>
                      <td className="py-3 text-sm text-gray-600">{r.totalQuestions ?? 0}</td>
                      <td className="py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          (r.accuracy || 0) > 80 ? 'bg-green-100 text-green-800' : 
                          (r.accuracy || 0) > 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
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