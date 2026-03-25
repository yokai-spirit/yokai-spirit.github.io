import express from 'express';
import multer from 'multer';
import cors from 'cors';

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.json());


import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

// Helper: extract top N colors from image
function extractColorsFromImage(filePath, topN = 5) {
  return loadImage(filePath).then(img => {
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    const colorCount = {};
    for (let i = 0; i < data.length; i += 4 * 24) { // sample every 24th pixel
      const r = data[i], g = data[i+1], b = data[i+2];
      const hex = rgbToHex(r, g, b);
      colorCount[hex] = (colorCount[hex] || 0) + 1;
    }
    const sorted = Object.entries(colorCount).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, topN).map(([hex]) => hex);
  });
}

function rgbToHex(r, g, b) {
  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

// Dummy object detection (returns empty array)
function detectObjects() {
  return [];
}

// Generate music data from colors
function generateMusicFromColors(colors, tempo = 120) {
  const baseNotes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
  const notes = colors.map((hex, idx) => baseNotes[idx % baseNotes.length]);
  return { notes, tempo };
}

app.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const colors = await extractColorsFromImage(filePath);
    const objects = detectObjects();
    const tempo = parseInt(req.body.tempo) || 120;
    const music = generateMusicFromColors(colors, tempo);
    // Clean up uploaded file
    fs.unlink(filePath, () => {});
    res.json({ colors, objects, music });
  } catch (err) {
    res.status(500).json({ error: 'Image analysis failed', details: err.message });
  }
});

app.listen(5000, () => console.log('Server running on port 5000'));
