import React, { useState } from 'react';
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
  };
}

// --- AI Service Logic ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is not defined. Please add it to your .env file.");
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function generateQuizFromAI(category, difficulty, numQuestions) {
  console.log(`Generating ${numQuestions} questions for topic: ${category}`);

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

// --- The Main React Component ---
function App() {
  // --- STATE ---
  const [page, setPage] = useState('home'); // 'home', 'quiz', 'dashboard'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [quizData, setQuizData] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  
  const [skills, setSkills] = useState({});
  
  // --- NEW --- state for the custom topic
  const [customTopic, setCustomTopic] = useState('');
  
  // --- NEW --- list of B.Tech categories
  const BTECH_CATEGORIES = ['OOPS', 'DSA', 'Electronics', 'Fluid Mechanics'];

  // --- EVENT HANDLERS ---

  // --- MODIFIED --- to accept a category
  const handleStartQuiz = async (category) => {
    // Basic validation
    if (!category || category.trim() === '') {
        setError("Please select or enter a topic.");
        return;
    }

    setLoading(true);
    setError(null);
    try {
      // Pass the selected category to the AI function
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
    const isCorrect = selectedAnswer.toLowerCase().trim() === question.answer.toLowerCase().trim();
    const score = isCorrect ? 1 : 0;
    const newSkills = { ...skills };
    const qSkills = question.skills || ['general'];
    qSkills.forEach(skillName => {
      newSkills[skillName] = updateSkill(newSkills[skillName], score);
    });
    setSkills(newSkills);
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
      setPage('dashboard');
      setQuizData(null);
    }
  };

  // --- RENDER FUNCTIONS ---

  // --- COMPLETELY REWRITTEN --- to show categories
  const renderHomeScreen = () => (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">Select a Topic</h1>
      
      {/* B.Tech Categories */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">B.Tech Subjects</h2>
        <div className="grid grid-cols-2 gap-4">
          {BTECH_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleStartQuiz(cat)}
              disabled={loading}
              className="w-full text-lg bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Category */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Or... Enter a Custom Topic</h2>
        <p className="text-gray-600 mb-4">Want to learn about World History, Biology, or anything else? Just type it below.</p>
        <div className="flex gap-4">
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="e.g., 'The Roman Empire'"
            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={() => handleStartQuiz(customTopic)}
            disabled={loading || !customTopic}
            className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            Go
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-center text-lg text-gray-600 mt-6">Generating your quiz...</p>
      )}

      {error && (
        <p className="text-center text-red-500 mt-6">
          <strong>Error:</strong> {error.toString()}
        </p>
      )}
    </div>
  );

  // --- UNCHANGED ---
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

  // --- UNCHANGED ---
  const renderDashboardScreen = () => (
    <div>
      <h1 className="text-3xl font-bold mb-6">Your Skill Dashboard</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Current Skills</h2>
        {Object.keys(skills).length === 0 ? (
          <p>You haven't completed any quiz questions yet.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {Object.entries(skills).map(([skillName, skillData]) => {
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
        )}
        <button
          onClick={() => setPage('home')}
          className="mt-6 bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700"
        >
          Take Another Quiz
        </button>
      </div>
    </div>
  );

  // --- UNCHANGED ---
  const renderPage = () => {
    if (page === 'home') return renderHomeScreen();
    if (page === 'quiz') return renderQuizScreen();
    if (page === 'dashboard') return renderDashboardScreen();
    return renderHomeScreen();
  };

  // --- UNCHANGED ---
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
      <main className="container mx-auto p-4">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;