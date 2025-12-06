const mongoose = require('mongoose');

// 1. Define the User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String },
  skills: { type: Object, default: {} },
  attempts: [{
    id: String,
    correct: Number,
    numQuestions: Number,
    createdAt: { type: Date, default: Date.now }
  }]
});

const User = mongoose.model('User', UserSchema);

// 2. Initialize Connection
async function init() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ CRITICAL: MONGO_URI is missing in Environment Variables!");
    return;
  }
  
  try {
    // Connect to specific database 'smartquiz_db'
    await mongoose.connect(uri, { dbName: 'smartquiz_db' });
    console.log("✅ Connected to MongoDB Atlas (smartquiz_db)");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
  }
}

// 3. Save Attempt Function
async function saveAttempt(username, attempt) {
  try {
    let user = await User.findOne({ username });
    
    // Create user if not exists
    if (!user) {
      console.log(`Creating new user: ${username}`);
      user = new User({ username, password: "default123", attempts: [] });
    }

    // Add attempt
    user.attempts.push({
      id: String(Date.now()),
      correct: attempt.correct,
      numQuestions: attempt.numQuestions
    });

    await user.save();
    console.log(`✅ Saved attempt for ${username}`);
    return user;
  } catch (e) {
    console.error("Error saving attempt:", e);
    throw e;
  }
}

// 4. Get All Users (For Leaderboard)
async function getAllUsers() {
  return await User.find().lean();
}

// 5. Update User (For Sync)
async function updateUser(username, password, skills) {
  try {
    let user = await User.findOne({ username });
    if (!user) {
      user = new User({ username, password, skills });
    } else {
      if (password) user.password = password;
      if (skills) user.skills = { ...user.skills, ...skills };
    }
    await user.save();
    console.log(`✅ Synced data for ${username}`);
  } catch (e) {
    console.error("Error syncing user:", e);
  }
}

module.exports = { init, saveAttempt, getAllUsers, updateUser };