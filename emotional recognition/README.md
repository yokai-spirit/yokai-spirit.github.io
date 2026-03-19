# Emotion Background Camera App

A browser-based web app that:
- Uses your webcam feed
- Detects face emotions (happiness, sadness, neutral, anger)
- Changes the full app background in real-time:
  - Happiness -> yellow
  - Sadness -> ocean blue and cyan
  - Neutral -> light gray
  - Anger -> green mixed with red

## Run locally

Camera access works best on secure origins (`https://`) or `localhost`.

### Option 1: Python

```bash
python -m http.server 8080
```

Then open: `http://localhost:8080`

### Option 2: VS Code Live Server extension

Open `index.html` with Live Server.

## Notes

- The app uses `face-api.js` from a CDN and downloads model files from:
  - `https://justadudewhohacks.github.io/face-api.js/models`
- Internet is required for model loading.
