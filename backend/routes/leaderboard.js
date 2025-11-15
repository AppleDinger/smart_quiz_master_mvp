const express = require("express");
const router = express.Router();
const dataStore = require("../data-store");

router.get("/", async (req, res) => {
  try {
    const users = await dataStore.getAllUsers();

    const leaderboard = users
      .map(u => {
        const totalCorrect = u.attempts?.reduce((sum, a) => sum + (a.correct || 0), 0) || 0;
        const totalQuestions = u.attempts?.reduce((sum, a) => sum + (a.numQuestions || 0), 0) || 0;

        return {
          username: u.username,
          totalCorrect,
          totalQuestions,
          accuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0
        };
      })
      .sort((a, b) => b.totalCorrect - a.totalCorrect)
      .slice(0, 50);

    res.json({ ok: true, leaderboard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Leaderboard error" });
  }
});

module.exports = router;
