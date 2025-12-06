import React, { useState, useEffect } from "react";

export default function Quiz({ data, settings, onFinish, onUpdateSkills }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const [timeLeft, setTimeLeft] = useState(settings.timerEnabled ? settings.duration * 60 : 0);

  useEffect(() => {
    if (!settings.timerEnabled || feedback) return;
    if (timeLeft <= 0) { onFinish(results); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, feedback]);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const q = data.questions[index];

  const handleSubmit = () => {
    if (!answer) return;
    const isCorrect = (answer || "").trim().toLowerCase() === (q.answer || "").trim().toLowerCase();
    const result = { prompt: q.prompt, userAnswer: answer, correctAnswer: q.answer, isCorrect, explanation: q.explanation };
    setResults(prev => [...prev, result]);
    onUpdateSkills(q.skills || [data.category], isCorrect);
    setFeedback({ isCorrect, explanation: q.explanation });
  };

  const handleNext = () => {
    if (index < data.questions.length - 1) {
      setIndex(prev => prev + 1);
      setFeedback(null);
      setAnswer("");
    } else {
      onFinish([...results]);
    }
  };

  // ✅Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();

      // Enter Key: Submit or Next
      if (key === 'enter') {
        e.preventDefault();
        if (!!feedback) {
          handleNext();
        } else if (answer) {
          handleSubmit();
        }
      }

      // Numbers 1-4: Select options A-D (only if no feedback yet)
      if (!feedback && q.type === 'mcq') {
        let choiceIndex = -1;
        const k = key.toLowerCase(); // Normalize to lowercase once

          if (k === '1' || k === 'a') choiceIndex = 0;
          if (k === '2' || k === 'b') choiceIndex = 1;
          if (k === '3' || k === 'c') choiceIndex = 2;
          if (k === '4' || k === 'd') choiceIndex = 3;

        if (choiceIndex !== -1 && q.choices[choiceIndex]) {
          setAnswer(q.choices[choiceIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feedback, answer, q]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <span className="bg-orange-100 text-orange-700 px-4 py-1 rounded-full text-sm font-bold truncate">{data.category}</span>
        {settings.timerEnabled && <div className="text-2xl font-mono font-bold text-orange-600">{formatTime(timeLeft)}</div>}
      </div>
      <div className="bg-white p-8 rounded-2xl shadow-xl border-t-8 border-orange-500">
        <h2 className="text-xl md:text-2xl font-bold mb-8 text-gray-800">{index + 1}/{data.questions.length}. {q.prompt}</h2>
        <div className="space-y-4">
          {q.type === "mcq" ? q.choices.map((c, i) => (
            <label key={i} className={`flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all ${answer === c ? "bg-orange-50 border-orange-500" : "hover:bg-gray-50"} ${feedback ? "cursor-default opacity-80" : ""}`}>
              <input type="radio" name={q.id} value={c} checked={answer === c} onChange={e => !feedback && setAnswer(e.target.value)} disabled={!!feedback} className="hidden" />
              <span className={`w-8 h-8 flex items-center justify-center rounded-full mr-4 font-bold ${answer === c ? "bg-orange-500 text-white" : "bg-gray-200"}`}>{["A","B","C","D"][i]}</span>
              <span className="text-lg">{c}</span>
            </label>
          )) : <textarea value={answer} onChange={e => !feedback && setAnswer(e.target.value)} disabled={!!feedback} className="w-full p-4 border-2 rounded-xl focus:border-orange-400 outline-none" />}
        </div>
        {!feedback && <button onClick={handleSubmit} disabled={!answer} className="mt-8 w-full bg-gray-800 text-white font-bold py-4 rounded-xl hover:bg-black disabled:opacity-50">Submit (Enter)</button>}
      </div>
      {feedback && (
        <div className={`mt-6 p-6 rounded-2xl shadow-lg border-l-8 animate-fade-in ${feedback.isCorrect ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"}`}>
          <h3 className="font-black text-2xl mb-2">{feedback.isCorrect ? "🎉 Correct!" : "❌ Incorrect"}</h3>
          <p className="text-lg opacity-90">{feedback.explanation}</p>
          <button onClick={handleNext} className="mt-6 bg-gray-800 text-white font-bold py-3 px-8 rounded-xl hover:bg-black">
            {index < data.questions.length - 1 ? "Next Question (Enter) ➡" : "Finish Quiz (Enter)"}
          </button>
        </div>
      )}
    </div>
  );
}