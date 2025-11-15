import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
// import { jsPDF } from "jspdf"; // NOTE: Removed direct import to fix compilation error. Assuming jsPDF is globally available (new jsPDF()) or loaded via a <script> tag.
import { jsPDF } from "jspdf";

// --- Configuration ---
// NOTE: For the MVP, the Gemini API key is assumed to be set up as a 
// Vite environment variable (VITE_GEMINI_API_KEY) for direct calls.
// The code for PDF/YouTube processing will use direct calls/simulations
// as requested for the MVP, rather than an external backend.

// --- LOCAL USER DB KEYS (for localStorage) ---
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

// --- AI Service Logic (Client-Side, using VITE_GEMINI_API_KEY) ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.error("VITE_GEMINI_API_KEY is not defined. Quiz generation will fail.");
}
// We handle the case where the key might be missing gracefully below.
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }) : null;

async function generateQuizFromAI(
  category, 
  difficulty, 
  numQuestions, 
  includeDescriptive,
  customContext,
  sourceText = null,
  skillList = [] // NEW: Array of skills for multi-topic quizzes
) {
  if (!model) {
    throw new Error("AI Model not initialized. Check VITE_GEMINI_API_KEY.");
  }
  console.log(`Generating ${numQuestions} questions...`);

  const questionTypeInstructions = includeDescriptive
    ? `You can include "mcq" (multiple choice) and "short" (short answer) questions.`
    : `You MUST ONLY include "mcq" (multiple choice) questions. Do not include "short" answer questions.`;

  let sourceInstruction;

  if (sourceText) {
    // Priority: Specific text source (PDF/YouTube simulation)
    sourceInstruction = `Generate a ${numQuestions}-question quiz with ${difficulty} difficulty based ONLY on the following provided text:
---BEGIN TEXT---
${sourceText}
---END TEXT---
`;
  } else if (skillList.length > 0) {
    // New: Multi-topic quiz
    sourceInstruction = `Generate a ${numQuestions}-question quiz with ${difficulty} difficulty. The questions MUST cover ALL of the following specific topics equally: ${skillList.join(', ')}.`;
  } else {
    // Default: Single category quiz
    sourceInstruction = `Generate a ${numQuestions}-question quiz about "${category}" with a ${difficulty} difficulty.`;
  }

  const contextInstruction = customContext
    ? `Use the following optional context to help guide the question topics and focus:
---BEGIN CONTEXT---
${customContext}
---END CONTEXT---
`
    : "No additional context was provided.";

  // Example structure required by the LLM
  const questionExamples = [
    {
      "id": "q1", "prompt": "MCQ prompt here...", "type": "mcq",
      "choices": ["A", "B", "C", "D"], "answer": "The correct answer",
      "explanation": "A brief explanation of the answer.",
      "skills": skillList.length > 0 ? skillList.slice(0, 2) : ["skill1", "skill2"], // Use actual skills if available
      "difficulty": 0.5
    }
  ];
  if (includeDescriptive) {
    questionExamples.push({
      "id": "q2", "prompt": "Short answer question prompt...", "type": "short",
      "answer": "The correct answer", "explanation": "A brief explanation.",
      "skills": skillList.length > 0 ? [skillList[0]] : ["skill3"],
      "difficulty": 0.7
    });
  }
  
  const prompt = `
    You are a helpful quiz generation assistant.
    
    ${sourceInstruction}
    
    ${contextInstruction}
    
    ${questionTypeInstructions}

    Ensure each question includes an array of 'skills' it assesses.
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
    // Clean up markdown fences
    text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    const quizData = JSON.parse(text);
    quizData.questions.forEach((q, index) => {
      q.id = `llm_${Date.now()}_${index + 1}`;
    });
    return quizData;
  } catch (error) {
    console.error('Error calling LLM:', error);
    throw new Error('Failed to generate quiz from LLM. Check your API key or try a different topic.');
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

// --- Dashboard Component (MODIFIED) ---
function DashboardComponent({ skills, lastQuizSummary, onDownloadQuiz, onSetupMultiQuiz }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuizSkills, setSelectedQuizSkills] = useState({}); // New State for multi-select

  const skillEntries = Object.entries(skills)
    .filter(([skillName]) => skillName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const lastQuizStats = lastQuizSummary ? lastQuizSummary.results.reduce((acc, result) => {
    if (result.isCorrect) acc.correct += 1;
    acc.total += 1;
    return acc;
  }, { correct: 0, total: 0 }) : null;

  const handleSkillSelect = (skillName) => {
    setSelectedQuizSkills(prev => ({
        ...prev,
        [skillName]: !prev[skillName] // Toggle selection
    }));
  };

  const selectedSkillsArray = Object.keys(selectedQuizSkills).filter(k => selectedQuizSkills[k]);

  if (Object.keys(skills).length === 0 && !lastQuizSummary) {
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
  const strongTopics = skillEntries.filter(([, data]) => data.score >= 0.6).sort(([, a], [, b]) => b.score - a.score);
  const weakTopics = skillEntries.filter(([, data]) => data.score <= 0.5).sort(([, a], [, b]) => a.score - b.score);

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
    <>
      {lastQuizSummary && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Last Quiz Summary</h2>
              <p className="text-lg text-gray-700 mb-4 truncate" title={lastQuizSummary.category}>
                Topic: {lastQuizSummary.category.split(':').pop().trim()}
              </p>
            </div>
            <button
              onClick={onDownloadQuiz}
              className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Download PDF
            </button>
          </div>
          {lastQuizStats && lastQuizStats.total > 0 && (
            <div className="text-center bg-gray-50 p-4 rounded-lg">
              <span className="text-4xl font-bold text-blue-700">
                {lastQuizStats.correct} / {lastQuizStats.total}
              </span>
              <p className="text-sm font-medium text-gray-600">
                ({Math.round((lastQuizStats.correct / lastQuizStats.total) * 100)}%)
              </p>
            </div>
          )}
        </div>
      )}

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

        {/* --- NEW: Multi-Topic Quiz Builder Section --- */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-xl font-semibold mb-4 text-indigo-700">Multi-Topic Quiz Builder</h3>
          <p className="text-sm text-gray-600 mb-4">Select skills below to create a comprehensive quiz covering all of them.</p>

          <div className="flex flex-wrap gap-2 mb-4 max-h-60 overflow-y-auto p-2 border rounded-lg bg-gray-50">
            {skillEntries.map(([skillName]) => (
                <button 
                    key={`select_${skillName}`} 
                    onClick={() => handleSkillSelect(skillName)}
                    className={`py-1 px-3 text-sm rounded-full capitalize transition-colors shadow-sm
                        ${selectedQuizSkills[skillName] ? 'bg-indigo-600 text-white font-semibold' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                    `}
                >
                    {skillName}
                </button>
            ))}
            {skillEntries.length === 0 && <p className="text-gray-500 italic">No skills to display.</p>}
          </div>

          <button
            onClick={() => onSetupMultiQuiz(selectedSkillsArray)}
            disabled={selectedSkillsArray.length === 0}
            className="w-full bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg text-lg hover:bg-indigo-700 disabled:bg-gray-400"
          >
            Generate Quiz from {selectedSkillsArray.length} Selected Topics
          </button>
        </div>
        {/* --- END NEW SECTION --- */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
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
    </>
  );
}


// --- The Main React Component (MODIFIED) ---
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

  const [quizResults, setQuizResults] = useState([]);
  const [lastQuizSummary, setLastQuizSummary] = useState(null);
  
  const [quizSource, setQuizSource] = useState('subject');
  const [pdfFile, setPdfFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // New States for Multi-Topic Quiz Setup
  const [multiQuizSkills, setMultiQuizSkills] = useState(null); // Array of skills selected for multi-quiz
  const [isMultiQuizModalOpen, setIsMultiQuizModalOpen] = useState(false);
  
  // Quiz Configuration States (reused for both single and multi-topic)
  const [customContext, setCustomContext] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(BTECH_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [includeDescriptive, setIncludeDescriptive] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(10);
  const [isQuizTimed, setIsQuizTimed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Auth States
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState(null);

  // --- Local Auth Functions (Unchanged) ---
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
    setUser(null);
    setSkills({});
    setPage('home');
  };
  useEffect(() => {
    if (user && user.username) {
      localStorage.setItem(`${SKILLS_DB_PREFIX}${user.username}`, JSON.stringify(skills));
    }
  }, [skills, user]);
  // --- End Auth Functions ---

  const finishQuiz = useCallback(() => {
    if (quizData) {
      setLastQuizSummary({ 
        category: quizData.category, 
        results: quizResults 
      });
    }
    setQuizData(null);
    setQuizResults([]);
    setIsQuizTimed(false);
    setMultiQuizSkills(null); // Clear multi-topic state
    setPage('dashboard');
  }, [quizData, quizResults]);

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

  // NEW: Handler to initiate Multi-Topic Quiz setup
  const handleSetupMultiQuiz = (selectedSkills) => {
      if (selectedSkills.length === 0) return;
      setMultiQuizSkills(selectedSkills);
      setIsMultiQuizModalOpen(true);
      // Reset quiz setup options to default state for a fresh start
      setNumQuestions(5); 
      setTimerEnabled(false);
      setIncludeDescriptive(false);
      setCustomContext('');
      setPdfFile(null);
      setYoutubeUrl('');
      setQuizSource('multi'); // Internal marker
  };

  // --- MODIFIED: handleStartQuiz now accepts optional skill array ---
  const handleStartQuiz = useCallback(async (multiTopicSkills = null) => {
    setLoading(true);
    setError(null);
    setQuizResults([]);
    setLastQuizSummary(null);
    setIsMultiQuizModalOpen(false); // Close modal if open

    // Apply min/max here before generation
    const questionCount = Math.max(5, Math.min(50, numQuestions));
    
    let category = '';
    let sourceText = null;
    let skillList = [];

    try {
      if (multiTopicSkills && multiTopicSkills.length > 0) {
        // --- NEW: Multi-Topic Quiz Logic ---
        skillList = multiTopicSkills;
        category = `Multi-Topic Quiz: ${skillList.join(', ')}`;

      } else if (quizSource === 'subject') {
        category = selectedSubject === 'Custom' ? customSubject : selectedSubject;
        if (!category) {
          throw new Error("Please select a subject or enter a custom topic.");
        }
      } else if (quizSource === 'pdf') {
        if (!pdfFile) {
          throw new Error("Please upload a PDF file.");
        }
        category = `PDF: ${pdfFile.name}`;

        // --- PDF/YouTube SIMULATION FOR MVP ---
        if (pdfFile) {
          sourceText = `The uploaded PDF discusses ${pdfFile.name}. Key points include Active Recall, Spaced Repetition, and the benefits of using a focused study schedule. The core skills are related to memory techniques and study habits.`;
        }
        // --- END SIMULATION ---
        
      } else if (quizSource === 'youtube') {
        if (!youtubeUrl) {
          throw new Error("Please paste a YouTube URL.");
        }
        category = `YouTube: ${youtubeUrl.substring(0, 30)}...`;

        // --- PDF/YouTube SIMULATION FOR MVP ---
        if (youtubeUrl) {
          sourceText = `The video you linked covers JavaScript fundamentals, specifically focusing on async/await, closures, and variable hoisting. It emphasizes modern ES6 syntax and best practices.`;
        }
        // --- END SIMULATION ---
      }
      
      const data = await generateQuizFromAI(
        category, 'medium', questionCount, includeDescriptive,
        customContext, sourceText, skillList // Pass the skill list
      );
      
      if (!data || !data.questions || data.questions.length === 0) {
        throw new Error("The AI failed to generate any questions for this topic. Please try again or be more specific.");
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
      setError(err.message);
      setMultiQuizSkills(null);
    }
    setLoading(false);
  }, [
    quizSource, selectedSubject, customSubject, pdfFile, youtubeUrl,
    numQuestions, includeDescriptive, timerEnabled, timerDuration, customContext,
  ]);

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

    const result = {
      prompt: question.prompt,
      type: question.type,
      choices: question.choices || [],
      userAnswer: selectedAnswer,
      correctAnswer: question.answer,
      explanation: question.explanation,
      isCorrect: score > 0,
    };
    setQuizResults(prevResults => [...prevResults, result]);
    
    setSkills(prevSkills => {
      const newSkills = { ...prevSkills };
      // Use the skills provided by the AI for the question, or fall back to category if none.
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

  const handleDownloadQuiz = useCallback(() => {
    if (!lastQuizSummary) return;
    
    // Check if jsPDF exists globally before instantiating
    if (typeof jsPDF === 'undefined') {
        setError("PDF generation failed: jsPDF library is not loaded.");
        console.error("jsPDF is required for PDF download but is undefined.");
        return;
    }

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
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const questionText = doc.splitTextToSize(`Q${index + 1}: ${result.prompt}`, usableWidth);
      doc.text(questionText, margin, y);
      y += questionText.length * 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      if (result.isCorrect) {
        doc.setTextColor(0, 100, 0);
      } else {
        doc.setTextColor(200, 0, 0);
      }
      const userAnswerText = doc.splitTextToSize(`Your Answer: ${result.userAnswer}`, usableWidth);
      doc.text(userAnswerText, margin, y);
      y += userAnswerText.length * 5;

      doc.setTextColor(0, 0, 0);
      if (!result.isCorrect) {
        const correctAnswerText = doc.splitTextToSize(`Correct Answer: ${result.correctAnswer}`, usableWidth);
        doc.text(correctAnswerText, margin, y);
        y += correctAnswerText.length * 5;
      }
      
      doc.setFont('helvetica', 'italic');
      const explanationText = doc.splitTextToSize(`Explanation: ${result.explanation}`, usableWidth);
      doc.text(explanationText, margin, y);
      y += explanationText.length * 5;

      y += 10;
    });

    doc.save('smart-quiz-summary.pdf');
  }, [lastQuizSummary]);

  // Keyboard navigation
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
        // Check for A, B, C, D AND 1, 2, 3, 4
        if (key === 'a' || key === '1') choiceIndex = 0;
        else if (key === 'b' || key === '2') choiceIndex = 1;
        else if (key === 'c' || key === '3') choiceIndex = 2;
        else if (key === 'd' || key === '4') choiceIndex = 3;

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

  // --- Render Functions ---

  const renderMultiTopicSetupModal = () => {
    if (!isMultiQuizModalOpen || !multiQuizSkills) return null;
    const skillList = multiQuizSkills.join(', ');
    const countText = multiQuizSkills.length === 1 ? 'topic' : 'topics';

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg">
                <h2 className="text-2xl font-bold mb-4 text-indigo-700">Setup Multi-Topic Quiz</h2>
                <p className="mb-4 text-gray-700">Generating quiz covering **{multiQuizSkills.length}** {countText}: <span className="font-medium">{skillList}</span></p>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="modal-num-questions" className="block text-sm font-medium text-gray-700 mb-1">Number of Questions (5-50)</label>
                        <input 
                            type="number" 
                            id="modal-num-questions" 
                            value={numQuestions} 
                            min="5" 
                            max="50" 
                            onChange={(e) => {
                                let value = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                                setNumQuestions(value);
                            }} 
                            onBlur={(e) => {
                                let value = parseInt(e.target.value, 10);
                                if (isNaN(value) || value < 5) {
                                    value = 5;
                                } else if (value > 50) {
                                    value = 50;
                                }
                                setNumQuestions(value);
                            }}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300" 
                        />
                    </div>
                    <div>
                        <label htmlFor="modal-custom-context" className="block text-sm font-medium text-gray-700 mb-1">Optional Focus Instructions</label>
                        <textarea
                            id="modal-custom-context"
                            rows="2"
                            placeholder="e.g., 'Focus on the definitions' or 'Use case studies...'"
                            value={customContext}
                            onChange={(e) => setCustomContext(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center">
                            <input id="modal-include-descriptive" type="checkbox" checked={includeDescriptive} onChange={(e) => setIncludeDescriptive(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor="modal-include-descriptive" className="ml-2 block text-sm text-gray-900">Include Descriptive Questions</label>
                        </div>
                        <div className="flex items-center">
                            <input id="modal-include-timer" type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor="modal-include-timer" className="ml-2 block text-sm text-gray-900">Enable Timer</label>
                        </div>
                        {timerEnabled && (
                          <div className="flex-1 min-w-[120px]">
                            <label htmlFor="modal-timer-duration" className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                            <input type="number" id="modal-timer-duration" value={timerDuration} min="1" onChange={(e) => setTimerDuration(Math.max(1, parseInt(e.target.value, 10)))} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300" />
                          </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setIsMultiQuizModalOpen(false)} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">
                        Cancel
                    </button>
                    <button onClick={() => handleStartQuiz(multiQuizSkills)} disabled={loading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                        {loading ? 'Generating...' : 'Start Quiz'}
                    </button>
                </div>
                {error && (<p className="text-red-500 mt-4"><strong>Error:</strong> {error.toString()}</p>)}
            </div>
        </div>
    );
  }

  const renderLoginScreen = () => (
    <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-sm mx-auto">
      <h1 className="text-3xl font-bold mb-4">Welcome!</h1>
      <p className="text-lg text-gray-700 mb-6">Login or Register to continue.</p>
      <div className="space-y-4">
        <input type="text" placeholder="Username" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300" />
        <input type="password" placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300" />
        {authError && (<p className="text-red-500 text-sm">{authError}</p>)}
        <div className="flex gap-4">
          <button onClick={handleLogin} className="flex-1 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Login</button>
          <button onClick={handleRegister} className="flex-1 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">Register</button>
        </div>
      </div>
    </div>
  );

  const renderHomeScreen = () => (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-center">Welcome back, {user.username}!</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Start a New Quiz</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Source</label>
          <div className="flex rounded-lg shadow-sm">
            <button onClick={() => setQuizSource('subject')} className={`flex-1 p-3 rounded-l-lg ${quizSource === 'subject' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Subject</button>
            <button onClick={() => setQuizSource('pdf')} className={`flex-1 p-3 ${quizSource === 'pdf' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>PDF</button>
            <button onClick={() => setQuizSource('youtube')} className={`flex-1 p-3 rounded-r-lg ${quizSource === 'youtube' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>YouTube</button>
          </div>
        </div>

        <div className="space-y-4">
          {quizSource === 'subject' && (
            <>
              <div>
                <label htmlFor="subject-select" className="block text-sm font-medium text-gray-700 mb-1">Select a Subject</label>
                <select id="subject-select" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300">
                  {BTECH_SUBJECTS.map(subject => (<option key={subject} value={subject}>{subject}</option>))}
                </select>
              </div>
              {selectedSubject === 'Custom' && (
                <div>
                  <label htmlFor="custom-subject" className="block text-sm font-medium text-gray-700 mb-1">Enter Custom Topic</label>
                  <input type="text" id="custom-subject" placeholder="e.g., 'React Hooks' or 'SQL Joins'" value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300" />
                </div>
              )}
            </>
          )}

          {quizSource === 'pdf' && (
            <div>
              <label htmlFor="pdf-upload" className="block text-sm font-medium text-gray-700 mb-1">Upload PDF</label>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files[0])}
                className="w-full p-2 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {pdfFile && <p className="text-sm text-gray-600 mt-2">File: {pdfFile.name}</p>}
            </div>
          )}

          {quizSource === 'youtube' && (
            <div>
              <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700 mb-1">YouTube URL</label>
              <input
                type="text"
                id="youtube-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
              />
            </div>
          )}
          
          <div>
            <label htmlFor="custom-context" className="block text-sm font-medium text-gray-700 mb-1">Optional Context</label>
            <textarea
              id="custom-context"
              rows="3"
              placeholder="e.g., 'Focus on the recent developments' or 'Only ask about chapter 2...'"
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <hr />

          <div>
            <label htmlFor="num-questions" className="block text-sm font-medium text-gray-700 mb-1">Number of Questions (5-50)</label>
            <input 
              type="number" 
              id="num-questions" 
              value={numQuestions} 
              min="5" 
              max="50" 
              onChange={(e) => {
                // Allow intermediate typing, update state directly
                let value = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                setNumQuestions(value);
              }} 
              onBlur={(e) => {
                // Apply boundary validation only on blur
                let value = parseInt(e.target.value, 10);
                if (isNaN(value) || value < 5) {
                  value = 5;
                } else if (value > 50) {
                  value = 50;
                }
                setNumQuestions(value);
              }}
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
                <input type="number" id="timer-duration" value={timerDuration} min="1" onChange={(e) => setTimerDuration(Math.max(1, parseInt(e.target.value, 10)))} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300" />
              </div>
            )}
          </div>
          <div className="flex items-center">
            <input id="include-descriptive" type="checkbox" checked={includeDescriptive} onChange={(e) => setIncludeDescriptive(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
            <label htmlFor="include-descriptive" className="ml-2 block text-sm text-gray-900">Include Descriptive (Short Answer) Questions</label>
          </div>
          
          {/* Note: handleStartQuiz is called without arguments for single topic quiz */}
          <button onClick={() => handleStartQuiz()} disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 px-8 rounded-lg text-xl hover:bg-blue-700 disabled:bg-gray-400">
            {loading ? 'Generating...' : 'Start Quiz'}
          </button>
        </div>
        {error && (<p className="text-red-500 mt-4"><strong>Error:</strong> {error.toString()}</p>)}
      </div>
    </div>
  );

  const renderQuizScreen = () => {
    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
      console.error("Rendered quiz screen with invalid quiz data.");
      setPage('home');
      setError("An error occurred with the quiz data. Returning home.");
      return null;
    }
    const question = quizData.questions[currentQIndex];
    if (!question) {
      console.error("Quiz index out of bounds.");
      setError("An error occurred with the quiz question. Returning to dashboard.");
      finishQuiz();
      return null;
    }
    
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold truncate" title={quizData.category}>Quiz: {quizData.category.split(':').pop().trim()}</h1>
          {isQuizTimed && (<div className="text-2xl font-bold text-red-600 bg-red-100 px-4 py-2 rounded-lg">{formatTime(timeLeft)}</div>)}
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">({currentQIndex + 1}/{quizData.questions.length}) {question.prompt}</h2>
          <div className="space-y-3">
            {question.type === 'mcq' ? (
              question.choices.map((choice, index) => {
                const choiceId = `q_${question.id}_choice_${index}`;
                const keyLabel = ['A', 'B', 'C', 'D'][index];
                const numLabel = index + 1;
                return (
                  <label key={choiceId} htmlFor={choiceId} className={`flex items-center p-4 rounded-lg border cursor-pointer ${selectedAnswer === choice ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-300' : 'border-gray-300 hover:bg-gray-50'} ${feedback ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    <input type="radio" id={choiceId} name={question.id} value={choice} checked={selectedAnswer === choice} onChange={(e) => setSelectedAnswer(e.target.value)} disabled={!!feedback} className="hidden" />
                    <span className="mr-3 font-bold text-gray-500">{numLabel}) {keyLabel})</span>
                    <span>{choice}</span>
                  </label>
                );
              })
            ) : (
              <input type="text" placeholder="Type your answer..." value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)} disabled={!!feedback} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300" />
            )}
          </div>
          {!feedback && (<button onClick={handleSubmitAnswer} disabled={!selectedAnswer} className="mt-6 w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400">Submit Answer (Enter / 1-4)</button>)}
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
            <button onClick={finishQuiz} className="text-sm text-gray-500 hover:text-red-600">End Quiz</button>
          </div>
        )}
      </div>
    );
  };

  const renderDashboardScreen = () => (
    <div className="space-y-6">
      <DashboardComponent 
        skills={skills} 
        lastQuizSummary={lastQuizSummary}
        onDownloadQuiz={handleDownloadQuiz}
        onSetupMultiQuiz={handleSetupMultiQuiz} // NEW PROP
      />
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
          <button onClick={() => setPage('home')} className="text-2xl font-bold text-blue-600">🧠 Smart Quiz MVP</button>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-gray-700 hidden sm:block">Welcome, {user.username}!</span>
                <button onClick={() => setPage('dashboard')} className="text-gray-600 hover:text-blue-600">Dashboard</button>
                <button onClick={handleLogout} className="text-gray-600 hover:text-blue-600">Logout</button>
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
      {/* NEW: Render the multi-topic quiz setup modal */}
      {renderMultiTopicSetupModal()}
    </div>
  );
}

export default App;