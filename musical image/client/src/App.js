
import React, { useState } from 'react';
import './style.css';

function App() {
  const [photo, setPhoto] = useState(null);
  const [result, setResult] = useState(null);
  const [settings, setSettings] = useState({
    tempo: 120,
    scale: 'major',
    instrument: 'synth',
  });

  const handlePhotoChange = (e) => {
    setPhoto(e.target.files[0]);
  };

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append('photo', photo);
    const res = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    setResult(data);
    // TODO: Generate music using Tone.js
  };

  const handleSettingChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  return (
    <div className="app-container">
      <div className="panel">
        <div className="upload-label">Upload Photo</div>
        <input type="file" accept="image/*" onChange={handlePhotoChange} />
        <button onClick={handleUpload} disabled={!photo}>Analyze & Generate Music</button>
        <div className="music-settings">
          <label>Tempo: {settings.tempo} BPM</label>
          <input type="range" name="tempo" min="60" max="180" value={settings.tempo} onChange={handleSettingChange} />
          <label>Scale</label>
          <select name="scale" value={settings.scale} onChange={handleSettingChange}>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="pentatonic">Pentatonic</option>
          </select>
          <label>Instrument</label>
          <select name="instrument" value={settings.instrument} onChange={handleSettingChange}>
            <option value="synth">Synth</option>
            <option value="piano">Piano</option>
            <option value="pluck">Pluck</option>
          </select>
        </div>
      </div>
      {result && (
        <div className="panel">
          <h2>Analysis Result</h2>
          <div>Colors: {result.colors.join(', ')}</div>
          <div>Objects: {result.objects.join(', ')}</div>
          <div>Music: {JSON.stringify(result.music)}</div>
          {/* TODO: Add Tone.js music playback */}
        </div>
      )}
    </div>
  );
}

export default App;
