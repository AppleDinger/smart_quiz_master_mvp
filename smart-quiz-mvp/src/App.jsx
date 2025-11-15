import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
      "id": "q1",
      "prompt": "MCQ prompt here...",
      "type": "mcq",
      "choices": ["A", "B", "C", "D"],
      "answer": "The correct answer",
      "explanation": "A brief explanation of the answer.",
      "skills": ["skill1", "skill2"],
      "difficulty": 0.5
    }
  ];

  if (includeDescriptive) {
    questionExamples.push({
      "id": "q2",
      "prompt": "Short answer question prompt...",
      "type": "short",
      "answer": "The correct answer",
      "explanation": "A brief explanation.",
      "skills": ["skill3"],
      "difficulty": 0.7
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
  'Web Development (HTML/CSS/JS)',
  'React.js',
  'Node.js',
  'Calculus & Linear Algebra',
  'Probability & Statistics',
  'Discrete Mathematics',
  'Physics for Engineers',
  'Chemistry for Engineers',
  'Custom' // This MUST be the last item
];

// --- Enhanced Dashboard Component ---
function DashboardComponent({ skills }) {
  const [searchTerm, setSearchTerm] = useState('');

  const skillEntries = Object.entries(skills)
    .filter(([skillName]) => 
      skillName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a[0].localeCompare(b[0])); // Sort alphabetically

  
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
  
  const strongTopics = skillEntries
    .filter(([, data]) => data.score >= 0.7)
    .sort(([, a], [, b]) => b.score - a.score);
    
  const weakTopics = skillEntries
    .filter(([, data]) => data.score <= 0.4)
    .sort(([, a], [, b]) => a.score - b.score);

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
  
  const [skills, setSkills] = useState({}); 

  // --- Quiz settings state ---
  const [selectedSubject, setSelectedSubject] = useState(BTECH_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [includeDescriptive, setIncludeDescriptive] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(10); // in minutes
  
  // --- In-Quiz timer state ---
  const [isQuizTimed, setIsQuizTimed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds

  // Timer countdown logic
  useEffect(() => {
    if (page !== 'quiz' || !isQuizTimed || !!feedback) {
      return; // Don't run timer if not in quiz, not timed, or feedback is shown
    }

    if (timeLeft <= 0) {
      setPage('dashboard'); // End quiz when time runs out
      setIsQuizTimed(false);
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    // Cleanup interval on unmount or when quiz page changes
    return () => clearInterval(intervalId);

  }, [timeLeft, isQuizTimed, page, feedback]); 

  // Helper to format time
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };


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


  // **MODIFIED**: Wrapped in useCallback for stable keyboard listener
  const finishQuiz = useCallback(() => {
    setPage('dashboard');
    setQuizData(null);
    setIsQuizTimed(false); // Stop timer when quiz ends
  }, []);

  // **MODIFIED**: Wrapped in useCallback for stable keyboard listener
  const handleNextQuestion = useCallback(() => {
    if (!quizData) return;
    if (currentQIndex < quizData.questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      setFeedback(null);
      setSelectedAnswer('');
    } else {
      // Quiz is over
      finishQuiz();
    }
  }, [currentQIndex, quizData, finishQuiz]);

  // **MODIFIED**: Wrapped in useCallback for stable keyboard listener
  const handleSubmitAnswer = useCallback(() => {
    if (!quizData) return;
    const question = quizData.questions[currentQIndex];
    const isCorrect = selectedAnswer.toLowerCase() === question.answer.toLowerCase();
    const score = isCorrect ? 1 : 0;

    // Update skills
    const newSkills = { ...skills };
    const qSkills = question.skills && question.skills.length > 0 
      ? question.skills 
      : [quizData.category.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, '-') || 'general'];
      
    qSkills.forEach(skillName => {
      newSkills[skillName] = updateSkill(newSkills[skillName], score);
    });
    setSkills(newSkills);

    // Set feedback
    setFeedback({
      score,
      explanation: question.explanation,
    });
  }, [quizData, currentQIndex, selectedAnswer, skills]);


  // --- NEW: Keyboard navigation effect ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only run on quiz page
      if (page !== 'quiz' || !quizData) return;

      const question = quizData.questions[currentQIndex];
      const key = e.key.toLowerCase();

      // --- Handle 'Enter' key ---
      if (key === 'enter') {
        e.preventDefault(); // Prevent default form submission
        if (!!feedback) {
          // If feedback is showing, move to next question
          handleNextQuestion();
        } else if (!feedback && selectedAnswer) {
          // If no feedback and an answer is selected, submit
          handleSubmitAnswer();
        }
      }

      // --- Handle 'a, b, c, d' keys ---
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

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [page, feedback, selectedAnswer, quizData, currentQIndex, handleNextQuestion, handleSubmitAnswer]);


  // --- Render Functions for Each Page ---

  const renderHomeScreen = () => (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-center">Welcome to Smart Quiz!</h1>
      
      {/* Quiz selection form */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Start a New Quiz</h2>
        <div className="space-y-4">
          
          {/* Subject Dropdown */}
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

          {/* Custom Subject Input */}
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

          {/* Question Count Input */}
          <div>
            <label htmlFor="num-questions" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Questions (5-50)
            </label>
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

          {/* Timer Options */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center">
              <input
                id="include-timer"
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => setTimerEnabled(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="include-timer" className="ml-2 block text-sm text-gray-900">
                Enable Timer
              </label>
            </div>
            
            {timerEnabled && (
              <div className="flex-1 min-w-[150px]">
                <label htmlFor="timer-duration" className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
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
          
          {/* Descriptive Questions Checkbox */}
          <div className="flex items-center">
            <input
              id="include-descriptive"
              type="checkbox"
              checked={includeDescriptive}
              onChange={(e) => setIncludeDescriptive(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="include-descriptive" className="ml-2 block text-sm text-gray-900">
              Include Descriptive (Short Answer) Questions
            </label>
          </div>
          
          {/* Start Button */}
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
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Quiz: {quizData.category}</h1>
          {isQuizTimed && (
            <div className="text-2xl font-bold text-red-600 bg-red-100 px-4 py-2 rounded-lg">
              {formatTime(timeLeft)}
            </div>
          )}
        </div>
        
        {/* Question Card */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">({currentQIndex + 1}/{quizData.questions.length}) {question.prompt}</h2>
          
          <div className="space-y-3">
            {question.type === 'mcq' ? (
              question.choices.map((choice, index) => {
                const choiceId = `q_${question.id}_choice_${index}`;
                // **NEW**: Added key labels
                const keyLabel = ['A', 'B', 'C', 'D'][index];
                return (
                  <label 
                    key={choiceId} 
                    htmlFor={choiceId}
                    className={`flex items-center p-4 rounded-lg border cursor-pointer ${
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
                      className="hidden" // Hide radio, label handles click
                    />
                    <span className="mr-3 font-bold text-gray-500">{keyLabel})</span>
                    <span>{choice}</span>
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
              Submit Answer (Enter)
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
              {currentQIndex === quizData.questions.length - 1 ? 'Finish Quiz (Enter)' : 'Next Question (Enter)'}
            </button>
          </div>
        )}

        {/* End Quiz Button */}
        {!feedback && (
          <div className="text-center mt-4">
            <button
              onClick={finishQuiz}
              className="text-sm text-gray-500 hover:text-red-600"
            >
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
        <div className="container mx-auto px-4 py-4 flex justify-between items-center max-w-3xl">
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