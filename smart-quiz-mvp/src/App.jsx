import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Auth from './components/Auth';
import Leaderboard from './components/Leaderboard';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import DashboardComponent from './pages/Dashboard'; // You need to move your DashboardComponent code to src/pages/Dashboard.jsx
import { saveAttempt } from './api';

const USERS_DB_KEY = "smartQuizUsers";
const SKILLS_DB_PREFIX = "smartQuizSkills_";
const API_BASE_URL = "https://smart-quiz-master-x55k.onrender.com";

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('home');
  const [skills, setSkills] = useState({});
  const [quizData, setQuizData] = useState(null);
  const [quizSettings, setQuizSettings] = useState({});
  const [lastSummary, setLastSummary] = useState(null);

  // --- Auth Logic ---
  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) handleLogin(savedUser);
  }, []);

  const handleLogin = (username) => {
    const u = { username };
    setUser(u);
    localStorage.setItem("currentUser", username);
    const savedSkills = localStorage.getItem(`${SKILLS_DB_PREFIX}${username}`);
    setSkills(savedSkills ? JSON.parse(savedSkills) : {});
    setPage('home');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("currentUser");
    setPage('home');
  };

  // --- Quiz Logic ---
  const handleStartQuiz = (data, settings) => {
    setQuizData(data);
    setQuizSettings(settings);
    setPage('quiz');
  };

  const handleFinishQuiz = (results) => {
    const correctCount = results.filter(r => r.isCorrect).length;
    saveAttempt(user.username, correctCount, results.length);
    setLastSummary({ category: quizData.category, results });
    setQuizData(null);
    setPage('dashboard');
  };

  const handleUpdateSkills = (topicTags, isCorrect) => {
    setSkills(prev => {
      const next = { ...prev };
      topicTags.forEach(tag => {
        const t = tag.toLowerCase();
        const old = next[t] || { score: 0.5 };
        const change = isCorrect ? 0.1 : -0.1;
        next[t] = { ...old, score: Math.max(0, Math.min(1, old.score + change)) };
      });
      localStorage.setItem(`${SKILLS_DB_PREFIX}${user.username}`, JSON.stringify(next));
      return next;
    });
  };

  // --- Render ---
  if (!user) return <Auth onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-orange-50 font-sans text-gray-800 pb-10">
      <Navbar user={user} setPage={setPage} onLogout={handleLogout} />
      <main className="container mx-auto p-4 md:p-8 max-w-5xl">
        {page === 'home' && <Home user={user} onStartQuiz={handleStartQuiz} />}
        {page === 'quiz' && <Quiz data={quizData} settings={quizSettings} onFinish={handleFinishQuiz} onUpdateSkills={handleUpdateSkills} />}
        {page === 'dashboard' && <DashboardComponent skills={skills} lastQuizSummary={lastSummary} onStartNew={() => setPage('home')} />}
        {page === 'leaderboard' && <Leaderboard onClose={() => setPage('dashboard')} apiBase={API_BASE_URL} />}
      </main>
    </div>
  );
}

export default App;