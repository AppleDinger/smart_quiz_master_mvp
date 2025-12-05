// backend/data-store.js
const mongoose = require('mongoose');

// Define the shape of your data (Schema)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String }, // In a real app, hash this!
  skills: { type: Object, default: {} }, // Stores your skill scores
  attempts: [{
    id: String,
    correct: Number,
    numQuestions: Number,
    createdAt: { type: Date, default: Date.now }
  }]
});

// Create the Model
const User = mongoose.model('User', UserSchema);

// --- Functions ---

// 1. Initialize Connection
async function init() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI is missing in Environment Variables!");
    return;
  }
  
  try {
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
  }
}

// 2. Save a Quiz Attempt
async function saveAttempt(username, attempt) {
  // Find user, creating them if they don't exist (Upsert logic)
  let user = await User.findOne({ username });
  
  if (!user) {
    // Auto-register if user not found (matches your previous logic)
    user = new User({ username, password: "123", attempts: [] });
  }

  // Add the attempt
  user.attempts.push({
    id: String(Date.now()), // Simple ID
    correct: attempt.correct,
    numQuestions: attempt.numQuestions
  });

  await user.save();
  return user;
}

// 3. Get All Users (For Leaderboard)
async function getAllUsers() {
  // Return plain JSON objects
  return await User.find().lean();
}

// 4. Update User Skills/Password (For Login Sync)
async function updateUser(username, password, skills) {
  let user = await User.findOne({ username });

  if (!user) {
    user = new User({ username, password, skills });
  } else {
    if (password) user.password = password;
    // Merge new skills with existing ones
    if (skills) {
      user.skills = { ...user.skills, ...skills };
    }
  }
  
  await user.save();
}

module.exports = { init, saveAttempt, getAllUsers, updateUser };