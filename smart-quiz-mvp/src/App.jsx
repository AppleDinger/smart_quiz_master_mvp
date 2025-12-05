// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Leaderboard from './components/Leaderboard';

// --- Config & constants ---
const API_BASE_URL = "https://smart-quiz-master-x55k.onrender.com";

const USERS_DB_KEY = "smartQuizUsers";
const SKILLS_DB_PREFIX = "smartQuizSkills_";

const SKILL_INIT_SCORE = 0.5;
const SKILL_INIT_DAYS = 1;
const SKILL_EASY_BONUS = 2.0;
const SKILL_HARD_PENALTY = 0.5;

const BTECH_SUBJECTS = [
  'Data Structures & Algorithms', 'Operating Systems', 'Database Management Systems (DBMS)',
  'Computer Networks', 'Object-Oriented Programming (OOP)', 'Digital Logic Design',
  'Computer Organization & Architecture', 'Theory of Computation', 'Compiler Design',
  'Software Engineering', 'Machine Learning', 'Artificial Intelligence',
  'Web Development (HTML/CSS/JS)', 'React.js', 'Node.js', 'Calculus & Linear Algebra',
  'Probability & Statistics', 'Discrete Mathematics', 'Physics for Engineers',
  'Chemistry for Engineers', 'Custom'
];

// --- Helper Functions ---
function updateSkill(skillRecord, score) {
  const oldScore = skillRecord?.score ?? SKILL_INIT_SCORE;
  const oldDays = skillRecord?.intervalDays ?? SKILL_INIT_DAYS;
  const now = new Date();
  let newScore = oldScore;
  let newDays = oldDays;

  if (score > 0.8) {
    newScore = oldScore + (1 - oldScore) * 0.1;
    newDays = oldDays * SKILL_EASY_BONUS;
  } else if (score < 0.3) {
    newScore = oldScore - oldScore * 0.1;
    newDays = oldDays * SKILL_HARD_PENALTY;
  }

  const nextReview = new Date(now.getTime() + newDays * 24 * 60 * 60 * 1000);
  return {
    score: newScore,
    intervalDays: newDays,
    nextReview: nextReview.toISOString(),
    lastAnswered: now.toISOString(),
  };
}

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) console.error("VITE_GEMINI_API_KEY not found.");
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// --- Backend helpers ---
async function extractPdfFromServer(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/api/extract/pdf`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('PDF extraction failed');
  const data = await res.json();
  return data.text || '';
}

async function extractYoutubeFromServer(url) {
  const res = await fetch(`${API_BASE_URL}/api/extract/youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error('YouTube extraction failed');
  const data = await res.json();
  return data.transcript || '';
}

async function generateQuizFromAI(category, difficulty, numQuestions, includeDescriptive, customContext, sourceText = null, skillList = []) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, difficulty, numQuestions, includeDescriptive, customContext, sourceText, skillList }),
    });
    if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);
    const data = await response.json();
    if (data.quizData?.questions) {
      data.quizData.questions.forEach((q, index) => { q.id = `q_${Date.now()}_${index + 1}`; });
    }
    return data.quizData;
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw new Error("Quiz generation failed. Please check your connection.");
  }
}

// --- NEW COMPONENT: Expandable Topic List ---
const TopicListCard = ({ title, topics, bgColor, textColor, icon }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleTopics = expanded ? topics : topics.slice(0, 5);
  const hiddenCount = topics.length - 5;

  return (
    <div className={`p-5 rounded-xl ${bgColor} shadow-sm border border-opacity-50 transition-all duration-300`}>
      <h3 className={`font-bold text-lg mb-3 ${textColor} flex justify-between items-center`}>
        <span>{icon} {title}</span>
        <span className="text-sm opacity-70 bg-white bg-opacity-50 px-2 py-1 rounded-full">{topics.length}</span>
      </h3>
      
      {topics.length === 0 ? (
        <p className="text-sm opacity-70 italic pl-1">No data available yet.</p>
      ) : (
        <ul className="space-y-2">
          {visibleTopics.map(([name, data]) => (
            <li key={name} className="flex justify-between items-center text-gray-700 font-medium text-sm md:text-base border-b border-black/5 pb-1 last:border-0">
              <span className="capitalize truncate pr-2">{name}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${data.score > 0.6 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {Math.round(data.score * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {topics.length > 5 && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className={`w-full mt-3 text-xs font-bold uppercase tracking-wide py-2 rounded-lg transition-colors ${textColor} hover:bg-white hover:bg-opacity-50`}
        >
          {expanded ? "Show Less" : `Show ${hiddenCount} More`}
        </button>
      )}
    </div>
  );
};

// --- Dashboard Component ---
function DashboardComponent({ skills, lastQuizSummary, onDownloadQuiz, onSetupMultiQuiz }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuizSkills, setSelectedQuizSkills] = useState({});

  const skillEntries = Object.entries(skills)
    .filter(([skillName]) => skillName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const lastQuizStats = lastQuizSummary ? lastQuizSummary.results.reduce((acc, result) => {
    if (result.isCorrect) acc.correct += 1;
    acc.total += 1;
    return acc;
  }, { correct: 0, total: 0 }) : null;

  const handleSkillSelect = (skillName) => {
    setSelectedQuizSkills(prev => ({ ...prev, [skillName]: !prev[skillName] }));
  };

  const selectedSkillsArray = Object.keys(selectedQuizSkills).filter(k => selectedQuizSkills[k]);

  if (Object.keys(skills).length === 0 && !lastQuizSummary) {
    return (
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg text-center border-t-4 border-orange-400 mx-4 md:mx-0">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-800">Your Skill Dashboard</h2>
        <p className="text-gray-600 text-base md:text-lg">Complete your first quiz to see your stats here!</p>
      </div>
    );
  }

  const totalSkills = skillEntries.length;
  const averageScore = totalSkills > 0
    ? skillEntries.reduce((acc, [, data]) => acc + (data.score || 0), 0) / totalSkills
    : 0;
  
  // Sorting logic
  const strongTopics = skillEntries.filter(([, data]) => data.score >= 0.6).sort(([, a], [, b]) => b.score - a.score);
  const weakTopics = skillEntries.filter(([, data]) => data.score <= 0.5).sort(([, a], [, b]) => a.score - b.score);

  return (
    <>
      {lastQuizSummary && (
        <div className="bg-white p-5 md:p-6 rounded-xl shadow-md mb-8 border-l-4 border-orange-500 mx-2 md:mx-0">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="w-full">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">Last Quiz Summary</h2>
              <p className="text-base md:text-lg text-gray-600 truncate max-w-md">
                Topic: <span className="font-semibold text-orange-600">{lastQuizSummary.category.split(':').pop().trim()}</span>
              </p>
            </div>
            <button onClick={onDownloadQuiz} className="w-full md:w-auto bg-orange-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-orange-600 shadow-md">
              Download Report
            </button>
          </div>
          {lastQuizStats && lastQuizStats.total > 0 && (
            <div className="mt-4 flex items-center gap-4 bg-orange-50 p-4 rounded-lg border border-orange-100">
              <div className="text-3xl md:text-4xl font-black text-orange-600">
                {lastQuizStats.correct}/{lastQuizStats.total}
              </div>
              <div className="text-sm">
                <p className="font-bold text-gray-700 uppercase">Score</p>
                <p className="text-gray-500">{Math.round((lastQuizStats.correct / lastQuizStats.total) * 100)}% Accuracy</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white p-5 md:p-6 rounded-xl shadow-lg mx-2 md:mx-0">
        <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-800 border-b pb-2 border-gray-100">Skill Dashboard</h2>
        <input
          type="text"
          placeholder="🔍 Search skills..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 md:p-4 border border-gray-200 rounded-xl mb-6 focus:ring-2 focus:ring-orange-300 outline-none bg-gray-50"
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl text-center border border-orange-100">
            <div className="text-4xl md:text-5xl font-black text-orange-500 mb-2">{Math.round(averageScore * 100)}%</div>
            <div className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wide">Overall Mastery</div>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl text-center border border-gray-200">
            <div className="text-4xl md:text-5xl font-black text-gray-700 mb-2">{totalSkills}</div>
            <div className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-wide">Skills Tracked</div>
          </div>
        </div>

        {/* Responsive Grid for Expandable Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TopicListCard 
            title="Strong Topics" 
            topics={strongTopics} 
            bgColor="bg-green-50" 
            textColor="text-green-800" 
            icon="💪"
          />
          <TopicListCard 
            title="Needs Focus" 
            topics={weakTopics} 
            bgColor="bg-red-50" 
            textColor="text-red-800" 
            icon="🧠"
          />
        </div>

        <div className="mt-8 pt-8 border-t border-gray-100">
          <h3 className="text-xl font-bold mb-2 text-gray-800">Multi-Topic Quiz Builder</h3>
          <p className="text-sm text-gray-500 mb-4">Select skills below to create a mixed quiz.</p>

          <div className="flex flex-wrap gap-2 mb-6 max-h-48 overflow-y-auto p-3 border border-gray-200 rounded-xl bg-gray-50">
            {skillEntries.map(([skillName]) => (
              <button
                key={`select_${skillName}`}
                onClick={() => handleSkillSelect(skillName)}
                className={`py-1.5 px-3 md:px-4 text-xs md:text-sm rounded-full capitalize transition-all shadow-sm duration-200 border
                  ${selectedQuizSkills[skillName] 
                    ? 'bg-orange-500 text-white border-orange-600 scale-105' 
                    : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500'}
                `}
              >
                {skillName}
              </button>
            ))}
            {skillEntries.length === 0 && <p className="text-gray-400 italic text-sm">No skills collected yet.</p>}
          </div>

          <button
            onClick={() => onSetupMultiQuiz(selectedSkillsArray)}
            disabled={selectedSkillsArray.length === 0}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-3 md:py-4 px-8 rounded-xl text-base md:text-lg hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform transition active:scale-[0.99]"
          >
            Generate Quiz ({selectedSkillsArray.length} Topics)
          </button>
        </div>
      </div>
    </>
  );
}

// --- Main App ---
function App() {
  const [user, setUser] = useState(null);
  const [skills, setSkills] = useState({});
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState(null);
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [quizResults, setQuizResults] = useState([]);
  const [lastQuizSummary, setLastQuizSummary] = useState(null);
  const [quizSource, setQuizSource] = useState('subject');
  const [pdfFile, setPdfFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(BTECH_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [includeDescriptive, setIncludeDescriptive] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(10);
  const [isQuizTimed, setIsQuizTimed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [multiQuizSkills, setMultiQuizSkills] = useState(null);
  const [isMultiQuizModalOpen, setIsMultiQuizModalOpen] = useState(false);

  const getUsers = () => JSON.parse(localStorage.getItem(USERS_DB_KEY) || "{}");

  const handleRegister = () => {
    if (!usernameInput || !passwordInput) { setAuthError("Required fields missing."); return; }
    const users = getUsers();
    if (users[usernameInput]) { setAuthError("Username taken."); return; }
    users[usernameInput] = passwordInput;
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
    handleLogin();
  };

  const handleLogin = () => {
    if (!usernameInput || !passwordInput) { setAuthError("Required fields missing."); return; }
    const users = getUsers();
    if (!users[usernameInput] || users[usernameInput] !== passwordInput) { setAuthError("Invalid credentials."); return; }
    const loggedInUser = { username: usernameInput };
    setUser(loggedInUser);
    const savedSkills = localStorage.getItem(`${SKILLS_DB_PREFIX}${loggedInUser.username}`);
    setSkills(savedSkills ? JSON.parse(savedSkills) : {});
    setAuthError(null); setUsernameInput(""); setPasswordInput(""); setPage('home');
  };

  const handleLogout = () => { setUser(null); setSkills({}); setPage('home'); };
  
  useEffect(() => {
    if (user?.username) localStorage.setItem(`${SKILLS_DB_PREFIX}${user.username}`, JSON.stringify(skills));
  }, [skills, user]);

  const finishQuiz = useCallback(() => {
    if (user && quizResults.length > 0) {
      fetch(`${API_BASE_URL}/api/save-attempt`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, correct: quizResults.filter(r => r.isCorrect).length, numQuestions: quizResults.length })
      }).catch(console.error);
    }
    if (quizData) setLastQuizSummary({ category: quizData.category, results: quizResults });
    setQuizData(null); setQuizResults([]); setIsQuizTimed(false); setMultiQuizSkills(null); setPage('dashboard');
  }, [quizData, quizResults, user]);

  useEffect(() => {
    if (page !== 'quiz' || !isQuizTimed || !!feedback) return;
    if (timeLeft <= 0) { finishQuiz(); return; }
    const interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, isQuizTimed, page, feedback, finishQuiz]);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleStartQuiz = useCallback(async (multi = null) => {
    setLoading(true); setError(null); setQuizResults([]); setLastQuizSummary(null); setIsMultiQuizModalOpen(false);
    const qCount = Math.max(5, Math.min(50, Number(numQuestions) || 5));
    let cat = '', txt = null, skills = [];
    try {
      if (multi && multi.length) { skills = multi; cat = `Multi-Topic: ${skills.join(', ')}`; }
      else if (quizSource === 'subject') { cat = selectedSubject === 'Custom' ? customSubject : selectedSubject; if (!cat) throw new Error("Select subject."); }
      else if (quizSource === 'pdf') { if (!pdfFile) throw new Error("Upload PDF."); cat = `PDF: ${pdfFile.name}`; txt = await extractPdfFromServer(pdfFile); if (!txt || txt.length < 150) throw new Error("PDF unreadable."); }
      else if (quizSource === 'youtube') { if (!youtubeUrl) throw new Error("Enter URL."); cat = `YouTube`; txt = await extractYoutubeFromServer(youtubeUrl); }
      
      const data = await generateQuizFromAI(cat, 'medium', qCount, includeDescriptive, customContext, txt, skills);
      if (!data?.questions?.length) throw new Error("AI gen failed.");
      setQuizData(data); setCurrentQIndex(0); setFeedback(null); setSelectedAnswer('');
      if (timerEnabled) { setIsQuizTimed(true); setTimeLeft(timerDuration * 60); } else { setIsQuizTimed(false); setTimeLeft(0); }
      setPage('quiz');
    } catch (e) { setError(e.message || 'Error'); setMultiQuizSkills(null); }
    setLoading(false);
  }, [quizSource, selectedSubject, customSubject, pdfFile, youtubeUrl, numQuestions, includeDescriptive, timerEnabled, timerDuration, customContext]);

  const handleSubmitAnswer = useCallback(() => {
    if (!quizData) return;
    const q = quizData.questions[currentQIndex];
    const isCorrect = (selectedAnswer || '').trim().toLowerCase() === (q.answer || '').trim().toLowerCase();
    const result = { prompt: q.prompt, type: q.type, choices: q.choices, userAnswer: selectedAnswer, correctAnswer: q.answer, explanation: q.explanation, isCorrect };
    setQuizResults(p => [...p, result]);
    setSkills(prev => {
      const next = { ...prev };
      (q.skills?.length ? q.skills : [String(quizData.category).toLowerCase()]).forEach(s => next[s] = updateSkill(next[s], isCorrect ? 1 : 0));
      return next;
    });
    setFeedback({ score: isCorrect ? 1 : 0, explanation: q.explanation });
  }, [quizData, currentQIndex, selectedAnswer]);

  const handleNextQuestion = useCallback(() => {
    if (currentQIndex < quizData.questions.length - 1) { setCurrentQIndex(i => i + 1); setFeedback(null); setSelectedAnswer(''); } else finishQuiz();
  }, [currentQIndex, quizData, finishQuiz]);

  const handleDownloadQuiz = useCallback(() => {
    if (!lastQuizSummary) return;
    const doc = new jsPDF();
    let y = 15; const w = doc.internal.pageSize.getWidth() - 20;
    doc.setFontSize(16); doc.text(`Summary: ${lastQuizSummary.category}`, 10, y); y+=10;
    lastQuizSummary.results.forEach((r, i) => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFontSize(12); doc.text(`Q${i+1}: ${r.prompt}`, 10, y, { maxWidth: w }); y+=15;
      doc.setFontSize(10); doc.text(`Your Ans: ${r.userAnswer} | Correct: ${r.correctAnswer}`, 10, y, { maxWidth: w }); y+=10;
    });
    doc.save('summary.pdf');
  }, [lastQuizSummary]);

  const renderLogin = () => (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 text-center mb-8">Smart Quiz</h1>
        <div className="space-y-4">
          <input type="text" placeholder="Username" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-orange-400 outline-none" />
          <input type="password" placeholder="Password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-orange-400 outline-none" />
          {authError && <p className="text-red-500 text-center text-sm">{authError}</p>}
          <div className="flex gap-3">
            <button onClick={handleLogin} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 shadow-md">Login</button>
            <button onClick={handleRegister} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200">Register</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderQuiz = () => {
    if (!quizData) return null;
    const q = quizData.questions[currentQIndex];
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <span className="bg-orange-100 text-orange-700 px-4 py-1 rounded-full text-sm font-bold truncate">{quizData.category}</span>
          {isQuizTimed && <div className="text-2xl font-mono font-bold">{formatTime(timeLeft)}</div>}
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-xl border-t-8 border-orange-500">
          <h2 className="text-2xl font-bold mb-8 text-gray-800">{currentQIndex + 1}/{quizData.questions.length}. {q.prompt}</h2>
          <div className="space-y-4">
            {q.type === 'mcq' ? q.choices.map((c, i) => (
              <label key={i} className={`flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedAnswer === c ? 'bg-orange-50 border-orange-500' : 'hover:bg-gray-50'}`}>
                <input type="radio" name={q.id} value={c} checked={selectedAnswer === c} onChange={e => !feedback && setSelectedAnswer(e.target.value)} disabled={!!feedback} className="hidden" />
                <span className={`w-8 h-8 flex items-center justify-center rounded-full mr-4 font-bold ${selectedAnswer === c ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}>{['A','B','C','D'][i]}</span>
                <span className="text-lg">{c}</span>
              </label>
            )) : <textarea value={selectedAnswer} onChange={e => !feedback && setSelectedAnswer(e.target.value)} disabled={!!feedback} className="w-full p-4 border-2 rounded-xl focus:border-orange-400 outline-none" />}
          </div>
          {!feedback && <button onClick={handleSubmitAnswer} disabled={!selectedAnswer} className="mt-8 w-full bg-gray-800 text-white font-bold py-4 rounded-xl hover:bg-black">Submit</button>}
        </div>
        {feedback && (
          <div className={`mt-6 p-6 rounded-2xl shadow-lg border-l-8 ${feedback.score > 0 ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <h3 className="font-black text-2xl mb-2">{feedback.score > 0 ? '🎉 Correct!' : '❌ Incorrect'}</h3>
            <p className="text-lg opacity-90">{feedback.explanation}</p>
            <button onClick={handleNextQuestion} className="mt-6 bg-gray-800 text-white font-bold py-3 px-8 rounded-xl hover:bg-black">Next ➡</button>
          </div>
        )}
      </div>
    );
  };

  const renderHome = () => (
    <div className="space-y-8 animate-fade-in mx-2 md:mx-0">
      <h1 className="text-4xl font-black text-center text-gray-800">Welcome, <span className="text-orange-500">{user.username}</span>!</h1>
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <h2 className="text-2xl font-bold mb-6">🚀 Start Quiz</h2>
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {['subject', 'pdf', 'youtube'].map(s => (
            <button key={s} onClick={() => setQuizSource(s)} className={`px-6 py-3 rounded-lg font-bold capitalize ${quizSource === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
          ))}
        </div>
        {quizSource === 'subject' && <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full p-4 border rounded-xl mb-4 bg-white">{BTECH_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select>}
        {quizSource === 'pdf' && <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files[0])} className="w-full p-4 border border-dashed rounded-xl mb-4" />}
        {quizSource === 'youtube' && <input type="text" placeholder="YouTube URL" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} className="w-full p-4 border rounded-xl mb-4" />}
        <button onClick={() => handleStartQuiz()} disabled={loading} className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-black py-4 rounded-xl text-xl shadow-lg hover:to-red-700 disabled:opacity-50">
          {loading ? 'Generating...' : 'Start Quiz'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 font-sans text-gray-800 pb-10">
      <nav className="bg-white shadow-sm border-b border-orange-100 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <button onClick={() => setPage('home')} className="text-2xl font-black flex gap-2 items-center"><span className="text-3xl">🧠</span><span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">SmartQuiz</span></button>
          <div className="flex gap-4 text-sm font-bold text-gray-500">
            <button onClick={() => setPage('leaderboard')} className="hover:text-orange-600">🏆 Leaderboard</button>
            {user && <><button onClick={() => setPage('dashboard')} className="hover:text-orange-600">📊 Dashboard</button><button onClick={handleLogout} className="text-red-500 hover:text-red-700">Logout</button></>}
          </div>
        </div>
      </nav>
      <main className="container mx-auto p-4 md:p-8 max-w-5xl">
        {!user ? renderLogin() : (page === 'quiz' ? renderQuiz() : page === 'dashboard' ? <DashboardComponent skills={skills} lastQuizSummary={lastQuizSummary} onDownloadQuiz={handleDownloadQuiz} onSetupMultiQuiz={s => { setMultiQuizSkills(s); setIsMultiQuizModalOpen(true); }} /> : page === 'leaderboard' ? <Leaderboard onClose={() => setPage('dashboard')} apiBase={API_BASE_URL} /> : renderHome())}
      </main>
      {isMultiQuizModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-2xl w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-4">Multi-Topic Quiz</h2>
            <div className="flex justify-end gap-3 mt-6"><button onClick={() => setIsMultiQuizModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button><button onClick={() => handleStartQuiz(multiQuizSkills)} className="px-4 py-2 bg-orange-500 text-white rounded-lg">Start</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;