
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// Allow CORS for both localhost and 127.0.0.1 on port 5500
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:5500', 'http://127.0.0.1:5500'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));


// Proxy route to avoid CORS issues
app.get('/api/all', async (req, res) => {
  try {
    const response = await fetch('https://starwars-databank.vercel.app/api/all');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Basic health check
app.get('/health', (req, res) => {
  res.send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
