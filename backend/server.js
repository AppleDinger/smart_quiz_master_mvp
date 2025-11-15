require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const pdfParse = require('pdf-parse');
const ytdl = require('ytdl-core');

// Attempt to require transcript helper. If unavailable we'll fallback gracefully.
let YoutubeTranscript;
try {
  YoutubeTranscript = require('youtube-transcript').default || require('youtube-transcript');
} catch (err) {
  // not installed / not available — we'll fallback to description
  YoutubeTranscript = null;
  console.warn('youtube-transcript package not available, falling back to description when transcripts are missing.');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// configure multer for file uploads (store in memory)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Simple health route
app.get('/api/health', (req, res) => res.json({ ok: true }));

// POST /api/extract/pdf
// body: multipart/form-data with field "file"
app.post('/api/extract/pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
    }
    const dataBuffer = req.file.buffer;
    const data = await pdfParse(dataBuffer);
    // pdf-parse returns text and metadata. We return the text trimmed.
    const text = (data && data.text) ? data.text.trim() : '';
    return res.json({ text, info: data.info || null });
  } catch (err) {
    console.error('PDF extract error:', err);
    return res.status(500).json({ error: 'Failed to extract text from PDF.' });
  }
});

// POST /api/extract/youtube
// body: { url: string }
// returns { transcript: "...", fallback: "description used" } or error
app.post('/api/extract/youtube', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url in request body' });

    // extract video id using ytdl's utility
    let videoId;
    try {
      videoId = ytdl.getURLVideoID(url);
    } catch (err) {
      // last ditch: regex
      const m = url.match(/(?:v=|\/v\/|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/);
      videoId = m ? m[1] : null;
    }
    if (!videoId) return res.status(400).json({ error: 'Unable to parse YouTube video id from URL' });

    // 1) Try to get a transcript (captions) if youtube-transcript is available
    if (YoutubeTranscript) {
      try {
        // youtube-transcript returns an array of { text, start, duration }
        const transcriptParts = await YoutubeTranscript.fetchTranscript(videoId);
        if (transcriptParts && transcriptParts.length > 0) {
          const transcript = transcriptParts.map(p => p.text).join(' ');
          return res.json({ transcript, source: 'captions' });
        }
      } catch (err) {
        // continue to fallback
        console.warn('No transcript via youtube-transcript or an error occurred:', err?.message || err);
      }
    }

    // 2) Fallback - fetch video info and use description as source text
    try {
      const info = await ytdl.getInfo(videoId);
      const videoDetails = info && info.videoDetails ? info.videoDetails : null;
      const title = videoDetails?.title || 'YouTube Video';
      const description = videoDetails?.shortDescription || videoDetails?.description || '';
      const combined = `Title: ${title}\n\nDescription:\n${description}`;
      return res.json({ transcript: combined, source: 'description' });
    } catch (err) {
      console.error('ytdl-core error:', err);
      return res.status(500).json({ error: 'Failed to retrieve video info or transcript.' });
    }

  } catch (err) {
    console.error('YouTube extract error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Smart Quiz backend listening on port ${PORT}`);
});
