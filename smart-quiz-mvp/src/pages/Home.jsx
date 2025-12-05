import React, { useState } from "react";
import { extractPdf, extractYoutube, generateQuiz } from "../api";

const BTECH_SUBJECTS = ["Data Structures", "Operating Systems", "DBMS", "Computer Networks", "OOP", "React.js", "Node.js", "Custom"];

export default function Home({ user, onStartQuiz }) {
  const [source, setSource] = useState("subject");
  const [selectedSubject, setSelectedSubject] = useState(BTECH_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [pdf, setPdf] = useState(null);
  const [url, setUrl] = useState("");
  const [numQuestions, setNum] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [includeDescriptive, setDescriptive] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [duration, setDuration] = useState(10);
  const [context, setContext] = useState("");

  const handleGenerate = async () => {
    setLoading(true); setError(null);
    try {
      let category = "", txt = null;
      if (source === "subject") category = selectedSubject === "Custom" ? customSubject : selectedSubject;
      else if (source === "pdf") { if (!pdf) throw new Error("Upload PDF"); category = `PDF: ${pdf.name}`; txt = await extractPdf(pdf); }
      else if (source === "youtube") { if (!url) throw new Error("Enter URL"); category = `YouTube`; txt = await extractYoutube(url); }

      if (!category) throw new Error("Please select a topic.");

      const data = await generateQuiz({ 
        category, difficulty: "medium", numQuestions, includeDescriptive, customContext: context, sourceText: txt 
      });
      
      onStartQuiz(data, { timerEnabled, duration });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in mx-2 md:mx-0">
      <h1 className="text-4xl font-black text-center text-gray-800">Welcome, <span className="text-orange-500">{user.username}</span>!</h1>
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <h2 className="text-2xl font-bold mb-6">🚀 Start Quiz</h2>
        
        {/* Source Selection Buttons */}
        <div className="mb-6 flex gap-2">
          {["subject", "pdf", "youtube"].map(s => (
            <button 
              key={s} 
              onClick={() => s !== "youtube" && setSource(s)} 
              title={s === "youtube" ? "Feature temporarily unavailable due to YouTube Policy" : ""}
              className={`px-4 py-2 rounded-lg font-bold capitalize transition-all
                ${s === "youtube" 
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200" // Grayed out style
                  : source === s ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}
              `}
            >
              {s} {s === "youtube" && "🚫"}
            </button>
          ))}
        </div>

        {/* Source Inputs */}
        {source === "subject" && (
          <div className="mb-4">
            <select className="w-full p-4 border rounded-xl bg-white mb-2 focus:ring-2 focus:ring-orange-300 outline-none" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>{BTECH_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
            {selectedSubject === "Custom" && <input className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" placeholder="Enter topic..." value={customSubject} onChange={e => setCustomSubject(e.target.value)} />}
          </div>
        )}
        {source === "pdf" && (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 mb-4 hover:border-orange-400 transition-colors">
            <input type="file" className="hidden" id="pdf-input" onChange={e => setPdf(e.target.files[0])} accept="application/pdf" />
            <label htmlFor="pdf-input" className="cursor-pointer font-bold text-gray-600 hover:text-orange-500 flex flex-col items-center">
              <span className="text-2xl mb-2">📄</span>
              {pdf ? pdf.name : "Click to Upload PDF"}
            </label>
          </div>
        )}
        {source === "youtube" && (
          <div className="p-6 bg-gray-50 border rounded-xl mb-4 text-center text-gray-500 italic">
            YouTube extraction is currently disabled on the public server. Please use Subject or PDF mode.
          </div>
        )}
        
        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Questions</label>
            <input type="number" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" value={numQuestions} onChange={e => setNum(e.target.value)} placeholder="5" min="1" max="50" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Context</label>
            <textarea rows="1" className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" placeholder="Optional focus..." value={context} onChange={e => setContext(e.target.value)} />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-4 bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6">
          <label className="flex items-center gap-2 font-bold text-gray-700 text-sm cursor-pointer"><input type="checkbox" checked={includeDescriptive} onChange={e => setDescriptive(e.target.checked)} className="w-4 h-4 accent-orange-500" /> Written Answers</label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 font-bold text-gray-700 text-sm cursor-pointer"><input type="checkbox" checked={timerEnabled} onChange={e => setTimerEnabled(e.target.checked)} className="w-4 h-4 accent-orange-500" /> Timer</label>
            {timerEnabled && <input type="number" className="w-16 p-1 border rounded text-center text-sm" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Min" />}
          </div>
        </div>

        {error && <div className="text-red-500 mb-4 text-center font-bold bg-red-50 p-3 rounded-lg">{error}</div>}
        
        <button onClick={handleGenerate} disabled={loading} className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-black py-4 rounded-xl text-xl shadow-lg hover:to-red-700 disabled:opacity-50 transform transition active:scale-[0.99]">
          {loading ? "Generating..." : "Start Quiz"}
        </button>
      </div>
    </div>
  );
}