import React, { useState, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf"; 
import Navbar from "./components/Navbar";
import Auth from "./components/Auth";
import Leaderboard from "./components/Leaderboard";
import MultiTopicModal from "./components/MultiTopicModal";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Dashboard from "./pages/Dashboard";
import { saveAttempt, generateQuiz } from "./api";

const USERS_DB_KEY = "smartQuizUsers";
const SKILLS_DB_PREFIX = "smartQuizSkills_";
const API_BASE_URL = "https://smart-quiz-master-x55k.onrender.com";

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("home");
  const [skills, setSkills] = useState({});
  const [quizData, setQuizData] = useState(null);
  const [quizSettings, setQuizSettings] = useState({});
  const [lastSummary, setLastSummary] = useState(null);
  const [multiTopicSkills, setMultiTopicSkills] = useState(null);
  const [isMultiModalOpen, setMultiModalOpen] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) handleLogin(savedUser);
  }, []);

  const handleLogin = (username) => {
    setUser({ username });
    localStorage.setItem("currentUser", username);
    const savedSkills = localStorage.getItem(`${SKILLS_DB_PREFIX}${username}`);
    setSkills(savedSkills ? JSON.parse(savedSkills) : {});
    setPage("home");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("currentUser");
    setPage("home");
  };

  const handleStartQuiz = (data, settings) => {
    setQuizData(data);
    setQuizSettings(settings);
    setPage("quiz");
  };

  const handleMultiTopicStart = async (settings) => {
    setMultiModalOpen(false);
    try {
      const data = await generateQuiz({ 
        skillList: multiTopicSkills, 
        category: `Multi-Topic: ${multiTopicSkills.join(", ")}`,
        difficulty: "medium", 
        ...settings 
      });
      handleStartQuiz(data, settings);
    } catch (err) {
      alert("Failed to generate quiz: " + err.message);
    }
  };

  const handleFinishQuiz = (results) => {
    const correctCount = results.filter(r => r.isCorrect).length;
    saveAttempt(user.username, correctCount, results.length);
    setLastSummary({ category: quizData.category, results });
    setQuizData(null);
    setPage("dashboard");
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

  const handleDownloadQuiz = useCallback(() => {
    if (!lastSummary) return;
    try {
      const doc = new jsPDF();
      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const usableWidth = pageWidth - margin * 2;
      let y = 15;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`Quiz Summary: ${lastSummary.category.split(':').pop().trim()}`, margin, y);
      y += 10;

      lastSummary.results.forEach((result, index) => {
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
          doc.setTextColor(200, 0, 0); 
          const correctAnswerText = doc.splitTextToSize(`Correct Answer: ${result.correctAnswer}`, usableWidth);
          doc.text(correctAnswerText, margin, y);
          doc.setTextColor(0, 0, 0); 
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
      alert("PDF generation failed.");
    }
  }, [lastSummary]);

  if (!user) return <Auth onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-orange-50 font-sans text-gray-800 pb-10">
      <Navbar user={user} setPage={setPage} onLogout={handleLogout} />
      <main className="container mx-auto p-4 md:p-8 max-w-5xl">
        {page === "home" && <Home user={user} onStartQuiz={handleStartQuiz} />}
        {page === "quiz" && <Quiz data={quizData} settings={quizSettings} onFinish={handleFinishQuiz} onUpdateSkills={handleUpdateSkills} />}
        {page === "dashboard" && <Dashboard skills={skills} lastQuizSummary={lastSummary} onDownloadQuiz={handleDownloadQuiz} onSetupMultiQuiz={s => { setMultiTopicSkills(s); setMultiModalOpen(true); }} />}
        {page === "leaderboard" && <Leaderboard onClose={() => setPage("dashboard")} apiBase={API_BASE_URL} />}
      </main>
      <MultiTopicModal isOpen={isMultiModalOpen} skills={multiTopicSkills} onClose={() => setMultiModalOpen(false)} onStart={handleMultiTopicStart} />
    </div>
  );
}

export default App;