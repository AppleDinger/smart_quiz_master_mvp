const express = require("express");
const router = express.Router();
const dataStore = require("../data-store");

router.post("/", async (req, res) => {
  try {
    const { username, correct, numQuestions } = req.body;

    await dataStore.saveAttempt(username, {
      correct,
      numQuestions
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Save attempt error", err);
    res.status(500).json({ error: "Failed to save attempt" });
  }
});

module.exports = router;
