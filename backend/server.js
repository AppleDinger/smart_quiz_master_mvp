// server.js
const express = require("express");
const cors = require("cors");

// init datastore (if present)
let dataStore;
try {
  dataStore = require("./data-store");
  dataStore.init().catch(console.error);
} catch (err) {
  console.warn("data-store not found or failed to init (OK for early dev):", err?.message || err);
}

const app = express();

app.use(cors());
app.use(express.json());

// Register extraction route (if you created it earlier)
try {
  app.use("/api/extract", require("./routes/extract"));
} catch (err) {
  console.warn("extract route not found or failed to load:", err?.message || err);
}

// Save-attempt and leaderboard routes
try {
  app.use("/api/save-attempt", require("./routes/saveAttempt"));
} catch (err) {
  console.warn("saveAttempt route not found or failed to load:", err?.message || err);
}

try {
  app.use("/api/leaderboard", require("./routes/leaderboard"));
} catch (err) {
  console.warn("leaderboard route not found or failed to load:", err?.message || err);
}

// health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Smart Quiz backend running on port ${PORT}`);
});
