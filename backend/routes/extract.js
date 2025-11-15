// routes/extract.js - minimal stub so server loads cleanly during dev
const express = require('express');
const router = express.Router();

// health-like endpoints for testing extraction routes (replace with real logic later)
router.post('/pdf', (req, res) => {
  res.json({ ok: true, text: "No extract implementation yet. Upload received." });
});
router.post('/youtube', (req, res) => {
  res.json({ ok: true, transcript: "No transcript implementation yet." });
});

module.exports = router;
