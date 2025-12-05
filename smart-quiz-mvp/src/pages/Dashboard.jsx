// src/pages/Dashboard.jsx
import React, { useState } from "react";
import TopicListCard from "../components/TopicListCard";

export default function Dashboard({ skills, lastQuizSummary, onDownloadQuiz, onSetupMultiQuiz }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuizSkills, setSelectedQuizSkills] = useState({});

  const skillEntries = Object.entries(skills)
    .filter(([skillName]) => skillName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const lastStats = lastQuizSummary ? lastQuizSummary.results.reduce((acc, r) => ({ 
    correct: acc.correct + (r.isCorrect ? 1 : 0), total: acc.total + 1 
  }), { correct: 0, total: 0 }) : null;

  const handleSelect = (name) => setSelectedQuizSkills(p => ({ ...p, [name]: !p[name] }));
  const selected = Object.keys(selectedQuizSkills).filter(k => selectedQuizSkills[k]);

  const totalSkills = skillEntries.length;
  const avgScore = totalSkills > 0 ? skillEntries.reduce((acc, [, d]) => acc + (d.score || 0), 0) / totalSkills : 0;
  
  // Logic to separate strong vs weak topics
  const strong = skillEntries.filter(([, d]) => d.score >= 0.6).sort(([, a], [, b]) => b.score - a.score);
  const weak = skillEntries.filter(([, d]) => d.score <= 0.5).sort(([, a], [, b]) => a.score - b.score);

  if (skillEntries.length === 0 && !lastQuizSummary) return (
    <div className="bg-white p-8 rounded-xl shadow-lg text-center border-t-4 border-orange-400 mx-4">
      <h2 className="text-3xl font-bold mb-4 text-gray-800">Your Dashboard</h2>
      <p className="text-gray-600">Complete your first quiz to see your stats appear here!</p>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6 mx-2 md:mx-0">
      {/* Last Quiz Summary Card */}
      {lastQuizSummary && (
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-orange-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Last Quiz</h2>
            <p className="text-gray-600 font-medium truncate max-w-xs">{lastQuizSummary.category}</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="text-right">
              <div className="text-3xl font-black text-orange-600">{lastStats.correct}/{lastStats.total}</div>
              <div className="text-xs text-gray-500 font-bold uppercase">Score</div>
            </div>
            <button onClick={onDownloadQuiz} className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-bold hover:bg-orange-200 transition-colors">
              Download PDF
            </button>
          </div>
        </div>
      )}

      {/* Main Stats Area */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Skill Dashboard</h2>
        <input 
          className="w-full p-4 border rounded-xl mb-6 bg-gray-50 focus:ring-2 focus:ring-orange-300 outline-none transition-all" 
          placeholder="🔍 Search your skills..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
        />
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-orange-50 p-4 rounded-xl text-center border border-orange-100">
            <div className="text-4xl font-black text-orange-500">{Math.round(avgScore * 100)}%</div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mastery</div>
          </div>
          <div className="bg-gray-100 p-4 rounded-xl text-center border border-gray-200">
            <div className="text-4xl font-black text-gray-700">{totalSkills}</div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Skills</div>
          </div>
        </div>

        {/* The Expandable Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TopicListCard title="Strong Topics" topics={strong} bgColor="bg-green-50" textColor="text-green-800" icon="💪" />
          <TopicListCard title="Needs Focus" topics={weak} bgColor="bg-red-50" textColor="text-red-800" icon="🧠" />
        </div>

        {/* Multi-Topic Builder Section */}
        <div className="border-t pt-6">
          <h3 className="text-xl font-bold mb-2 text-gray-800">Multi-Topic Builder</h3>
          <p className="text-sm text-gray-500 mb-4">Select skills below to generate a combined quiz.</p>
          
          <div className="flex flex-wrap gap-2 mb-6 max-h-48 overflow-y-auto p-2 border rounded-lg">
            {skillEntries.map(([n]) => (
              <button 
                key={n} 
                onClick={() => handleSelect(n)} 
                className={`px-3 py-1 rounded-full text-sm border transition-all ${
                  selectedQuizSkills[n] 
                    ? "bg-orange-500 text-white border-orange-500 shadow-md transform scale-105" 
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {n}
              </button>
            ))}
            {skillEntries.length === 0 && <span className="text-gray-400 italic text-sm">No skills found.</span>}
          </div>
          
          <button 
            onClick={() => onSetupMultiQuiz(selected)} 
            disabled={!selected.length} 
            className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            Generate Quiz ({selected.length} Topics)
          </button>
        </div>
      </div>
    </div>
  );
}