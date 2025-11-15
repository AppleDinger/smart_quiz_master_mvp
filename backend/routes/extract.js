// backend/routes/extract.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');

const pdfParse = require('pdf-parse');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');
const Tesseract = require('tesseract.js');

// Helper: extract using pdf-parse (selectable text)
async function extractTextPdfParse(buffer) {
  try {
    const data = await pdfParse(buffer);
    return (data && data.text) ? data.text.trim() : '';
  } catch (err) {
    console.warn('pdf-parse failed:', err?.message || err);
    return '';
  }
}

// Helper: render a PDF page to PNG buffer using pdfjs + node-canvas
async function renderPdfPageToPngBuffer(pdfDocument, pageNum, scale = 1.5) {
  const page = await pdfDocument.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  // pdfjs requires a NodeCanvasFactory - provide a simple one
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
      // nothing to do for node-canvas
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

// Helper: OCR an array of image buffers with tesseract.js (sequential to limit memory)
async function ocrImageBuffers(buffers, lang = 'eng') {
  let fullText = '';
  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    try {
      const { data: { text } } = await Tesseract.recognize(buf, lang, {
        logger: m => { /* optional logging: console.log('tess', m) */ }
      });
      fullText += '\n\n' + text;
    } catch (err) {
      console.warn('Tesseract OCR failed for page', i + 1, err?.message || err);
    }
  }
  return fullText.trim();
}

// Main route: POST /api/extract/pdf
// Expects file in field 'file' via express-fileupload (req.files.file)
router.post('/pdf', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded. Field name should be "file".' });
    }

    const uploaded = req.files.file;
    // uploaded.data available when using express-fileupload with no temp files
    const buffer = uploaded.data || fs.readFileSync(uploaded.tempFilePath);

    // 1) Try text extraction via pdf-parse
    let extracted = await extractTextPdfParse(buffer || Buffer.from([]));

    // If primary extraction is short, fallback to OCR using Tesseract (via pdfjs rendering)
    if (!extracted || extracted.length < 300) {
      console.log('Primary PDF text short; running JS OCR fallback (this may take a few seconds)...');

      // Load PDF with pdfjs from buffer; pdfjs needs Uint8Array
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdfDoc = await loadingTask.promise;

      // Limit pages to first N to save time
      const maxPages = Math.min(3, pdfDoc.numPages); // adjust as needed
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
      } else {
        console.warn('No images rendered for OCR fallback.');
      }
    }

    // Return the extracted text (may be empty)
    return res.json({ ok: true, text: extracted || '' });
  } catch (err) {
    console.error('extract/pdf error:', err);
    return res.status(500).json({ error: 'PDF extraction failed', details: String(err) });
  }
});

module.exports = router;
