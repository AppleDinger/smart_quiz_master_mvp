import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- LOCAL USER DB KEYS ---
const USERS_DB_KEY = "smartQuizUsers";
const SKILLS_DB_PREFIX = "smartQuizSkills_";

// --- Skill Model Logic ---
const SKILL_INIT_SCORE = 0.5;
const SKILL_INIT_DAYS = 1;
const SKILL_EASY_BONUS = 2.0;
const SKILL_HARD_PENALTY = 0.5;

function updateSkill(skillRecord, score) {
  const oldScore = skillRecord?.score || SKILL_INIT_SCORE;
  const oldDays = skillRecord?.intervalDays || SKILL_INIT_DAYS;
  const now = new Date();
  let newScore;
  let newDays;
  if (score > 0.8) {
    newScore = oldScore + (1 - oldScore) * 0.1;
    newDays = oldDays * SKILL_EASY_BONUS;
  } else if (score < 0.3) {
    newScore = oldScore - oldScore * 0.1;
    newDays = oldDays * SKILL_HARD_PENALTY;
  } else {
    newScore = oldScore;
    newDays = oldDays;
  }
  const nextReview = new Date(now.getTime() + newDays * 24 * 60 * 60 * 1000);
  return {
    score: newScore,
    intervalDays: newDays,
    nextReview: nextReview.toISOString(),
    lastAnswered: now.toISOString(),
  };
}

// --- AI Service Logic ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is not defined. Please add it to your .env file.");
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function generateQuizFromAI(category, difficulty, numQuestions, includeDescriptive) {
  console.log(`Generating ${numQuestions} questions...`);
  const questionTypeInstructions = includeDescriptive
    ? `You can include "mcq" (multiple choice) and "short" (short answer) questions.`
    : `You MUST ONLY include "mcq" (multiple choice) questions. Do not include "short" answer questions.`;
  const questionExamples = [
    {
      "id": "q1", "prompt": "MCQ prompt here...", "type": "mcq",
      "choices": ["A", "B", "C", "D"], "answer": "The correct answer",
      "explanation": "A brief explanation of the answer.",
      "skills": ["skill1", "skill2"], "difficulty": 0.5
    }
  ];
  if (includeDescriptive) {
    questionExamples.push({
      "id": "q2", "prompt": "Short answer question prompt...", "type": "short",
      "answer": "The correct answer", "explanation": "A brief explanation.",
      "skills": ["skill3"], "difficulty": 0.7
    });
  }
  const prompt = `
    You are a helpful quiz generation assistant.
    Generate a ${numQuestions}-question quiz about "${category}" with a ${difficulty} difficulty.
    ${questionTypeInstructions}
    Respond with ONLY a valid JSON object in the following format:
    {
      "category": "${category}",
      "difficulty": "${difficulty}",
      "questions": ${JSON.stringify(questionExamples, null, 2)}
    }
  `;
  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();
    text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    const quizData = JSON.parse(text);
    quizData.questions.forEach((q, index) => {
      q.id = `llm_${Date.now()}_${index + 1}`;
    });
    return quizData;
  } catch (error) {
    console.error('Error calling LLM:', error);
    throw new Error('Failed to generate quiz from LLM. Check your API key and billing.');
  }
}

// --- B.Tech Subject List ---
const BTECH_SUBJECTS = [
  'Data Structures & Algorithms', 'Operating Systems', 'Database Management Systems (DBMS)',
  'Computer Networks', 'Object-Oriented Programming (OOP)', 'Digital Logic Design',
  'Computer Organization & Architecture', 'Theory of Computation', 'Compiler Design',
  'Software Engineering', 'Machine Learning', 'Artificial Intelligence',
  'Web Development (HTML/CSS/JS)', 'React.js', 'Node.js', 'Calculus & Linear Algebra',
  'Probability & Statistics', 'Discrete Mathematics', 'Physics for Engineers',
  'Chemistry for Engineers', 'Custom'
];

// --- Dashboard Component ---
function DashboardComponent({ skills }) {
  const [searchTerm, setSearchTerm] = useState('');
  const skillEntries = Object.entries(skills)
    .filter(([skillName]) => skillName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (Object.keys(skills).length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-semibold mb-4">Your Skill Dashboard</h2>
        <p className="text-gray-600">Complete your first quiz to see your skill stats appear here! 🚀</p>
      </div>
    );
  }

  const totalSkills = skillEntries.length;
  const averageScore = totalSkills > 0
    ? skillEntries.reduce((acc, [, data]) => acc + (data.score || 0), 0) / totalSkills
    : 0;
  const strongTopics = skillEntries.filter(([, data]) => data.score >= 0.7).sort(([, a], [, b]) => b.score - a.score);
  const weakTopics = skillEntries.filter(([, data]) => data.score <= 0.4).sort(([, a], [, b]) => a.score - b.score);

  const renderTopicList = (title, topics, bgColor) => (
    <div className={`p-4 rounded-lg ${bgColor}`}>
      <h3 className="font-bold text-lg mb-2">{title} ({topics.length})</h3>
      {topics.length === 0 ? (
        <p className="text-sm opacity-70">None yet.</p>
      ) : (
        <ul className="list-disc list-inside space-y-1">
          {topics.slice(0, 5).map(([name, data]) => (
            <li key={name} className="capitalize">
              {name} <span className="text-xs opacity-70">({Math.round(data.score * 100)}%)</span>
            </li>
          ))}
          {topics.length > 5 && <li className="text-sm italic opacity-70">...and {topics.length - 5} more</li>}
        </ul>
      )}
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Your Skill Dashboard</h2>
      <input
        type="text"
        placeholder="Search skills..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg mb-6 focus:ring-2 focus:ring-blue-300"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-4xl font-bold text-blue-700">{Math.round(averageScore * 100)}%</div>
          <div className="text-sm font-medium text-gray-600">Overall Accuracy</div>
        </div>
        <div className="bg-indigo-50 p-4 rounded-lg text-center">
          <div className="text-4xl font-bold text-indigo-700">{totalSkills}</div>
          <div className="text-sm font-medium text-gray-600">Skills Practiced</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {renderTopicList("💪 Strong Topics", strongTopics, "bg-green-50")}
        {renderTopicList("🧠 Weak Topics", weakTopics, "bg-red-50")}
      </div>
      <h3 className="text-xl font-semibold mb-4">All Skills Breakdown</h3>
      {skillEntries.length === 0 && searchTerm && (
        <p className="text-gray-600 text-center">No skills found matching "{searchTerm}".</p>
      )}
      <div className="flex flex-wrap gap-4">
        {skillEntries.map(([skillName, skillData]) => {
          const progress = Math.max(0, Math.min(1, skillData.score || 0));
          let barColor = 'bg-red-500';
          if (progress > 0.7) barColor = 'bg-green-500';
          else if (progress > 0.4) barColor = 'bg-yellow-500';
          return (
            <div key={skillName} className="w-64 p-4 bg-white rounded-lg shadow border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold capitalize">{skillName}</span>
                <span className="text-sm font-bold text-gray-600">{Math.round(progress * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full ${barColor}`} style={{ width: `${progress * 100}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- The Main React Component ---
function App() {
  const [user, setUser] = useState(null);
  const [skills, setSkills] = useState({});
  
  const [page, setPage] = useState('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [quizData, setQuizData] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);

  const [selectedSubject, setSelectedSubject] = useState(BTECH_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [includeDescriptive, setIncludeDescriptive] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(10);
  
  const [isQuizTimed, setIsQuizTimed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState(null);

  const getUsers = () => {
    return JSON.parse(localStorage.getItem(USERS_DB_KEY) || "{}");
  };

  const handleRegister = () => {
    if (!usernameInput || !passwordInput) {
      setAuthError("Username and password are required.");
      return;
    }
    const users = getUsers();
    if (users[usernameInput]) {
      setAuthError("Username already taken. Please try another.");
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
    if (!users[usernameInput]) {
      setAuthError("User not found. Please register.");
      return;
    }
    
    if (users[usernameInput] !== passwordInput) {
      setAuthError("Incorrect password.");
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

  const handleLogout = () => {
    console.log("User logged out");
    setUser(null);
    setSkills({});
    setPage('home');
  };

  useEffect(() => {
    if (user && user.username) {
      try {
        localStorage.setItem(`${SKILLS_DB_PREFIX}${user.username}`, JSON.stringify(skills));
      } catch (e) {
        console.error("Failed to save skills to localStorage:", e);
        setError("Could not save your progress.");
      }
    }
  }, [skills, user]);

  // **MODIFIED**: finishQuiz moved before timer useEffect
  const finishQuiz = useCallback(() => {
    setPage('dashboard');
    setQuizData(null);
    setIsQuizTimed(false);
  }, []);

  // Timer countdown logic
  useEffect(() => {
    if (page !== 'quiz' || !isQuizTimed || !!feedback) {
      return;
    }
    if (timeLeft <= 0) {
      finishQuiz();
      return;
    }
    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timeLeft, isQuizTimed, page, feedback, finishQuiz]);

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // **MODIFIED**: Added validation inside handleStartQuiz
  const handleStartQuiz = useCallback(async () => {
    const category = selectedSubject === 'Custom' ? customSubject : selectedSubject;
    if (!category) {
      setError("Please select a subject or enter a custom topic.");
      return;
    }
    const questionCount = Math.max(5, Math.min(50, numQuestions));
    setNumQuestions(questionCount);
    setLoading(true);
    setError(null);
    try {
      const data = await generateQuizFromAI(category, 'medium', questionCount, includeDescriptive);
      
      // --- NEW VALIDATION ---
      if (!data || !data.questions || data.questions.length === 0) {
        setError("The AI failed to generate any questions for this topic. Please try again or be more specific.");
        setLoading(false);
        return;
      }
      // --- END VALIDATION ---

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
      setError(err.message);
    }
    setLoading(false);
  }, [selectedSubject, customSubject, numQuestions, includeDescriptive, timerEnabled, timerDuration]);

  const handleNextQuestion = useCallback(() => {
    if (!quizData) return;
    if (currentQIndex < quizData.questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      setFeedback(null);
      setSelectedAnswer('');
    } else {
      finishQuiz();
    }
  }, [currentQIndex, quizData, finishQuiz]);

  const handleSubmitAnswer = useCallback(() => {
    if (!quizData) return;
    const question = quizData.questions[currentQIndex];
    const isCorrect = selectedAnswer.toLowerCase() === question.answer.toLowerCase();
    const score = isCorrect ? 1 : 0;
    
    setSkills(prevSkills => {
      const newSkills = { ...prevSkills };
      const qSkills = question.skills && question.skills.length > 0
        ? question.skills
        : [quizData.category.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-') || 'general'];
      
      qSkills.forEach(skillName => {
        newSkills[skillName] = updateSkill(newSkills[skillName], score);
      });
      return newSkills;
    });

    setFeedback({
      score,
      explanation: question.explanation,
    });
  }, [quizData, currentQIndex, selectedAnswer]);

  // Keyboard navigation effect
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (page !== 'quiz' || !quizData || !user) return; 

      const question = quizData.questions[currentQIndex];
      // **FIX**: Add check for question
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
        if (key === 'a') choiceIndex = 0;
        else if (key === 'b') choiceIndex = 1;
        else if (key === 'c') choiceIndex = 2;
        else if (key === 'd') choiceIndex = 3;
        if (choiceIndex !== -1 && question.choices[choiceIndex]) {
          setSelectedAnswer(question.choices[choiceIndex]);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [page, feedback, selectedAnswer, quizData, currentQIndex, user, handleNextQuestion, handleSubmitAnswer]);

  // --- Render Functions for Each Page ---

  const renderLoginScreen = () => (
    <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-sm mx-auto">
      <h1 className="text-3xl font-bold mb-4">Welcome!</h1>
      <p className="text-lg text-gray-700 mb-6">
        Login or Register to continue.
      </p>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Username"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
        />
        <input
          type="password"
          placeholder="Password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
        />
        {authError && (
          <p className="text-red-500 text-sm">{authError}</p>
        )}
        <div className="flex gap-4">
          <button
            onClick={handleLogin}
            className="flex-1 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            Login
          </button>
          <button
            onClick={handleRegister}
            className="flex-1 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );

  const renderHomeScreen = () => (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-center">Welcome back, {user.username}!</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Start a New Quiz</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="subject-select" className="block text-sm font-medium text-gray-700 mb-1">Select a Subject</label>
            <select
              id="subject-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
            >
              {BTECH_SUBJECTS.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
          {selectedSubject === 'Custom' && (
            <div>
              <label htmlFor="custom-subject" className="block text-sm font-medium text-gray-700 mb-1">Enter Custom Topic</label>
              <input
                type="text"
                id="custom-subject"
                placeholder="e.g., 'React Hooks' or 'SQL Joins'"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
              />
            </div>
          )}
          <div>
            <label htmlFor="num-questions" className="block text-sm font-medium text-gray-700 mb-1">Number of Questions (5-50)</label>
            <input
              type="number"
              id="num-questions"
              value={numQuestions}
              min="5"
              max="50"
              onChange={(e) => setNumQuestions(Math.max(5, Math.min(50, parseInt(e.target.value, 10))))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center">
              <input id="include-timer" type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
              <label htmlFor="include-timer" className="ml-2 block text-sm text-gray-900">Enable Timer</label>
            </div>
            {timerEnabled && (
              <div className="flex-1 min-w-[150px]">
                <label htmlFor="timer-duration" className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  id="timer-duration"
                  value={timerDuration}
                  min="1"
                  onChange={(e) => setTimerDuration(Math.max(1, parseInt(e.target.value, 10)))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
                />
              </div>
            )}
          </div>
          <div className="flex items-center">
            <input id="include-descriptive" type="checkbox" checked={includeDescriptive} onChange={(e) => setIncludeDescriptive(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
            <label htmlFor="include-descriptive" className="ml-2 block text-sm text-gray-900">Include Descriptive (Short Answer) Questions</label>
          </div>
          <button
            onClick={handleStartQuiz}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 px-8 rounded-lg text-xl hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Generating...' : 'Start Quiz'}
          </button>
        </div>
        {error && (
          <p className="text-red-500 mt-4"><strong>Error:</strong> {error.toString()}</p>
        )}
      </div>
    </div>
  );

  // **MODIFIED**: Added robust checks
  const renderQuizScreen = () => {
    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
      console.error("Rendered quiz screen with invalid quiz data.");
      setPage('home');
      setError("An error occurred with the quiz data. Returning home.");
      return null; // Render nothing this cycle
    }

    const question = quizData.questions[currentQIndex];

    if (!question) {
      console.error("Quiz index out of bounds.");
      setError("An error occurred with the quiz question. Returning to dashboard.");
      finishQuiz(); // This sets page to dashboard
      return null; // Render nothing this cycle
    }
    
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Quiz: {quizData.category}</h1>
          {isQuizTimed && (
            <div className="text-2xl font-bold text-red-600 bg-red-100 px-4 py-2 rounded-lg">
              {formatTime(timeLeft)}
            </div>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">({currentQIndex + 1}/{quizData.questions.length}) {question.prompt}</h2>
          <div className="space-y-3">
            {question.type === 'mcq' ? (
              question.choices.map((choice, index) => {
                const choiceId = `q_${question.id}_choice_${index}`;
                const keyLabel = ['A', 'B', 'C', 'D'][index];
                return (
                  <label 
                    key={choiceId} 
                    htmlFor={choiceId}
                    className={`flex items-center p-4 rounded-lg border cursor-pointer ${
                      selectedAnswer === choice ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:bg-gray-50'
                    } ${feedback ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <input type="radio" id={choiceId} name={question.id} value={choice} checked={selectedAnswer === choice} onChange={(e) => setSelectedAnswer(e.target.value)} disabled={!!feedback} className="hidden" />
                    <span className="mr-3 font-bold text-gray-500">{keyLabel})</span>
                    <span>{choice}</span>
                  </label>
                );
              })
            ) : (
              <input type="text" placeholder="Type your answer..." value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)} disabled={!!feedback} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300" />
            )}
          </div>
          {!feedback && (
            <button onClick={handleSubmitAnswer} disabled={!selectedAnswer} className="mt-6 w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
              Submit Answer (Enter)
            </button>
          )}
        </div>
        {feedback && (
          <div className={`mt-4 p-4 rounded-lg ${feedback.score > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            <h2 className="font-bold text-lg">{feedback.score > 0 ? 'Correct!' : 'Incorrect'}</h2>
            <p className="mt-2">{feedback.explanation}</p>
            <button onClick={handleNextQuestion} className="mt-4 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700">
              {currentQIndex === quizData.questions.length - 1 ? 'Finish Quiz (Enter)' : 'Next Question (Enter)'}
            </button>
          </div>
        )}
        {!feedback && (
          <div className="text-center mt-4">
            <button onClick={finishQuiz} className="text-sm text-gray-500 hover:text-red-600">
              End Quiz
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderDashboardScreen = () => (
    <div className="space-y-6">
      <DashboardComponent skills={skills} />
      <button onClick={() => setPage('home')} className="mt-6 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700">
        Take Another Quiz
      </button>
    </div>
  );

  const renderPage = () => {
    if (!user) {
      return renderLoginScreen();
    }
    
    switch (page) {
      case 'quiz':
        return renderQuizScreen();
      case 'dashboard':
        return renderDashboardScreen();
      case 'home':
      default:
        return renderHomeScreen();
    }
  };

  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center max-w-3xl">
          <button onClick={() => setPage('home')} className="text-2xl font-bold text-blue-600">
            🧠 Smart Quiz MVP
          </button>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-gray-700 hidden sm:block">Welcome, {user.username}!</span>
                <button onClick={() => setPage('dashboard')} className="text-gray-600 hover:text-blue-600">
                  Dashboard
                </button>
                <button
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-blue-600"
                >
                  Logout
                </button>
              </>
            ) : (
              <span className="text-gray-600">Please log in</span>
            )}
          </div>
        </div>
      </nav>
      <main className="container mx-auto p-4 max-w-3xl">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;