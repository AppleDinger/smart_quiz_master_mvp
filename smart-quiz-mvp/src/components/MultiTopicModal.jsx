// src/components/MultiTopicModal.jsx
import React, { useState } from "react";

export default function MultiTopicModal({ isOpen, skills, onClose, onStart }) {
  const [numQuestions, setNumQuestions] = useState(5);
  const [customContext, setCustomContext] = useState("");
  const [includeDescriptive, setIncludeDescriptive] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(10);

  if (!isOpen || !skills) return null;

  const handleStart = () => {
    onStart({
      numQuestions,
      customContext,
      includeDescriptive,
      timerEnabled,
      timerDuration
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg border-t-8 border-orange-500 mx-4 animate-fade-in">
        <h2 className="text-xl md:text-2xl font-bold mb-4 text-gray-800">Setup Multi-Topic Quiz</h2>
        <p className="mb-6 text-gray-600">Covering {skills.length} topics.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Number of Questions</label>
            <input type="number" value={numQuestions} min="5" max="50" onChange={(e) => setNumQuestions(e.target.value)} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Focus Instructions (Optional)</label>
            <textarea rows="2" placeholder="e.g. Focus on edge cases..." value={customContext} onChange={(e) => setCustomContext(e.target.value)} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" />
          </div>
          
          <div className="flex flex-wrap gap-4 bg-orange-50 p-4 rounded-xl border border-orange-100">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700 text-sm">
              <input type="checkbox" checked={includeDescriptive} onChange={e => setIncludeDescriptive(e.target.checked)} className="w-4 h-4 text-orange-500 rounded" />
              Written Answers
            </label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700 text-sm">
                <input type="checkbox" checked={timerEnabled} onChange={e => setTimerEnabled(e.target.checked)} className="w-4 h-4 text-orange-500 rounded" />
                Timer
              </label>
              {timerEnabled && <input type="number" value={timerDuration} onChange={e => setTimerDuration(e.target.value)} className="w-16 p-1 border rounded text-center text-sm" placeholder="Min" />}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="bg-gray-100 text-gray-700 font-bold py-2 px-5 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={handleStart} className="bg-orange-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-orange-600 transition-colors shadow-md">
            Start Quiz
          </button>
        </div>
      </div>
    </div>
  );
}