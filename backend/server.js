// server.js
require('dotenv').config(); // Load environment variables
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const app = express();

// Initialize Gemini (Accessing key safely from server environment)
// Note: Make sure GEMINI_API_KEY is set in your Render Dashboard
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json()); // Allows parsing JSON bodies

// File Upload Support
const fileUpload = require("express-fileupload");
app.use(fileUpload({ useTempFiles: false }));

// --- DATABASE INIT (Keep your existing logic) ---
let dataStore;
try {
  dataStore = require("./data-store");
  dataStore.init().catch(console.error);
} catch (err) {
  console.warn("data-store not found or failed to init (OK for early dev):", err?.message || err);
}

// --- ROUTES ---

// 1. HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running!" });
});

// 2. GENERATE QUIZ ROUTE (The new secure route)
// server.js (Updated Route)

app.post("/api/generate-quiz", async (req, res) => {
  try {
    // 1. Receive all the complex parameters from Frontend
    const { 
      category, 
      difficulty, 
      numQuestions, 
      includeDescriptive, 
      customContext, 
      sourceText, 
      skillList 
    } = req.body;

    // 2. Reconstruct your specific Prompt Logic here (on the server)
    const questionTypeInstructions = includeDescriptive
      ? `Include both MCQ and short-answer questions.`
      : `Include ONLY MCQs.`;

    let sourceInstruction;
    if (sourceText) {
      sourceInstruction = `Generate all questions ONLY from this text:\n${sourceText.substring(0, 10000)}`; // Limit length for safety
    } else if (skillList && skillList.length > 0) {
      sourceInstruction = `Cover ALL of these topics equally: ${skillList.join(", ")}`;
    } else {
      sourceInstruction = `Generate questions strictly from the topic "${category}".`;
    }

    const contextInstruction = customContext
      ? `Additional focus: ${customContext}`
      : "";

    const prompt = `
      You are an expert quiz generator.
      ${sourceInstruction}
      ${contextInstruction}

      Difficulty: ${difficulty}
      Question Count: ${numQuestions}
      ${questionTypeInstructions}

      IMPORTANT:
      Return ONLY valid JSON in this structure:
      {
        "category": "${category}",
        "difficulty": "${difficulty}",
        "questions": [
          {
            "id": "q1",
            "prompt": "question text",
            "type": "mcq" | "short",
            "choices": ["A","B","C","D"],
            "answer": "correct answer",
            "explanation": "why this is correct",
            "skills": ["skill1", "skill2"],
            "difficulty": 0.5
          }
        ]
      }
      All questions must be ORIGINAL and fully based on the given topic.
    `;

    // 3. Call Gemini (Safe because API Key is on the server)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // 4. Clean and Parse JSON
    let text = response.text();
    text = text.replace(/^```json/i, '').replace(/```$/i, '').trim();
    
    // 5. Send back to Frontend
    res.json({ quizData: JSON.parse(text) });

  } catch (error) {
    console.error("Backend AI Error:", error);
    res.status(500).json({ error: "Generation failed", details: error.message });
  }
});

// 3. EXISTING ROUTES (Keep your existing logic)
// --- ROUTES ---

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running!" });
});

// EXTRACTION ROUTE (Debug Mode)
try {
  // Try to require the file
  const extractRoute = require("./routes/extract");
  // If successful, use it
  app.use("/api/extract", extractRoute);
  console.log("✅ Extract route loaded successfully.");
} catch (err) {
  // If it fails, PRINT THE EXACT ERROR
  console.error("❌ CRITICAL ERROR: Could not load extract route.");
  console.error("Reason:", err.message);
  if (err.code === 'MODULE_NOT_FOUND') {
    console.error("Hint: Check if 'backend/routes/extract.js' exists.");
  } else {
    console.error("Hint: A library inside extract.js failed to load.");
  }
}
try {
  app.use("/api/save-attempt", require("./routes/saveAttempt"));
} catch (err) { console.warn("saveAttempt route missing"); }

try {
  app.use("/api/leaderboard", require("./routes/leaderboard"));
} catch (err) { console.warn("leaderboard route missing"); }


// ✅ CORRECT
const PORT = process.env.PORT || 4000; 
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});