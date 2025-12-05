import React, { useState } from 'react';
import { extractPdf, extractYoutube, generateQuiz } from '../api';

const SUBJECTS = ['Data Structures', 'Operating Systems', 'DBMS', 'Computer Networks', 'OOP', 'React.js', 'Node.js', 'Custom'];

export default function Home({ user, onStartQuiz }) {
  const [source, setSource] = useState('subject');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [pdf, setPdf] = useState(null);
  const [url, setUrl] = useState('');
  const [numQuestions, setNum] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Settings
  const [includeDescriptive, setDescriptive] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [duration, setDuration] = useState(10);
  const [context, setContext] = useState('');

  const handleGenerate = async () => {
    setLoading(true); setError(null);
    try {
      let category = '', txt = null;
      if (source === 'subject') category = subject === 'Custom' ? customSubject : subject;
      else if (source === 'pdf') { if (!pdf) throw new Error("Upload PDF"); category = `PDF: ${pdf.name}`; txt = await extractPdf(pdf); }
      else if (source === 'youtube') { if (!url) throw new Error("Enter URL"); category = `YouTube`; txt = await extractYoutube(url); }

      const data = await generateQuiz({ 
        category, difficulty: 'medium', numQuestions, includeDescriptive, customContext: context, sourceText: txt 
      });
      
      onStartQuiz(data, { timerEnabled, duration });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">🚀 Start Quiz</h2>
      <div className="flex gap-2 mb-6">
        {['subject', 'pdf', 'youtube'].map(s => (
          <button key={s} onClick={() => setSource(s)} className={`px-4 py-2 rounded-lg font-bold capitalize ${source === s ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}>{s}</button>
        ))}
      </div>

      {source === 'subject' && <select className="w-full p-3 border rounded-xl mb-4" value={subject} onChange={e => setSubject(e.target.value)}>{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select>}
      {source === 'subject' && subject === 'Custom' && <input className="w-full p-3 border rounded-xl mb-4" placeholder="Enter topic..." value={customSubject} onChange={e => setCustomSubject(e.target.value)} />}
      {source === 'pdf' && <input type="file" className="w-full p-3 border rounded-xl mb-4" onChange={e => setPdf(e.target.files[0])} />}
      {source === 'youtube' && <input className="w-full p-3 border rounded-xl mb-4" placeholder="YouTube URL" value={url} onChange={e => setUrl(e.target.value)} />}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <input type="number" className="p-3 border rounded-xl" value={numQuestions} onChange={e => setNum(e.target.value)} placeholder="Questions" />
        <input className="p-3 border rounded-xl" placeholder="Context (Optional)" value={context} onChange={e => setContext(e.target.value)} />
      </div>

      <div className="flex gap-4 mb-6">
        <label className="flex items-center gap-2"><input type="checkbox" checked={includeDescriptive} onChange={e => setDescriptive(e.target.checked)} /> Written Answers</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={timerEnabled} onChange={e => setTimerEnabled(e.target.checked)} /> Timer</label>
        {timerEnabled && <input type="number" className="w-16 border rounded p-1" value={duration} onChange={e => setDuration(e.target.value)} />}
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}
      <button onClick={handleGenerate} disabled={loading} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl disabled:opacity-50">
        {loading ? 'Generating...' : 'Start Quiz'}
      </button>
    </div>
  );
}