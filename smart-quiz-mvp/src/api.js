const API_BASE_URL = "https://smart-quiz-master-x55k.onrender.com";

export async function extractPdf(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE_URL}/api/extract/pdf`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('PDF extraction failed');
  const data = await res.json();
  return data.text || '';
}

export async function extractYoutube(url) {
  const res = await fetch(`${API_BASE_URL}/api/extract/youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error('YouTube extraction failed');
  const data = await res.json();
  return data.transcript || '';
}

export async function generateQuiz(payload) {
  const res = await fetch(`${API_BASE_URL}/api/generate-quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Server Error: ${res.statusText}`);
  const data = await res.json();
  if (data.quizData?.questions) {
    data.quizData.questions.forEach((q, index) => { q.id = `q_${Date.now()}_${index + 1}`; });
  }
  return data.quizData;
}

export async function saveAttempt(username, correct, total) {
  return fetch(`${API_BASE_URL}/api/save-attempt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, correct, numQuestions: total })
  });
}