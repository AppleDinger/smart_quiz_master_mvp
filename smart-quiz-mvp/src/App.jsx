// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Leaderboard from './components/Leaderboard';

// --- Config & constants ---

// ✅ Corrected URL (matches your real Render server)
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

// --- Skill update helper ---
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

// --- Initialize LLM client ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) console.error("VITE_GEMINI_API_KEY not found. LLM calls will fail if missing.");
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }) : null;

// --- Backend extraction helpers ---
async function extractPdfFromServer(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/api/extract/pdf`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }));
    throw new Error(err.error || 'PDF extraction failed');
  }
  const data = await res.json();
  return data.text || '';
}

async function extractYoutubeFromServer(url) {
  const res = await fetch(`${API_BASE_URL}/api/extract/youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }));
    throw new Error(err.error || 'YouTube extraction failed');
  }
  const data = await res.json();
  return data.transcript || '';
}

async function generateQuizFromAI(
  category, 
  difficulty, 
  numQuestions, 
  includeDescriptive,
  customContext,
  sourceText = null,
  skillList = []
) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        difficulty,
        numQuestions,
        includeDescriptive,
        customContext,
        sourceText,
        skillList
      }),
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.statusText}`);
    }

    const data = await response.json();
    const quizData = data.quizData;

    if (quizData.questions) {
      quizData.questions.forEach((q, index) => {
        q.id = `q_${Date.now()}_${index + 1}`;
      });
    }

    return quizData;
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw new Error("Quiz generation failed. Please check your connection.");
  }
}

// --- Components --- //

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
      <div className="bg-white p-8 rounded-xl shadow-lg text-center border-t-4 border-orange-400">
        <h2 className="text-3xl font-bold mb-4 text-gray-800">Your Skill Dashboard</h2>
        <p className="text-gray-600 text-lg">Complete your first quiz to see your stats here!</p>
      </div>
    );
  }

  const totalSkills = skillEntries.length;
  const averageScore = totalSkills > 0
    ? skillEntries.reduce((acc, [, data]) => acc + (data.score || 0), 0) / totalSkills
    : 0;
  const strongTopics = skillEntries.filter(([, data]) => data.score >= 0.6).sort(([, a], [, b]) => b.score - a.score);
  const weakTopics = skillEntries.filter(([, data]) => data.score <= 0.5).sort(([, a], [, b]) => a.score - b.score);

  const renderTopicList = (title, topics, bgColor, textColor) => (
    <div className={`p-5 rounded-xl ${bgColor} shadow-sm border border-opacity-50`}>
      <h3 className={`font-bold text-lg mb-3 ${textColor}`}>{title} ({topics.length})</h3>
      {topics.length === 0 ? (
        <p className="text-sm opacity-70 italic">None yet.</p>
      ) : (
        <ul className="list-disc list-inside space-y-2">
          {topics.slice(0, 5).map(([name, data]) => (
            <li key={name} className="capitalize text-gray-700 font-medium">
              {name} <span className="text-xs font-bold opacity-60 ml-1">({Math.round(data.score * 100)}%)</span>
            </li>
          ))}
          {topics.length > 5 && <li className="text-sm italic opacity-70 mt-2">...and {topics.length - 5} more</li>}
        </ul>
      )}
    </div>
  );

  return (
    <>
      {lastQuizSummary && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-8 border-l-4 border-orange-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Last Quiz Summary</h2>
              <p className="text-lg text-gray-600 truncate max-w-md" title={lastQuizSummary.category}>
                Topic: <span className="font-semibold text-orange-600">{lastQuizSummary.category.split(':').pop().trim()}</span>
              </p>
            </div>
            <button
              onClick={onDownloadQuiz}
              className="bg-orange-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-orange-600 transition-all shadow-md hover:shadow-lg"
            >
              Download PDF Report
            </button>
          </div>
          {lastQuizStats && lastQuizStats.total > 0 && (
            <div className="mt-4 flex items-center gap-4 bg-orange-50 p-4 rounded-lg border border-orange-100">
              <div className="text-4xl font-black text-orange-600">
                {lastQuizStats.correct}/{lastQuizStats.total}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 uppercase tracking-wider">Score</p>
                <p className="text-sm text-gray-500 font-medium">
                  {Math.round((lastQuizStats.correct / lastQuizStats.total) * 100)}% Accuracy
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2 border-gray-100">Your Skill Dashboard</h2>
        <input
          type="text"
          placeholder="🔍 Search your skills..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-4 border border-gray-200 rounded-xl mb-6 focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition-all outline-none bg-gray-50"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl text-center border border-orange-100">
            <div className="text-5xl font-black text-orange-500 mb-2">{Math.round(averageScore * 100)}%</div>
            <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">Overall Mastery</div>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl text-center border border-gray-200">
            <div className="text-5xl font-black text-gray-700 mb-2">{totalSkills}</div>
            <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">Skills Practiced</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {renderTopicList("💪 Strong Topics", strongTopics, "bg-green-50", "text-green-700")}
          {renderTopicList("🧠 Needs Focus", weakTopics, "bg-red-50", "text-red-700")}
        </div>

        <div className="mt-8 pt-8 border-t border-gray-100">
          <h3 className="text-xl font-bold mb-2 text-gray-800">Multi-Topic Quiz Builder</h3>
          <p className="text-sm text-gray-500 mb-4">Select multiple tags below to create a custom mixed quiz.</p>

          <div className="flex flex-wrap gap-2 mb-6 max-h-48 overflow-y-auto p-3 border border-gray-200 rounded-xl bg-gray-50">
            {skillEntries.map(([skillName]) => (
              <button
                key={`select_${skillName}`}
                onClick={() => handleSkillSelect(skillName)}
                className={`py-1.5 px-4 text-sm rounded-full capitalize transition-all shadow-sm duration-200 border
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
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-4 px-8 rounded-xl text-lg hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform transition active:scale-[0.99]"
          >
            Generate Quiz from {selectedSkillsArray.length} Selected Topics
          </button>
        </div>
      </div>
    </>
  );
}

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
    if (!usernameInput || !passwordInput) {
      setAuthError("Username and password are required.");
      return;
    }
    const users = getUsers();
    if (users[usernameInput]) {
      setAuthError("Username already taken.");
      return;
    }
    users[usernameInput] = passwordInput;
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
    handleLogin();
  };

  const handleLogin = () => {
    if (!usernameInput || !passwordInput) {
      setAuthError("Username and password are required.");
      return;
    }
    const users = getUsers();
    if (!users[usernameInput] || users[usernameInput] !== passwordInput) {
      setAuthError("Invalid credentials.");
      return;
    }
    const loggedInUser = { username: usernameInput };
    setUser(loggedInUser);
    const savedSkills = localStorage.getItem(`${SKILLS_DB_PREFIX}${loggedInUser.username}`);
    setSkills(savedSkills ? JSON.parse(savedSkills) : {});
    setAuthError(null);
    setUsernameInput("");
    setPasswordInput("");
    setPage('home');
  };

  // Handle Enter key for login
  const handleAuthKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  const handleLogout = () => {
    setUser(null);
    setSkills({});
    setPage('home');
  };

  useEffect(() => {
    if (user && user.username) {
      localStorage.setItem(`${SKILLS_DB_PREFIX}${user.username}`, JSON.stringify(skills));
    }
  }, [skills, user]);

  const finishQuiz = useCallback(() => {
    if (user && quizResults.length > 0) {
      fetch(`${API_BASE_URL}/api/save-attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          correct: quizResults.filter(r => r.isCorrect).length,
          numQuestions: quizResults.length
        })
      }).catch(err => console.error("Save attempt failed", err));
    }

    if (quizData) {
      setLastQuizSummary({ category: quizData.category, results: quizResults });
    }
    setQuizData(null);
    setQuizResults([]);
    setIsQuizTimed(false);
    setMultiQuizSkills(null);
    setPage('dashboard');
  }, [quizData, quizResults, user]);

  useEffect(() => {
    if (page !== 'quiz' || !isQuizTimed || !!feedback) return;
    if (timeLeft <= 0) {
      finishQuiz();
      return;
    }
    const intervalId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(intervalId);
  }, [timeLeft, isQuizTimed, page, feedback, finishQuiz]);

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSetupMultiQuiz = (selectedSkills) => {
    if (!selectedSkills || selectedSkills.length === 0) return;
    setMultiQuizSkills(selectedSkills);
    setIsMultiQuizModalOpen(true);
    setNumQuestions(5);
    setTimerEnabled(false);
    setIncludeDescriptive(false);
    setCustomContext('');
    setPdfFile(null);
    setYoutubeUrl('');
    setQuizSource('multi');
  };

  const handleStartQuiz = useCallback(async (multiTopicSkills = null) => {
    setLoading(true);
    setError(null);
    setQuizResults([]);
    setLastQuizSummary(null);
    setIsMultiQuizModalOpen(false);

    const questionCount = Math.max(5, Math.min(50, Number(numQuestions) || 5));
    let category = '';
    let sourceText = null;
    let skillList = [];

    try {
      if (multiTopicSkills && multiTopicSkills.length > 0) {
        skillList = multiTopicSkills;
        category = `Multi-Topic Quiz: ${skillList.join(', ')}`;
      } else if (quizSource === 'subject') {
        category = selectedSubject === 'Custom' ? customSubject : selectedSubject;
        if (!category) throw new Error("Please select a subject or enter a custom topic.");
      } else if (quizSource === 'pdf') {
        if (!pdfFile) throw new Error("Please upload a PDF file.");
        category = `PDF: ${pdfFile.name}`;
        sourceText = await extractPdfFromServer(pdfFile);
        if (!sourceText || sourceText.trim().length < 150) {
          setError("The uploaded PDF does not contain readable text. Try another PDF.");
          setLoading(false);
          return;
        }
      } else if (quizSource === 'youtube') {
        if (!youtubeUrl) throw new Error("Please paste a YouTube URL.");
        category = `YouTube: ${youtubeUrl.substring(0, 60)}...`;
        sourceText = await extractYoutubeFromServer(youtubeUrl);
      }

      const data = await generateQuizFromAI(
        category, 'medium', questionCount, includeDescriptive,
        customContext, sourceText, skillList
      );

      if (!data || !data.questions || data.questions.length === 0) {
        throw new Error("AI failed to generate questions. Try again or change inputs.");
      }

      setQuizData(data);
      setCurrentQIndex(0);
      setFeedback(null);
      setSelectedAnswer('');
      if (timerEnabled) {
        setIsQuizTimed(true);
        setTimeLeft(timerDuration * 60);
      } else {
        setIsQuizTimed(false);
        setTimeLeft(0);
      }
      setPage('quiz');

    } catch (err) {
      console.error(err);
      setError(err.message || 'Unknown error');
      setMultiQuizSkills(null);
    }
    setLoading(false);
  }, [quizSource, selectedSubject, customSubject, pdfFile, youtubeUrl, numQuestions, includeDescriptive, timerEnabled, timerDuration, customContext]);

  const handleSubmitAnswer = useCallback(() => {
    if (!quizData) return;
    const question = quizData.questions[currentQIndex];
    const isCorrect = (selectedAnswer || '').toString().trim().toLowerCase() === (question.answer || '').toString().trim().toLowerCase();
    const score = isCorrect ? 1 : 0;

    const result = {
      prompt: question.prompt,
      type: question.type,
      choices: question.choices || [],
      userAnswer: selectedAnswer,
      correctAnswer: question.answer,
      explanation: question.explanation,
      isCorrect: score > 0
    };
    setQuizResults(prev => [...prev, result]);

    setSkills(prevSkills => {
      const newSkills = { ...prevSkills };
      const qSkills = question.skills && question.skills.length > 0
        ? question.skills
        : [String(quizData.category || 'general').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-')];

      qSkills.forEach(skillName => {
        newSkills[skillName] = updateSkill(newSkills[skillName], score);
      });
      return newSkills;
    });

    setFeedback({ score, explanation: question.explanation });
  }, [quizData, currentQIndex, selectedAnswer]);

  const handleNextQuestion = useCallback(() => {
    if (!quizData) return;
    if (currentQIndex < quizData.questions.length - 1) {
      setCurrentQIndex(idx => idx + 1);
      setFeedback(null);
      setSelectedAnswer('');
    } else {
      finishQuiz();
    }
  }, [currentQIndex, quizData, finishQuiz]);

  const handleDownloadQuiz = useCallback(() => {
    if (!lastQuizSummary) return;
    try {
      const doc = new jsPDF();
      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const usableWidth = pageWidth - margin * 2;
      let y = 15;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`Quiz Summary: ${lastQuizSummary.category.split(':').pop().trim()}`, margin, y);
      y += 10;

      lastQuizSummary.results.forEach((result, index) => {
        if (y > doc.internal.pageSize.getHeight() - 25) {
          doc.addPage();
          y = 15;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const questionText = doc.splitTextToSize(`Q${index + 1}: ${result.prompt}`, usableWidth);
        doc.text(questionText, margin, y);
        y += questionText.length * 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const userAnswerText = doc.splitTextToSize(`Your Answer: ${result.userAnswer || '[no answer]'}`, usableWidth);
        doc.text(userAnswerText, margin, y);
        y += userAnswerText.length * 6;

        if (!result.isCorrect) {
          const correctAnswerText = doc.splitTextToSize(`Correct Answer: ${result.correctAnswer}`, usableWidth);
          doc.text(correctAnswerText, margin, y);
          y += correctAnswerText.length * 6;
        }

        doc.setFont('helvetica', 'italic');
        const explanationText = doc.splitTextToSize(`Explanation: ${result.explanation || '—'}`, usableWidth);
        doc.text(explanationText, margin, y);
        y += explanationText.length * 6;
        y += 8;
      });
      doc.save('smart-quiz-summary.pdf');
    } catch (err) {
      console.error("PDF generation error:", err);
      setError("PDF generation failed.");
    }
  }, [lastQuizSummary]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (page !== 'quiz' || !quizData || !user) return;
      const question = quizData.questions[currentQIndex];
      if (!question) return;
      const key = e.key.toLowerCase();

      if (key === 'enter') {
        e.preventDefault();
        if (!!feedback) {
          handleNextQuestion();
        } else if (!feedback && selectedAnswer) {
          handleSubmitAnswer();
        }
      }

      if (!feedback && question.type === 'mcq') {
        let choiceIndex = -1;
        if (key === 'a' || key === '1') choiceIndex = 0;
        else if (key === 'b' || key === '2') choiceIndex = 1;
        else if (key === 'c' || key === '3') choiceIndex = 2;
        else if (key === 'd' || key === '4') choiceIndex = 3;

        if (choiceIndex !== -1 && question.choices && question.choices[choiceIndex]) {
          setSelectedAnswer(question.choices[choiceIndex]);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [page, feedback, selectedAnswer, quizData, currentQIndex, user, handleNextQuestion, handleSubmitAnswer]);

  // --- Render Views ---

  const renderMultiTopicSetupModal = () => {
    if (!isMultiQuizModalOpen || !multiQuizSkills) return null;
    return (
      <div className="fixed inset-0 bg-gray-800 bg-opacity-80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-lg border-t-8 border-orange-500">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Setup Multi-Topic Quiz</h2>
          <p className="mb-6 text-gray-600">Covering {multiQuizSkills.length} topics.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Number of Questions</label>
              <input type="number" value={numQuestions} min="5" max="50" onChange={(e) => setNumQuestions(e.target.value)} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Focus Instructions</label>
              <textarea rows="2" placeholder="Optional focus..." value={customContext} onChange={(e) => setCustomContext(e.target.value)} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-8">
            <button onClick={() => setIsMultiQuizModalOpen(false)} className="bg-gray-100 text-gray-700 font-bold py-2 px-5 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={() => handleStartQuiz(multiQuizSkills)} disabled={loading} className="bg-orange-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-orange-600 transition-colors shadow-md">
              {loading ? 'Generating...' : 'Start Quiz'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLoginScreen = () => (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 mb-2">Smart Quiz</h1>
          <p className="text-gray-500 font-medium">Master your skills with AI</p>
        </div>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={handleAuthKeyDown}
            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all bg-gray-50"
          />
          <input
            type="password"
            placeholder="Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={handleAuthKeyDown}
            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all bg-gray-50"
          />
          {authError && <p className="text-red-500 text-sm font-semibold bg-red-50 p-2 rounded-lg text-center">{authError}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleLogin} className="flex-1 bg-orange-500 text-white font-bold py-3 px-4 rounded-xl hover:bg-orange-600 transition-all shadow-md active:scale-95">Login</button>
            <button onClick={handleRegister} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-200 transition-all active:scale-95">Register</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHomeScreen = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-black text-gray-800 mb-2">Welcome, <span className="text-orange-500">{user.username}</span>!</h1>
        <p className="text-xl text-gray-500">Ready to challenge yourself today?</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
          <span className="text-3xl">🚀</span> Start a New Quiz
        </h2>

        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Source Material</label>
          <div className="flex rounded-xl bg-gray-100 p-1">
            {['subject', 'pdf', 'youtube'].map((src) => (
              <button
                key={src}
                onClick={() => setQuizSource(src)}
                className={`flex-1 py-3 rounded-lg font-bold capitalize transition-all duration-200 ${
                  quizSource === src ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {quizSource === 'subject' && (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Subject</label>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 outline-none bg-gray-50 cursor-pointer hover:bg-white transition-colors">
                  {BTECH_SUBJECTS.map(subject => (<option key={subject} value={subject}>{subject}</option>))}
                </select>
              </div>
              {selectedSubject === 'Custom' && (
                <input type="text" placeholder="e.g. 'React Hooks'" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" />
              )}
            </>
          )}

          {quizSource === 'pdf' && (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-orange-400 transition-colors bg-gray-50">
              <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files[0])} className="hidden" id="pdf-upload" />
              <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <span className="text-4xl">📄</span>
                <span className="font-bold text-gray-600">{pdfFile ? pdfFile.name : "Click to Upload PDF"}</span>
                {!pdfFile && <span className="text-sm text-gray-400">Supported format: .pdf</span>}
              </label>
            </div>
          )}

          {quizSource === 'youtube' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">YouTube URL</label>
              <input type="text" placeholder="https://youtube.com/..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Question Count</label>
              <input type="number" value={numQuestions} min="5" max="50" onChange={(e) => setNumQuestions(e.target.value)} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Context (Optional)</label>
              <input type="text" placeholder="Focus on..." value={customContext} onChange={(e) => setCustomContext(e.target.value)} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-300 outline-none" />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 bg-orange-50 p-4 rounded-xl border border-orange-100">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={includeDescriptive} onChange={(e) => setIncludeDescriptive(e.target.checked)} className="w-5 h-5 text-orange-500 rounded focus:ring-orange-400 border-gray-300" />
              <span className="font-medium text-gray-700">Include Written Answers</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} className="w-5 h-5 text-orange-500 rounded focus:ring-orange-400 border-gray-300" />
              <span className="font-medium text-gray-700">Timer</span>
            </label>
            {timerEnabled && (
              <input type="number" value={timerDuration} onChange={(e) => setTimerDuration(e.target.value)} className="w-20 p-1 border rounded text-center ml-auto" placeholder="Min" />
            )}
          </div>

          <button onClick={() => handleStartQuiz()} disabled={loading} className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-black py-4 px-8 rounded-xl text-xl hover:from-orange-600 hover:to-red-700 disabled:opacity-50 shadow-lg transform transition active:scale-[0.99]">
            {loading ? '🔮 Generating Quiz...' : '🚀 Start Quiz'}
          </button>
        </div>
        {error && <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-xl border border-red-200 font-medium text-center">{error.toString()}</div>}
      </div>
    </div>
  );

  const renderQuizScreen = () => {
    if (!quizData?.questions?.length) {
      setPage('home');
      return null;
    }
    const question = quizData.questions[currentQIndex];

    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <span className="bg-orange-100 text-orange-700 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
            {quizData.category.split(':').pop().trim()}
          </span>
          {isQuizTimed && (
            <div className={`text-2xl font-mono font-bold px-4 py-2 rounded-lg ${timeLeft < 30 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
              {formatTime(timeLeft)}
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border-t-8 border-orange-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-gray-100 px-4 py-2 rounded-bl-xl text-gray-500 font-bold text-sm">
            {currentQIndex + 1} / {quizData.questions.length}
          </div>
          
          <h2 className="text-2xl font-bold mb-8 text-gray-800 pr-12 leading-relaxed">{question.prompt}</h2>

          <div className="space-y-4">
            {question.type === 'mcq' ? (
              question.choices.map((choice, index) => {
                const choiceId = `q_${question.id}_choice_${index}`;
                const isSelected = selectedAnswer === choice;
                return (
                  <label 
                    key={choiceId} 
                    htmlFor={choiceId} 
                    className={`flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 group
                      ${isSelected 
                        ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500' 
                        : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                      } ${feedback ? 'cursor-default opacity-90' : ''}`}
                  >
                    <input type="radio" id={choiceId} name={question.id} value={choice} checked={isSelected} onChange={(e) => setSelectedAnswer(e.target.value)} disabled={!!feedback} className="hidden" />
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full mr-4 font-bold text-sm transition-colors ${isSelected ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 group-hover:bg-gray-300'}`}>
                      {['A','B','C','D'][index]}
                    </span>
                    <span className="text-lg text-gray-700 font-medium">{choice}</span>
                  </label>
                );
              })
            ) : (
              <textarea placeholder="Type your answer here..." value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)} disabled={!!feedback} className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-orange-400 outline-none text-lg min-h-[120px]" />
            )}
          </div>

          {!feedback && (
            <button onClick={handleSubmitAnswer} disabled={!selectedAnswer} className="mt-8 w-full bg-gray-800 text-white font-bold py-4 px-6 rounded-xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              Submit Answer ↵
            </button>
          )}
        </div>

        {feedback && (
          <div className={`mt-6 p-6 rounded-2xl shadow-lg border-l-8 animate-slide-up ${feedback.score > 0 ? 'bg-green-50 border-green-500 text-green-900' : 'bg-red-50 border-red-500 text-red-900'}`}>
            <h3 className="font-black text-2xl mb-2 flex items-center gap-2">
              {feedback.score > 0 ? '🎉 Correct!' : '❌ Incorrect'}
            </h3>
            <p className="text-lg leading-relaxed opacity-90">{feedback.explanation}</p>
            <button onClick={handleNextQuestion} className={`mt-6 font-bold py-3 px-8 rounded-xl shadow-md text-white transition-transform active:scale-95 ${feedback.score > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {currentQIndex === quizData.questions.length - 1 ? 'See Results' : 'Next Question ➡'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderDashboardScreen = () => (
    <div className="space-y-6 animate-fade-in">
      <DashboardComponent skills={skills} lastQuizSummary={lastQuizSummary} onDownloadQuiz={handleDownloadQuiz} onSetupMultiQuiz={handleSetupMultiQuiz} />
      <div className="flex justify-center mt-8">
        <button onClick={() => setPage('home')} className="bg-gray-800 text-white font-bold py-3 px-8 rounded-xl hover:bg-black transition-all shadow-lg flex items-center gap-2">
          <span>🔄</span> Take Another Quiz
        </button>
      </div>
    </div>
  );

  const renderPage = () => {
    if (!user) return renderLoginScreen();
    switch (page) {
      case 'quiz': return renderQuizScreen();
      case 'dashboard': return renderDashboardScreen();
      case 'leaderboard': return <Leaderboard onClose={() => setPage('dashboard')} apiBase={API_BASE_URL} />;
      default: return renderHomeScreen();
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 font-sans text-gray-800 selection:bg-orange-200">
      <nav className="bg-white shadow-sm border-b border-orange-100 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <button onClick={() => setPage('home')} className="text-2xl font-black tracking-tight flex items-center gap-2">
            <span className="text-3xl">🧠</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">SmartQuiz</span>
          </button>
          
          <div className="flex items-center gap-4 text-sm font-bold">
            <button onClick={() => setPage('leaderboard')} className="text-gray-500 hover:text-orange-600 transition-colors">🏆 Leaderboard</button>
            {user && (
              <>
                <button onClick={() => setPage('dashboard')} className="text-gray-500 hover:text-orange-600 transition-colors">📊 Dashboard</button>
                <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
                <button onClick={handleLogout} className="text-red-500 hover:text-red-700 transition-colors">Logout</button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-4 md:p-8 max-w-5xl">
        {renderPage()}
      </main>

      {renderMultiTopicSetupModal()}
    </div>
  );
}

export default App;