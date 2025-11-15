import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Skill Model Logic (from your backend) ---
// We moved this simple logic from your backend directly into the frontend.
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
    // Correct
    newScore = oldScore + (1 - oldScore) * 0.1; // Move 10% closer to 1.0
    newDays = oldDays * SKILL_EASY_BONUS;
  } else if (score < 0.3) {
    // Incorrect
    newScore = oldScore - oldScore * 0.1; // Move 10% closer to 0.0
    newDays = oldDays * SKILL_HARD_PENALTY;
  } else {
    // Partially correct
    newScore = oldScore;
    newDays = oldDays;
  }

  const nextReview = new Date(now.getTime() + newDays * 24 * 60 * 60 * 1000);

  return {
    score: newScore,
    intervalDays: newDays,
    nextReview: nextReview.toISOString(),
    // We add a 'lastAnswered' timestamp to track quiz activity
    lastAnswered: now.toISOString(),
  };
}

// --- AI Service Logic ---
// Initialize the AI client
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is not defined. Please add it to your .env file.");
}
const genAI = new GoogleGenerativeAI(apiKey);
// **MODIFIED**: Corrected model name from 'gemini-2.5-flash' to 'gemini-1.5-flash'
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function generateQuizFromAI(category, difficulty, numQuestions) {
  console.log(`Generating ${numQuestions} questions...`);

  const prompt = `
    You are a helpful quiz generation assistant.
    Generate a ${numQuestions}-question quiz about "${category}" with a ${difficulty} difficulty.
    
    Respond with ONLY a valid JSON object in the following format:
    {
      "category": "${category}",
      "difficulty": "${difficulty}",
      "questions": [
        {
          "id": "q1",
          "prompt": "Question prompt here...",
          "type": "mcq",
          "choices": ["A", "B", "C", "D"],
          "answer": "The correct answer",
          "explanation": "A brief explanation of the answer.",
          "skills": ["skill1", "skill2"],
          "difficulty": 0.5
        },
        {
          "id": "q2",
          "prompt": "Short answer question prompt...",
          "type": "short",
          "answer": "The correct answer",
          "explanation": "A brief explanation.",
          "skills": ["skill3"],
          "difficulty": 0.7
        }
      ]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text();

    // Clean the AI's response
    text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    
    const quizData = JSON.parse(text);

    // Add unique IDs
    quizData.questions.forEach((q, index) => {
      q.id = `llm_${Date.now()}_${index + 1}`;
    });

    return quizData;
  } catch (error) {
    console.error('Error calling LLM:', error);
    throw new Error('Failed to generate quiz from LLM. Check your API key and billing.');
  }
}

// --- NEW: B.Tech Subject List ---
const BTECH_SUBJECTS = [
  'Data Structures & Algorithms',
  'Operating Systems',
  'Database Management Systems (DBMS)',
  'Computer Networks',
  'Object-Oriented Programming (OOP)',
  'Digital Logic Design',
  'Computer Organization & Architecture',
  'Theory of Computation',
  'Compiler Design',
  'Software Engineering',
  'Machine Learning',
  'Artificial Intelligence',
  'WebDevelopment (HTML/CSS/JS)',
  'React.js',
  'Node.js',
  'Calculus & Linear Algebra',
  'Probability & Statistics',
  'Discrete Mathematics',
  'Physics for Engineers',
  'Chemistry for Engineers',
  'Custom' // This MUST be the last item
];

// --- NEW: Enhanced Dashboard Component ---
// This component is now used by both the Home screen and the Dashboard screen.
function DashboardComponent({ skills }) {
  const skillEntries = Object.entries(skills);
  
  if (skillEntries.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-semibold mb-4">Your Skill Dashboard</h2>
        <p className="text-gray-600">Complete your first quiz to see your skill stats appear here! 🚀</p>
      </div>
    );
  }

  // Calculate statistics
  const totalSkills = skillEntries.length;
  const averageScore = skillEntries.reduce((acc, [, data]) => acc + (data.score || 0), 0) / totalSkills;
  
  const strongTopics = skillEntries
    .filter(([, data]) => data.score >= 0.7)
    .sort(([, a], [, b]) => b.score - a.score);
    
  const weakTopics = skillEntries
    .filter(([, data]) => data.score <= 0.4)
    .sort(([, a], [, b]) => a.score - b.score);

  // Helper to render a list of topics
  const renderTopicList = (title, topics, bgColor) => (
    <div className={`p-4 rounded-lg ${bgColor}`}>
      <h3 className="font-bold text-lg mb-2">{title} ({topics.length})</h3>
      {topics.length === 0 ? (
        <p className="text-sm opacity-70">None yet.</p>
      ) : (
        <ul className="list-disc list-inside space-y-1">
          {topics.slice(0, 5).map(([name, data]) => ( // Show top 5
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
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-4xl font-bold text-blue-700">
            {Math.round(averageScore * 100)}%
          </div>
          <div className="text-sm font-medium text-gray-600">Overall Accuracy</div>
        </div>
        <div className="bg-indigo-50 p-4 rounded-lg text-center">
          <div className="text-4xl font-bold text-indigo-700">
            {totalSkills}
          </div>
          <div className="text-sm font-medium text-gray-600">Skills Practiced</div>
        </div>
      </div>
      
      {/* Weak/Strong Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {renderTopicList("💪 Strong Topics", strongTopics, "bg-green-50")}
        {renderTopicList("🧠 Weak Topics", weakTopics, "bg-red-50")}
      </div>
      
      {/* Detailed Skill Breakdown */}
      <h3 className="text-xl font-semibold mb-4">All Skills Breakdown</h3>
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
                <span className="text-sm font-bold text-gray-600">
                  {Math.round(progress * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${barColor}`} 
                  style={{ width: `${progress * 100}%` }}
                ></div>
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
  const [page, setPage] = useState('home'); // 'home', 'quiz', 'dashboard'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [quizData, setQuizData] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  
  const [skills, setSkills] = useState({}); // This is our in-memory skill database

  // --- NEW: State for subject selection ---
  const [selectedSubject, setSelectedSubject] = useState(BTECH_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');

  const handleStartQuiz = async () => {
    // **MODIFIED**: Determine category from dropdown or custom input
    const category = selectedSubject === 'Custom' ? customSubject : selectedSubject;

    if (!category) {
      setError("Please select a subject or enter a custom topic.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Use the selected category
      const data = await generateQuizFromAI(category, 'medium', 5);
      setQuizData(data);
      setCurrentQIndex(0);
      setFeedback(null);
      setSelectedAnswer('');
      setPage('quiz');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSubmitAnswer = () => {
    const question = quizData.questions[currentQIndex];
    const isCorrect = selectedAnswer.toLowerCase() === question.answer.toLowerCase();
    const score = isCorrect ? 1 : 0;

    // Update skills
    const newSkills = { ...skills };
    const qSkills = question.skills || ['general'];
    qSkills.forEach(skillName => {
      newSkills[skillName] = updateSkill(newSkills[skillName], score);
    });
    setSkills(newSkills);

    // Set feedback
    setFeedback({
      score,
      explanation: question.explanation,
    });
  };

  const handleNextQuestion = () => {
    if (currentQIndex < quizData.questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      setFeedback(null);
      setSelectedAnswer('');
    } else {
      // Quiz is over
      setPage('dashboard');
      setQuizData(null);
    }
  };

  // --- Render Functions for Each Page ---

  const renderHomeScreen = () => (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-center">Welcome to Smart Quiz!</h1>
      
      {/* **NEW**: Dashboard is now on the home page */}
      <DashboardComponent skills={skills} />

      {/* **NEW**: Quiz selection form */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Start a New Quiz</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="subject-select" className="block text-sm font-medium text-gray-700 mb-1">
              Select a Subject
            </label>
            <select
              id="subject-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
            >
              {BTECH_SUBJECTS.map(subject => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          {/* **NEW**: Custom subject input */}
          {selectedSubject === 'Custom' && (
            <div>
              <label htmlFor="custom-subject" className="block text-sm font-medium text-gray-700 mb-1">
                Enter Custom Topic
              </label>
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
          
          <button
            onClick={handleStartQuiz}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 px-8 rounded-lg text-xl hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Generating...' : 'Start Quiz'}
          </button>
        </div>

        {error && (
          <p className="text-red-500 mt-4">
            <strong>Error:</strong> {error.toString()}
          </p>
        )}
      </div>
    </div>
  );

  const renderQuizScreen = () => {
    if (!quizData) return renderHomeScreen(); // Safety check
    const question = quizData.questions[currentQIndex];

    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Quiz: {quizData.category}</h1>
        
        {/* Question Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">{question.prompt}</h2>
          
          <div className="space-y-3">
            {question.type === 'mcq' ? (
              question.choices.map((choice, index) => {
                const choiceId = `q_${question.id}_choice_${index}`;
                return (
                  <label 
                    key={choiceId} 
                    htmlFor={choiceId}
                    className={`block p-4 rounded-lg border cursor-pointer ${
                      selectedAnswer === choice 
                        ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-300' 
                        : 'border-gray-300 hover:bg-gray-50'
                    } ${feedback ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      id={choiceId}
                      name={question.id}
                      value={choice}
                      checked={selectedAnswer === choice}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      disabled={!!feedback}
                      className="mr-3"
                    />
                    {choice}
                  </label>
                );
              })
            ) : (
              <input
                type="text"
                placeholder="Type your answer..."
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                disabled={!!feedback}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
              />
            )}
          </div>

          {!feedback && (
            <button
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer}
              className="mt-6 w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              Submit Answer
            </button>
          )}
        </div>

        {/* Feedback Box */}
        {feedback && (
          <div className={`mt-4 p-4 rounded-lg ${feedback.score > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            <h2 className="font-bold text-lg">
              {feedback.score > 0 ? 'Correct!' : 'Incorrect'}
            </h2>
            <p className="mt-2">{feedback.explanation}</p>
            <button
              onClick={handleNextQuestion}
              className="mt-4 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700"
            >
              {currentQIndex === quizData.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
            </button>
          </div>
        )}
      </div>
    );
  };

  // **MODIFIED**: This page now just renders the DashboardComponent
  const renderDashboardScreen = () => (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Your Skill Dashboard</h1>
      <DashboardComponent skills={skills} />
      <button
        onClick={() => setPage('home')}
        className="mt-6 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700"
      >
        Take Another Quiz
      </button>
    </div>
  );

  const renderPage = () => {
    if (page === 'home') return renderHomeScreen();
    if (page === 'quiz') return renderQuizScreen();
    if (page === 'dashboard') return renderDashboardScreen();
    return renderHomeScreen();
  };

  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={() => setPage('home')} className="text-2xl font-bold text-blue-600">
            🧠 Smart Quiz MVP
          </button>
          <button onClick={() => setPage('dashboard')} className="text-gray-600 hover:text-blue-600">
            Dashboard
          </button>
        </div>
      </nav>
      <main className="container mx-auto p-4 max-w-3xl">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;