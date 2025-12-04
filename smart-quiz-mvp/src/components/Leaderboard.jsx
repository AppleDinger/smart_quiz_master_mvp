// src/components/Leaderboard.jsx
import React, { useEffect, useState } from "react";

export default function Leaderboard({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [period, setPeriod] = useState("all"); // UI only; backend may ignore

  async function loadLeaderboard(selectedPeriod = "all") {
    setLoading(true);
    setError(null);
    try {
      // backend expects: GET /api/leaderboard
      // pass period as query param just in case your backend supports it later
      const resp = await fetch(`http://localhost:4000/api/leaderboard?period=${encodeURIComponent(selectedPeriod)}`);
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
    loadLeaderboard(period);
  }, [period]);

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
            <p className="text-gray-600">No leaderboard data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-sm text-gray-500">
                    <th className="py-2">#</th>
                    <th className="py-2">User</th>
                    <th className="py-2">Score</th>
                    <th className="py-2">Questions</th>
                    <th className="py-2">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.username} className="border-t">
                      <td className="py-3 text-sm font-medium w-12">{i + 1}</td>
                      <td className="py-3 text-sm">{r.username}</td>
                      <td className="py-3 text-sm">{r.totalCorrect ?? 0}</td>
                      <td className="py-3 text-sm">{r.totalQuestions ?? 0}</td>
                      <td className="py-3 text-sm">{(r.accuracy ?? 0) + "%"}</td>
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
