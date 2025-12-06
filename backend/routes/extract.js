const express = require('express');
const router = express.Router();
const fs = require('fs');
const pdfParse = require('pdf-parse');

// --- HEAVY LIBRARIES (OCR & Rendering) ---
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');
const Tesseract = require('tesseract.js');
const { YoutubeTranscript } = require('youtube-transcript');

// --- HELPER 1: Extract Video ID from YouTube URL ---
function getYoutubeVideoId(url) {
  // Regex to handle full URLs, short links (youtu.be), and embeds
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// --- HELPER 2: Extract Text using pdf-parse (Fast) ---
async function extractTextPdfParse(buffer) {
  try {
    const data = await pdfParse(buffer);
    return (data && data.text) ? data.text.trim() : '';
  } catch (err) {
    console.warn('pdf-parse failed:', err?.message || err);
    return '';
  }
}

// --- HELPER 3: Render PDF Page to Image (for OCR) ---
async function renderPdfPageToPngBuffer(pdfDocument, pageNum, scale = 1.5) {
  const page = await pdfDocument.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  
  // Create Canvas
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  // Canvas Factory for pdfjs
  const canvasFactory = {
    create: (w, h) => {
      const c = createCanvas(w, h);
      const context = c.getContext('2d');
      return { canvas: c, context, width: w, height: h };
    },
    reset: (canvasAndContext, w, h) => {
      canvasAndContext.canvas.width = w;
      canvasAndContext.canvas.height = h;
      canvasAndContext.width = w;
      canvasAndContext.height = h;
    },
    destroy: (canvasAndContext) => {
      // Node-canvas handles garbage collection
    }
  };

  const renderContext = {
    canvasContext: ctx,
    viewport,
    canvasFactory
  };

  await page.render(renderContext).promise;
  return canvas.toBuffer('image/png');
}

// --- HELPER 4: OCR Logic (Tesseract) ---
async function ocrImageBuffers(buffers, lang = 'eng') {
  let fullText = '';
  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    try {
      const { data: { text } } = await Tesseract.recognize(buf, lang, {
        logger: m => { /* console.log(m) */ } // hiding logs to keep console clean
      });
      fullText += '\n\n' + text;
    } catch (err) {
      console.warn('Tesseract OCR failed for page', i + 1, err?.message || err);
    }
  }
  return fullText.trim();
}

// ==========================================
// ROUTES
// ==========================================

// 1. PDF EXTRACTION (Text + OCR Fallback)
router.post('/pdf', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded. Field name should be "file".' });
    }

    const uploaded = req.files.file;
    const buffer = uploaded.data || fs.readFileSync(uploaded.tempFilePath);

    // Step A: Fast Text Extract
    let extracted = await extractTextPdfParse(buffer);

    // Step B: OCR Fallback if text is too short (< 100 chars)
    if (!extracted || extracted.length < 100) {
      console.log('PDF text empty or short. Running OCR fallback...');

      // Load PDF for Rendering
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdfDoc = await loadingTask.promise;

      // Limit to first 5 pages to prevent timeouts
      const maxPages = Math.min(5, pdfDoc.numPages);
      const imgBuffers = [];

      for (let p = 1; p <= maxPages; p++) {
        try {
          const imgBuf = await renderPdfPageToPngBuffer(pdfDoc, p, 1.5);
          imgBuffers.push(imgBuf);
        } catch (err) {
          console.warn('Failed to render page', p, err?.message || err);
        }
      }

      if (imgBuffers.length > 0) {
        const ocrText = await ocrImageBuffers(imgBuffers, 'eng');
        if (ocrText && ocrText.length > extracted.length) {
          extracted = ocrText;
        }
      }
    }

    return res.json({ ok: true, text: extracted || '' });
  } catch (err) {
    console.error('extract/pdf error:', err);
    return res.status(500).json({ error: 'PDF extraction failed', details: String(err) });
  }
});

// 2. YOUTUBE EXTRACTION
router.post('/youtube', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'No URL provided' });
    }

    // Step A: Get Video ID
    const videoId = getYoutubeVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL format' });
    }

    console.log(`Fetching transcript for Video ID: ${videoId}`);

    // Step B: Fetch Transcript (Any Language)
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    
    // Step C: Combine Text
    if (!transcriptItems || transcriptItems.length === 0) {
        throw new Error("Transcript empty or not found.");
    }

    const fullText = transcriptItems.map(item => item.text).join(' ');

    res.json({ ok: true, transcript: fullText });

  } catch (err) {
    console.error('YouTube extraction error:', err);
    
    let errorMessage = 'Failed to extract captions.';
    const errStr = String(err);

    if (errStr.includes("Sign in")) {
      errorMessage = "YouTube blocked the server (Bot detection). Try a different video.";
    } else if (errStr.includes("Captions are disabled")) {
      errorMessage = "This video does not have captions enabled.";
    }

    res.status(500).json({ 
      error: errorMessage,
      details: errStr 
    });
  }
});

module.exports = router;