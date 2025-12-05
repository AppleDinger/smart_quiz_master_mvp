import React, { useState, useEffect } from 'react';

export default function Quiz({ data, settings, onFinish, onUpdateSkills }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const [timeLeft, setTimeLeft] = useState(settings.timerEnabled ? settings.duration * 60 : 0);

  useEffect(() => {
    if (!settings.timerEnabled || feedback) return;
    if (timeLeft <= 0) { onFinish(results); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, feedback]);

  const q = data.questions[index];

  const handleSubmit = () => {
    const isCorrect = (answer || '').trim().toLowerCase() === (q.answer || '').trim().toLowerCase();
    const result = { prompt: q.prompt, userAnswer: answer, correctAnswer: q.answer, isCorrect, explanation: q.explanation };
    
    setResults(prev => [...prev, result]);
    onUpdateSkills(q.skills || [data.category], isCorrect);
    setFeedback({ isCorrect, explanation: q.explanation });
  };

  const handleNext = () => {
    if (index < data.questions.length - 1) {
      setIndex(prev => prev + 1);
      setFeedback(null);
      setAnswer('');
    } else {
      onFinish([...results]); // Finish quiz
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-xl border-t-8 border-orange-500">
      <div className="flex justify-between mb-6 font-bold text-gray-500">
        <span>Question {index + 1}/{data.questions.length}</span>
        {settings.timerEnabled && <span className="text-orange-600 font-mono">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>}
      </div>
      
      <h2 className="text-2xl font-bold mb-6">{q.prompt}</h2>
      
      <div className="space-y-3 mb-6">
        {q.type === 'mcq' ? q.choices.map((c, i) => (
          <button key={i} onClick={() => !feedback && setAnswer(c)} 
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${answer === c ? 'border-orange-500 bg-orange-50' : 'hover:bg-gray-50'}`}
            disabled={!!feedback}
          >
            {c}
          </button>
        )) : (
          <textarea className="w-full p-4 border-2 rounded-xl" rows="3" value={answer} onChange={e => setAnswer(e.target.value)} disabled={!!feedback} placeholder="Type answer..." />
        )}
      </div>

      {!feedback ? (
        <button onClick={handleSubmit} disabled={!answer} className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-black disabled:opacity-50">Submit</button>
      ) : (
        <div className={`p-6 rounded-xl ${feedback.isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
          <h3 className="font-bold text-xl mb-2">{feedback.isCorrect ? '🎉 Correct!' : '❌ Incorrect'}</h3>
          <p className="mb-4">{feedback.explanation}</p>
          <button onClick={handleNext} className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold">Next</button>
        </div>
      )}
    </div>
  );
}