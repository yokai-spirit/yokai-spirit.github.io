const canvas = document.getElementById("drawingCanvas");
const colorButton = document.getElementById("colorButton");
const resetColorsButton = document.getElementById("resetColorsButton");
const magnetModeButton = document.getElementById("magnetModeButton");
const symmetryModeButton = document.getElementById("symmetryModeButton");
const recordLoopButton = document.getElementById("recordLoopButton");
const shakeClearButton = document.getElementById("shakeClearButton");
const colorPicker = document.getElementById("colorPicker");
const palette = document.getElementById("palette");
const ctx = canvas.getContext("2d");

// Drawing and gradient color state.
let isDrawing = false;
let lastX = 0;
let lastY = 0;
const defaultColorQueue = ["#00f0ff", "#00a2ff", "#b832ff", "#ff2ad9"];
let colorQueue = [...defaultColorQueue];
let distanceDrawn = 0;
const transitionDistance = 180;
const fallbackColor = "#00f0ff";

// Web Audio node references (created lazily on first user interaction).
let audioContext;
let masterGain;
let analyserNode;
let filterNode;
let distortionNode;
let delayNode;
let delayFeedback;
let delayWet;
let ambientFilter;
let ambientGain;
let voiceGain;
let chordGain;
let oscA;
let oscB;
let chordOsc1;
let chordOsc2;
let chordOsc3;
let ambientOsc1;
let ambientOsc2;
let ambientOsc3;
let lfo;
let lfoGain;
let noiseBuffer;

// Runtime flags and time trackers for interactive sound design.
let audioReady = false;
let breakcoreStep = 0;
let nextBreakHitTime = 0;
let drawStartTime = 0;
let currentColorWeights = { red: 0.34, blue: 0.33, yellow: 0.33 };
let targetEchoMix = 0.12;
let targetEchoFeedback = 0.28;
let echoEnergy = 0;
let visualFrameId;
let waveData = new Uint8Array(256);
let waveTremble = 0;
let waveTremblePhase = 0;
let brushWavePhase = 0;
let magnetModeEnabled = false;
let symmetryModeEnabled = false;
let magnets = [];
let particles = [];
let lastFrameTime = 0;
let isLoopRecording = false;
let loopPlaying = false;
let recordingStartTime = 0;
let recordingEndsAt = 0;
let loopPlaybackStartTime = 0;
let lastLoopCursorMs = 0;
let loopRecordTimeoutId;
let loopSegments = [];
let strokeHistory = [];
let clearSparks = [];
let shakeClearActive = false;
let shakeClearEndAt = 0;
let colorPresence = { r: 0, g: 0, b: 0, total: 0 };
const breakcoreBpm = 176;
const breakcoreInterval = 60 / breakcoreBpm / 8;
const yellowGlideDuration = 4.5;
const trailFadeStrength = 0.022;
const maxMagnets = 8;
const loopDurationMs = 5000;
const shakeClearDurationMs = 900;

// Small utility helpers for color and value transforms.
function normalizeHexColor(hexColor) {
  return hexColor.trim().toLowerCase();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgba(hexColor, alpha) {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hexColor) {
  const hex = hexColor.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  const toHex = (value) => Math.round(value).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHexColors(colorA, colorB, t) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
}

function getColorAtDistance(distance) {
  if (colorQueue.length === 0) {
    return fallbackColor;
  }

  if (colorQueue.length === 1) {
    return colorQueue[0];
  }

  const cycleLength = transitionDistance * colorQueue.length;
  const wrapped = ((distance % cycleLength) + cycleLength) % cycleLength;
  const index = Math.floor(wrapped / transitionDistance);
  const nextIndex = (index + 1) % colorQueue.length;
  const blend = (wrapped - index * transitionDistance) / transitionDistance;

  return mixHexColors(colorQueue[index], colorQueue[nextIndex], blend);
}

function renderPalette() {
  palette.innerHTML = "";

  colorQueue.forEach((color) => {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = color;
    palette.appendChild(swatch);
  });
}

function addColorToQueue(color) {
  colorQueue.push(normalizeHexColor(color));
  if (colorQueue.length > 12) {
    colorQueue = colorQueue.slice(colorQueue.length - 12);
  }

  renderPalette();
}

function resetColorQueue() {
  colorQueue = [];
  distanceDrawn = 0;
  colorPicker.value = fallbackColor;
  ctx.shadowColor = hexToRgba(getColorAtDistance(distanceDrawn), 0.45);
  renderPalette();
}

// Maps vertical cursor position to pitch (higher Y -> lower pitch, and vice versa).
function mapYToFrequency(y) {
  const height = canvas.clientHeight || 1;
  const normalized = clamp(1 - y / height, 0, 1);
  const minFreq = 95;
  const maxFreq = 1060;
  return minFreq * (maxFreq / minFreq) ** normalized;
}

function createDistortionCurve(amount) {
  const k = clamp(amount, 0, 400);
  const sampleCount = 44100;
  const curve = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    const x = i * 2 / sampleCount - 1;
    curve[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x));
  }

  return curve;
}

function createNoiseBuffer() {
  const frameCount = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

// Converts any selected color into red/blue/yellow influence weights.
function getColorWeights(hexColor) {
  const rgb = hexToRgb(hexColor);
  const anchors = [
    { key: "red", rgb: { r: 255, g: 58, b: 72 } },
    { key: "blue", rgb: { r: 65, g: 145, b: 255 } },
    { key: "yellow", rgb: { r: 255, g: 225, b: 70 } }
  ];

  const similarities = {};
  let sum = 0;

  anchors.forEach((anchor) => {
    const dr = rgb.r - anchor.rgb.r;
    const dg = rgb.g - anchor.rgb.g;
    const db = rgb.b - anchor.rgb.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    const similarity = 1 / (distance + 1);
    similarities[anchor.key] = similarity;
    sum += similarity;
  });

  return {
    red: similarities.red / sum,
    blue: similarities.blue / sum,
    yellow: similarities.yellow / sum
  };
}

// Tracks how much color is currently visible so the ambient bed can react to visuals.
function registerColorPresence(hexColor, amount = 1) {
  const rgb = hexToRgb(hexColor);
  const weight = clamp(amount, 0, 2.5);
  colorPresence.r = clamp(colorPresence.r + (rgb.r / 255) * weight, 0, 24);
  colorPresence.g = clamp(colorPresence.g + (rgb.g / 255) * weight, 0, 24);
  colorPresence.b = clamp(colorPresence.b + (rgb.b / 255) * weight, 0, 24);
  colorPresence.total = clamp(colorPresence.total + weight, 0, 48);
}

function decayColorPresence() {
  const decay = 0.986;
  colorPresence.r *= decay;
  colorPresence.g *= decay;
  colorPresence.b *= decay;
  colorPresence.total *= decay;
}

function getColorPresenceStats() {
  const colorSum = colorPresence.r + colorPresence.g + colorPresence.b;
  const density = clamp(colorPresence.total / 18, 0, 1);
  const safeSum = Math.max(0.0001, colorSum);

  return {
    density,
    redShare: colorPresence.r / safeSum,
    greenShare: colorPresence.g / safeSum,
    blueShare: colorPresence.b / safeSum
  };
}

// Drives ambient background texture from color density and color balance.
function updateAmbientVibe() {
  if (!audioReady) {
    return;
  }

  const stats = getColorPresenceStats();
  const now = audioContext.currentTime;

  const base = 72 + stats.density * 88;
  const drift = stats.blueShare * 24 - stats.redShare * 16;

  ambientOsc1.frequency.setTargetAtTime(base + drift, now, 0.28);
  ambientOsc2.frequency.setTargetAtTime(base * (1.24 + stats.greenShare * 0.05), now, 0.3);
  ambientOsc3.frequency.setTargetAtTime(base * (1.51 + stats.blueShare * 0.07), now, 0.32);

  const ambientCutoff = 240 + stats.density * 1400 + stats.blueShare * 220;
  ambientFilter.frequency.setTargetAtTime(ambientCutoff, now, 0.24);
  ambientFilter.Q.setTargetAtTime(0.7 + stats.redShare * 2.2, now, 0.24);
  ambientGain.gain.setTargetAtTime(0.006 + stats.density * 0.065, now, 0.26);
}

function getDominantFamily(weights) {
  if (weights.red >= weights.blue && weights.red >= weights.yellow) {
    return "red";
  }

  if (weights.blue >= weights.yellow) {
    return "blue";
  }

  return "yellow";
}

// Sets synth timbre based on color family and drawing speed.
function applyInstrumentProfile(weights, y, now, speed = 0) {
  const yNorm = clamp(1 - y / (canvas.clientHeight || 1), 0, 1);
  const dominant = getDominantFamily(weights);

  if (dominant === "red") {
    oscA.type = "sawtooth";
    oscB.type = "square";
  } else if (dominant === "blue") {
    oscA.type = "sine";
    oscB.type = "triangle";
  } else {
    oscA.type = "sawtooth";
    oscB.type = "triangle";
  }

  const detune = -7 * weights.red + 3 * weights.blue + 10 * weights.yellow;
  oscB.detune.setTargetAtTime(detune, now, 0.03);

  const speedBoost = clamp(speed, 0, 1);
  const filterFrequency = 600 + yNorm * 1800 + weights.yellow * 900 - weights.red * 320 + speedBoost * 1100;
  filterNode.type = "lowpass";
  filterNode.frequency.setTargetAtTime(filterFrequency, now, 0.05);
  filterNode.Q.setTargetAtTime(1.2 + weights.red * 3.6 + weights.yellow * 1.1 + speedBoost * 4.2, now, 0.05);

  lfoGain.gain.setTargetAtTime(4 + weights.red * 9 + weights.yellow * 3, now, 0.06);

  const drive = 35 + weights.red * 230 + weights.yellow * 70 + speedBoost * 110;
  distortionNode.curve = createDistortionCurve(drive);

  const blurAmount = weights.blue;
  delayNode.delayTime.setTargetAtTime(0.12 + blurAmount * 0.18, now, 0.07);
  targetEchoFeedback = 0.16 + blurAmount * 0.5;
  targetEchoMix = 0.05 + blurAmount * 0.28;

  const body = 0.045 + weights.red * 0.045 + weights.yellow * 0.02 + speedBoost * 0.03;
  voiceGain.gain.setTargetAtTime(body, now, 0.04);
}

// Smoothly updates delay echo parameters so visuals and audio tail feel connected.
function updateEchoTail() {
  if (!audioReady) {
    return;
  }

  const now = audioContext.currentTime;
  const wet = targetEchoMix * echoEnergy;
  const feedback = 0.06 + targetEchoFeedback * echoEnergy;
  delayWet.gain.setTargetAtTime(wet, now, 0.08);
  delayFeedback.gain.setTargetAtTime(feedback, now, 0.1);
}

// Mode toggles are mutually exclusive where needed to avoid interaction conflicts.
function toggleMagnetMode() {
  magnetModeEnabled = !magnetModeEnabled;
  if (magnetModeEnabled) {
    symmetryModeEnabled = false;
    symmetryModeButton.textContent = "Symmetry: Off";
  }
  magnetModeButton.textContent = magnetModeEnabled ? "Magnet Mode: On" : "Magnet Mode: Off";
  canvas.style.cursor = magnetModeEnabled ? "copy" : "crosshair";
}

function toggleSymmetryMode() {
  symmetryModeEnabled = !symmetryModeEnabled;
  if (symmetryModeEnabled) {
    magnetModeEnabled = false;
    magnetModeButton.textContent = "Magnet Mode: Off";
  }

  symmetryModeButton.textContent = symmetryModeEnabled ? "Symmetry: On" : "Symmetry: Off";
  canvas.style.cursor = "crosshair";
}

function setLoopButtonLabel(text) {
  recordLoopButton.textContent = text;
}

// Looper: records drawing segments for exactly 5s and replays them continuously.
function beginLoopPlayback() {
  if (loopSegments.length === 0) {
    loopPlaying = false;
    setLoopButtonLabel("Record Loop (5s)");
    return;
  }

  initAudio();
  if (audioReady && audioContext.state === "suspended") {
    audioContext.resume();
  }

  loopPlaying = true;
  loopPlaybackStartTime = performance.now();
  lastLoopCursorMs = 0;
  setLoopButtonLabel("Re-record Loop (5s)");
}

function finishLoopRecording() {
  isLoopRecording = false;
  recordingEndsAt = 0;
  clearTimeout(loopRecordTimeoutId);
  loopRecordTimeoutId = undefined;
  beginLoopPlayback();
}

function startLoopRecording() {
  if (magnetModeEnabled) {
    magnetModeEnabled = false;
    magnetModeButton.textContent = "Magnet Mode: Off";
    canvas.style.cursor = "crosshair";
  }

  isLoopRecording = true;
  loopPlaying = false;
  loopSegments = [];
  recordingStartTime = performance.now();
  recordingEndsAt = recordingStartTime + loopDurationMs;

  initAudio();
  if (audioReady && audioContext.state === "suspended") {
    audioContext.resume();
  }

  setLoopButtonLabel("Recording... 5.0s");
  clearTimeout(loopRecordTimeoutId);
  loopRecordTimeoutId = setTimeout(() => {
    finishLoopRecording();
  }, loopDurationMs);
}

function updateLoopRecordButtonCountdown(nowMs) {
  if (!isLoopRecording) {
    return;
  }

  const remainingMs = Math.max(0, recordingEndsAt - nowMs);
  const remainingSeconds = (remainingMs / 1000).toFixed(1);
  setLoopButtonLabel(`Recording... ${remainingSeconds}s`);
}

function recordLoopSegment(x1, y1, x2, y2, startColor, endColor, segmentDistance) {
  if (!isLoopRecording) {
    return;
  }

  const offset = clamp(performance.now() - recordingStartTime, 0, loopDurationMs);
  loopSegments.push({
    time: offset,
    x1,
    y1,
    x2,
    y2,
    startColor,
    endColor,
    segmentDistance
  });
}

function replayLoopWindow(startMs, endMs) {
  loopSegments.forEach((segment) => {
    if (segment.time < startMs || segment.time >= endMs) {
      return;
    }

    drawWaveformSegment(
      segment.x1,
      segment.y1,
      segment.x2,
      segment.y2,
      segment.startColor,
      segment.endColor,
      segment.segmentDistance
    );
    registerColorPresence(segment.endColor, 0.06);
    updateDrawingSound(segment.y2, segment.endColor, segment.segmentDistance);
  });
}

function updateLoopPlayback(nowMs) {
  if (!loopPlaying || loopSegments.length === 0) {
    return;
  }

  const current = (nowMs - loopPlaybackStartTime) % loopDurationMs;
  const previous = lastLoopCursorMs;

  if (current >= previous) {
    replayLoopWindow(previous, current);
  } else {
    replayLoopWindow(previous, loopDurationMs);
    replayLoopWindow(0, current);
  }

  lastLoopCursorMs = current;
}

// Magic-board clear: explode existing content into sparks and fade audio quickly.
function triggerShakeToClear() {
  const now = performance.now();
  shakeClearActive = true;
  shakeClearEndAt = now + shakeClearDurationMs;

  const seeds = [];
  const sampleStep = Math.max(1, Math.floor(strokeHistory.length / 90));
  for (let i = 0; i < strokeHistory.length; i += sampleStep) {
    seeds.push(strokeHistory[i]);
  }

  particles.forEach((particle) => {
    seeds.push({ x: particle.x, y: particle.y, color: `hsla(${180 + particle.lane * 26}, 95%, 66%, 1)` });
  });

  clearSparks = seeds.slice(0, 160).map((seed, index) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 220;
    return {
      x: seed.x,
      y: seed.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.65 + Math.random() * 0.5,
      age: (index % 3) * 0.02,
      color: seed.color || "rgba(0, 240, 255, 1)",
      size: 1.6 + Math.random() * 2.4
    };
  });

  if (audioReady) {
    const audioNow = audioContext.currentTime;
    voiceGain.gain.setTargetAtTime(0, audioNow, 0.06);
    chordGain.gain.setTargetAtTime(0, audioNow, 0.08);
    masterGain.gain.setTargetAtTime(0.05, audioNow, 0.22);
    targetEchoMix = 0;
    targetEchoFeedback = 0;
  }

  echoEnergy = Math.max(echoEnergy, 0.35);
  waveTremble = Math.max(waveTremble, 0.7);
  colorPresence = { r: 0, g: 0, b: 0, total: 0 };
  magnets = [];
  particles = [];
  loopPlaying = false;
  isLoopRecording = false;
  clearTimeout(loopRecordTimeoutId);
  loopRecordTimeoutId = undefined;
  setLoopButtonLabel("Record Loop (5s)");
}

function updateAndDrawClearSparks(deltaSeconds) {
  if (clearSparks.length === 0) {
    return;
  }

  clearSparks = clearSparks.filter((spark) => spark.age < spark.life);
  if (clearSparks.length === 0) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  clearSparks.forEach((spark) => {
    spark.age += deltaSeconds;
    spark.vx *= 0.986;
    spark.vy *= 0.986;
    spark.vy += 12 * deltaSeconds;
    spark.x += spark.vx * deltaSeconds;
    spark.y += spark.vy * deltaSeconds;

    const lifeT = 1 - spark.age / spark.life;
    if (lifeT <= 0) {
      return;
    }

    ctx.fillStyle = spark.color.includes("hsla")
      ? spark.color.replace(", 1)", `, ${lifeT.toFixed(3)})`)
      : `rgba(0, 240, 255, ${lifeT.toFixed(3)})`;
    ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size * lifeT, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function getSymmetrySegments(x1, y1, x2, y2) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const mirrors = [
    { x: x1, y: y1, nx: x2, ny: y2 },
    { x: width - x1, y: y1, nx: width - x2, ny: y2 },
    { x: x1, y: height - y1, nx: x2, ny: height - y2 },
    { x: width - x1, y: height - y1, nx: width - x2, ny: height - y2 }
  ];

  return mirrors;
}

// Symmetry audio uses mirrored Y positions to create a chord-like spread.
function getSymmetryChordFrequencies(y) {
  const mirroredY = (canvas.clientHeight || 1) - y;
  const fA = mapYToFrequency(y);
  const fB = mapYToFrequency(mirroredY);
  return [fA, fA * 1.26, fB * 0.76, fB * 1.5];
}

// Magnet system: orbiting particles emit rhythmic micro-events while moving.
function addMagnet(x, y) {
  const magnet = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    x,
    y,
    strength: 0.8 + Math.random() * 0.9
  };

  magnets.push(magnet);
  if (magnets.length > maxMagnets) {
    const removed = magnets.shift();
    particles = particles.filter((particle) => particle.magnetId !== removed.id);
  }

  const newParticles = Array.from({ length: 6 }).map((_, index) => ({
    magnetId: magnet.id,
    radius: 24 + index * 8 + Math.random() * 10,
    angle: Math.random() * Math.PI * 2,
    speed: 0.9 + Math.random() * 2.6,
    hueShift: Math.random() * 50 - 25,
    lane: index,
    beat: -1,
    x,
    y
  }));

  particles.push(...newParticles);
}

function getMagnetById(magnetId) {
  return magnets.find((magnet) => magnet.id === magnetId);
}

function triggerMagnetParticleHit(particle, magnet) {
  initAudio();
  if (!audioReady) {
    return;
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const now = audioContext.currentTime;
  const radialTone = 150 + particle.radius * 7;
  const beatBoost = particle.beat * 18;
  const pitch = radialTone + beatBoost;

  const hitOsc = audioContext.createOscillator();
  hitOsc.type = particle.lane % 2 === 0 ? "triangle" : "sawtooth";
  hitOsc.frequency.setValueAtTime(pitch, now);
  hitOsc.frequency.exponentialRampToValueAtTime(pitch * 0.72, now + 0.16);

  const hitGain = audioContext.createGain();
  const hitLevel = 0.015 + magnet.strength * 0.012;
  hitGain.gain.setValueAtTime(0.0001, now);
  hitGain.gain.exponentialRampToValueAtTime(hitLevel, now + 0.01);
  hitGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);

  const shapeFilter = audioContext.createBiquadFilter();
  shapeFilter.type = "bandpass";
  shapeFilter.frequency.value = 700 + particle.lane * 180;
  shapeFilter.Q.value = 2 + magnet.strength * 1.8;

  hitOsc.connect(shapeFilter);
  shapeFilter.connect(hitGain);
  hitGain.connect(masterGain);

  hitOsc.start(now);
  hitOsc.stop(now + 0.22);
}

function updateMagnetParticles(deltaSeconds) {
  if (particles.length === 0) {
    return;
  }

  particles.forEach((particle) => {
    const magnet = getMagnetById(particle.magnetId);
    if (!magnet) {
      return;
    }

    particle.angle += particle.speed * deltaSeconds;
    particle.x = magnet.x + Math.cos(particle.angle) * particle.radius;
    particle.y = magnet.y + Math.sin(particle.angle) * particle.radius;

    const normalized = ((particle.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const beat = Math.floor(normalized / (Math.PI / 2));
    if (beat !== particle.beat) {
      particle.beat = beat;
      triggerMagnetParticleHit(particle, magnet);
      echoEnergy = clamp(echoEnergy + 0.06, 0, 1);
      waveTremble = clamp(waveTremble + 0.03, 0, 1);
    }
  });
}

function drawMagnetParticles() {
  if (magnets.length === 0) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  magnets.forEach((magnet) => {
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 214, 95, 0.42)";
    ctx.shadowColor = "rgba(255, 214, 95, 0.8)";
    ctx.shadowBlur = 18;
    ctx.arc(magnet.x, magnet.y, 5 + magnet.strength * 2.6, 0, Math.PI * 2);
    ctx.fill();
  });

  particles.forEach((particle) => {
    const hue = 180 + particle.lane * 26 + particle.hueShift;
    ctx.beginPath();
    ctx.fillStyle = `hsla(${hue}, 95%, 66%, 0.82)`;
    ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.95)`;
    ctx.shadowBlur = 14;
    ctx.arc(particle.x, particle.y, 2.1, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

// Main canvas rendering layers: fade trails, draw wave, and animate waveform brush.
function fadeCanvasTrails() {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = `rgba(0, 0, 0, ${trailFadeStrength})`;
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.restore();
}

function drawEchoWave() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const baseY = height - 42;
  const amplitude = 8 + echoEnergy * 20;
  const trembleAmount = waveTremble * (2 + echoEnergy * 10);

  if (audioReady) {
    analyserNode.getByteTimeDomainData(waveData);
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(0, 240, 255, ${0.15 + echoEnergy * 0.65})`;
  ctx.shadowColor = "rgba(0, 240, 255, 0.55)";
  ctx.shadowBlur = 14;
  ctx.beginPath();

  const sampleCount = waveData.length;
  for (let i = 0; i < sampleCount; i += 1) {
    const x = (i / (sampleCount - 1)) * width;
    const value = audioReady ? (waveData[i] - 128) / 128 : 0;
    const tremble = Math.sin(waveTremblePhase + i * 0.42) * trembleAmount + (Math.random() - 0.5) * trembleAmount * 0.35;
    const y = baseY + value * amplitude + tremble;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 42, 217, ${0.08 + echoEnergy * 0.42})`;
  ctx.shadowColor = "rgba(255, 42, 217, 0.45)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let i = 0; i < sampleCount; i += 1) {
    const x = (i / (sampleCount - 1)) * width;
    const value = audioReady ? (waveData[i] - 128) / 128 : 0;
    const tremble = Math.sin(waveTremblePhase * 1.3 + i * 0.35) * trembleAmount * 0.62;
    const y = baseY + value * (amplitude * 0.62) + 8 + tremble;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function getWaveformLevel() {
  if (!audioReady || waveData.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < waveData.length; i += 1) {
    const centered = (waveData[i] - 128) / 128;
    sum += centered * centered;
  }

  return Math.sqrt(sum / waveData.length);
}

function drawWaveformSegment(x1, y1, x2, y2, startColor, endColor, segmentDistance) {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const points = Math.max(10, Math.floor(length / 5));
  const waveformLevel = getWaveformLevel();
  const vibrate = 1.4 + waveformLevel * 12 + waveTremble * 7 + Math.min(segmentDistance, 30) * 0.08;

  ctx.strokeStyle = gradient;
  ctx.shadowColor = hexToRgba(endColor, 0.5);
  ctx.lineWidth = 5 + waveformLevel * 4;
  ctx.beginPath();

  for (let i = 0; i <= points; i += 1) {
    const t = i / points;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const sample = audioReady ? (waveData[i % waveData.length] - 128) / 128 : 0;
    const phaseOsc = Math.sin(brushWavePhase + t * 24 + waveTremblePhase * 0.7);
    const offset = (sample * 0.65 + phaseOsc * 0.35) * vibrate;
    const wx = px + nx * offset;
    const wy = py + ny * offset;

    if (i === 0) {
      ctx.moveTo(wx, wy);
    } else {
      ctx.lineTo(wx, wy);
    }
  }

  ctx.stroke();
}

// Central animation loop coordinates visuals, loop playback, particles, and decay.
function startVisualLoop() {
  if (visualFrameId) {
    cancelAnimationFrame(visualFrameId);
  }

  lastFrameTime = performance.now();

  const frame = (timestamp) => {
    const deltaSeconds = Math.min(0.05, (timestamp - lastFrameTime) / 1000 || 0.016);
    lastFrameTime = timestamp;

    updateLoopRecordButtonCountdown(timestamp);
    updateMagnetParticles(deltaSeconds);
    fadeCanvasTrails();
    updateLoopPlayback(timestamp);
    drawMagnetParticles();
    drawEchoWave();
    updateAndDrawClearSparks(deltaSeconds);
    decayColorPresence();
    updateAmbientVibe();

    if (shakeClearActive) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.restore();

      if (timestamp >= shakeClearEndAt) {
        shakeClearActive = false;
        strokeHistory = [];
        clearSparks = [];
        if (audioReady) {
          masterGain.gain.setTargetAtTime(0.6, audioContext.currentTime, 0.25);
        }
      }
    }

    echoEnergy = Math.max(0, echoEnergy - trailFadeStrength * 0.42);
    waveTremble = Math.max(0, waveTremble - 0.015);
    waveTremblePhase += 0.28 + waveTremble * 0.85;
    brushWavePhase += 0.34 + echoEnergy * 0.4;
    updateEchoTail();

    visualFrameId = requestAnimationFrame(frame);
  };

  frame();
}

// Breakcore percussion scheduler and one-shot synthesis.
function triggerBreakcoreHit(when, intensity, weights) {
  const noiseSource = audioContext.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const hp = audioContext.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200 + weights.yellow * 1500 - weights.red * 500;
  hp.Q.value = 0.8;

  const hitGain = audioContext.createGain();
  hitGain.gain.setValueAtTime(0.0001, when);
  hitGain.gain.exponentialRampToValueAtTime(0.02 + intensity * 0.03 + weights.red * 0.04, when + 0.002);
  hitGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);

  noiseSource.connect(hp);
  hp.connect(hitGain);
  hitGain.connect(masterGain);

  noiseSource.start(when);
  noiseSource.stop(when + 0.045);

  if (weights.red > 0.38) {
    const kick = audioContext.createOscillator();
    const kickGain = audioContext.createGain();
    kick.type = "sine";
    kick.frequency.setValueAtTime(145 + weights.red * 25, when);
    kick.frequency.exponentialRampToValueAtTime(42, when + 0.09);
    kickGain.gain.setValueAtTime(0.0001, when);
    kickGain.gain.exponentialRampToValueAtTime(0.11 + weights.red * 0.07, when + 0.002);
    kickGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);

    kick.connect(kickGain);
    kickGain.connect(masterGain);

    kick.start(when);
    kick.stop(when + 0.1);
  }
}

function scheduleBreakcoreHits(intensity, weights) {
  if (!audioReady) {
    return;
  }

  const now = audioContext.currentTime;
  if (nextBreakHitTime < now) {
    nextBreakHitTime = now;
  }

  const scheduleHorizon = now + 0.08;
  const speedFactor = 1 + weights.red * 1.25;
  const stepInterval = Math.max(0.006, breakcoreInterval / speedFactor);

  while (nextBreakHitTime < scheduleHorizon) {
    const chance = 0.36 + intensity * 0.28 + weights.red * 0.34;
    const shouldHit = Math.random() < chance || breakcoreStep % 4 === 0;

    if (shouldHit) {
      triggerBreakcoreHit(nextBreakHitTime, intensity, weights);
    }

    if (Math.random() < 0.12 + weights.red * 0.38) {
      triggerBreakcoreHit(nextBreakHitTime + stepInterval * 0.42, intensity * 0.82, weights);
    }

    breakcoreStep += 1;
    nextBreakHitTime += stepInterval;
  }
}

// Builds and wires the full audio graph once, then reuses it.
function initAudio() {
  if (audioReady) {
    return;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  audioContext = new AudioCtx();

  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.72;

  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 512;
  analyserNode.smoothingTimeConstant = 0.86;
  waveData = new Uint8Array(analyserNode.frequencyBinCount);

  distortionNode = audioContext.createWaveShaper();
  distortionNode.oversample = "4x";
  distortionNode.curve = createDistortionCurve(60);

  delayNode = audioContext.createDelay(0.8);
  delayNode.delayTime.value = 0.2;

  delayFeedback = audioContext.createGain();
  delayFeedback.gain.value = 0.24;

  delayWet = audioContext.createGain();
  delayWet.gain.value = 0.1;

  ambientFilter = audioContext.createBiquadFilter();
  ambientFilter.type = "lowpass";
  ambientFilter.frequency.value = 420;
  ambientFilter.Q.value = 0.8;

  ambientGain = audioContext.createGain();
  ambientGain.gain.value = 0.01;

  filterNode = audioContext.createBiquadFilter();
  filterNode.type = "lowpass";
  filterNode.frequency.value = 1800;
  filterNode.Q.value = 1.8;

  voiceGain = audioContext.createGain();
  voiceGain.gain.value = 0;

  chordGain = audioContext.createGain();
  chordGain.gain.value = 0;

  oscA = audioContext.createOscillator();
  oscA.type = "triangle";
  oscA.frequency.value = 220;

  oscB = audioContext.createOscillator();
  oscB.type = "sawtooth";
  oscB.frequency.value = 221;

  chordOsc1 = audioContext.createOscillator();
  chordOsc1.type = "sine";
  chordOsc1.frequency.value = 277;

  chordOsc2 = audioContext.createOscillator();
  chordOsc2.type = "triangle";
  chordOsc2.frequency.value = 330;

  chordOsc3 = audioContext.createOscillator();
  chordOsc3.type = "sine";
  chordOsc3.frequency.value = 440;

  ambientOsc1 = audioContext.createOscillator();
  ambientOsc1.type = "sine";
  ambientOsc1.frequency.value = 88;

  ambientOsc2 = audioContext.createOscillator();
  ambientOsc2.type = "triangle";
  ambientOsc2.frequency.value = 109;

  ambientOsc3 = audioContext.createOscillator();
  ambientOsc3.type = "sine";
  ambientOsc3.frequency.value = 132;

  lfo = audioContext.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 5.5;

  lfoGain = audioContext.createGain();
  lfoGain.gain.value = 5;

  noiseBuffer = createNoiseBuffer();

  lfo.connect(lfoGain);
  lfoGain.connect(filterNode.frequency);
  oscA.connect(voiceGain);
  oscB.connect(voiceGain);
  chordOsc1.connect(chordGain);
  chordOsc2.connect(chordGain);
  chordOsc3.connect(chordGain);
  ambientOsc1.connect(ambientFilter);
  ambientOsc2.connect(ambientFilter);
  ambientOsc3.connect(ambientFilter);
  ambientFilter.connect(ambientGain);
  ambientGain.connect(masterGain);
  voiceGain.connect(filterNode);
  chordGain.connect(filterNode);

  filterNode.connect(delayNode);
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  delayNode.connect(delayWet);
  delayWet.connect(masterGain);

  filterNode.connect(distortionNode);
  distortionNode.connect(masterGain);
  masterGain.connect(analyserNode);
  analyserNode.connect(audioContext.destination);

  oscA.start();
  oscB.start();
  chordOsc1.start();
  chordOsc2.start();
  chordOsc3.start();
  ambientOsc1.start();
  ambientOsc2.start();
  ambientOsc3.start();
  lfo.start();

  audioReady = true;
}

// Starts/updates/stops the lead voice that follows drawing gestures.
function startDrawingSound(y, color) {
  initAudio();
  if (!audioReady) {
    return;
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const now = audioContext.currentTime;
  const baseFrequency = mapYToFrequency(y);
  currentColorWeights = getColorWeights(color);
  drawStartTime = now;
  applyInstrumentProfile(currentColorWeights, y, now, 0);
  echoEnergy = Math.min(1, Math.max(echoEnergy, 0.2));

  const blueBoost = 1 + currentColorWeights.blue * 0.24;
  const initialFrequency = baseFrequency * blueBoost;

  oscA.frequency.cancelScheduledValues(now);
  oscB.frequency.cancelScheduledValues(now);
  oscA.frequency.setTargetAtTime(initialFrequency, now, 0.02);
  oscB.frequency.setTargetAtTime(initialFrequency * 1.005, now, 0.02);

  if (symmetryModeEnabled) {
    const chordFrequencies = getSymmetryChordFrequencies(y);
    chordOsc1.frequency.setTargetAtTime(chordFrequencies[1], now, 0.03);
    chordOsc2.frequency.setTargetAtTime(chordFrequencies[2], now, 0.03);
    chordOsc3.frequency.setTargetAtTime(chordFrequencies[3], now, 0.03);
    chordGain.gain.setTargetAtTime(0.02, now, 0.03);
  } else {
    chordGain.gain.setTargetAtTime(0, now, 0.03);
  }

  voiceGain.gain.cancelScheduledValues(now);
  voiceGain.gain.setTargetAtTime(Math.max(voiceGain.gain.value, 0.01), now, 0.02);

  nextBreakHitTime = now;
  breakcoreStep = 0;
}

function updateDrawingSound(y, color, segmentDistance) {
  if (!audioReady) {
    return;
  }

  const now = audioContext.currentTime;
  const baseFrequency = mapYToFrequency(y);
  currentColorWeights = getColorWeights(color);
  const motionIntensity = clamp(segmentDistance / 20, 0, 1);
  applyInstrumentProfile(currentColorWeights, y, now, motionIntensity);

  const elapsed = clamp(now - drawStartTime, 0, yellowGlideDuration);
  const yellowProgress = elapsed / yellowGlideDuration;
  const yellowGlide = 1 + currentColorWeights.yellow * yellowProgress * 0.42;
  const blueBoost = 1 + currentColorWeights.blue * 0.24;
  const frequency = baseFrequency * blueBoost * yellowGlide;

  oscA.frequency.setTargetAtTime(frequency, now, 0.02);
  oscB.frequency.setTargetAtTime(frequency * 1.005, now, 0.02);

  if (symmetryModeEnabled) {
    const chordFrequencies = getSymmetryChordFrequencies(y);
    chordOsc1.frequency.setTargetAtTime(chordFrequencies[1], now, 0.04);
    chordOsc2.frequency.setTargetAtTime(chordFrequencies[2], now, 0.04);
    chordOsc3.frequency.setTargetAtTime(chordFrequencies[3], now, 0.04);
    chordGain.gain.setTargetAtTime(0.02 + motionIntensity * 0.018, now, 0.04);
  } else {
    chordGain.gain.setTargetAtTime(0, now, 0.05);
  }

  const brightness = clamp(1 - y / (canvas.clientHeight || 1), 0, 1);
  const filterFrequency = 700 + brightness * 2200 + currentColorWeights.yellow * 400 + motionIntensity * 1200;
  filterNode.frequency.setTargetAtTime(filterFrequency, now, 0.06);
  masterGain.gain.setTargetAtTime(0.52 + motionIntensity * 0.58, now, 0.05);

  scheduleBreakcoreHits(motionIntensity, currentColorWeights);
  echoEnergy = clamp(
    echoEnergy + 0.03 + motionIntensity * 0.08 + currentColorWeights.blue * 0.03,
    0,
    1
  );
  waveTremble = clamp(waveTremble + 0.06 + motionIntensity * 0.14 + currentColorWeights.red * 0.08, 0, 1);
}

function stopDrawingSound() {
  if (!audioReady) {
    return;
  }

  const now = audioContext.currentTime;
  voiceGain.gain.cancelScheduledValues(now);
  voiceGain.gain.setTargetAtTime(0, now, 0.08);
  chordGain.gain.setTargetAtTime(0, now, 0.09);
  masterGain.gain.setTargetAtTime(0.6, now, 0.1);
}

// Canvas sizing and draw primitives used by pointer interaction.
function resizeCanvas() {
  const { innerWidth, innerHeight, devicePixelRatio = 1 } = window;

  canvas.width = Math.floor(innerWidth * devicePixelRatio);
  canvas.height = Math.floor(innerHeight * devicePixelRatio);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;

  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  ctx.shadowBlur = 14;
  ctx.shadowColor = hexToRgba(getColorAtDistance(distanceDrawn), 0.45);
}

function drawLine(x, y) {
  const dx = x - lastX;
  const dy = y - lastY;
  const segmentDistance = Math.hypot(dx, dy);
  const startColor = getColorAtDistance(distanceDrawn);
  const endColor = getColorAtDistance(distanceDrawn + segmentDistance);

  const segments = symmetryModeEnabled
    ? getSymmetrySegments(lastX, lastY, x, y)
    : [{ x: lastX, y: lastY, nx: x, ny: y }];

  segments.forEach((segment) => {
    recordLoopSegment(segment.x, segment.y, segment.nx, segment.ny, startColor, endColor, segmentDistance);
    drawWaveformSegment(segment.x, segment.y, segment.nx, segment.ny, startColor, endColor, segmentDistance);
    registerColorPresence(endColor, 0.18);
    strokeHistory.push({ x: segment.nx, y: segment.ny, color: endColor });
  });

  if (strokeHistory.length > 1200) {
    strokeHistory = strokeHistory.slice(strokeHistory.length - 1200);
  }

  updateDrawingSound(y, endColor, segmentDistance);

  distanceDrawn += segmentDistance;
  lastX = x;
  lastY = y;
}

// Input bindings: pointer events, mode buttons, and initialization.
canvas.addEventListener("mousedown", (event) => {
  if (magnetModeEnabled) {
    addMagnet(event.clientX, event.clientY);
    echoEnergy = clamp(echoEnergy + 0.2, 0, 1);
    waveTremble = clamp(waveTremble + 0.12, 0, 1);
    return;
  }

  isDrawing = true;
  lastX = event.clientX;
  lastY = event.clientY;
  startDrawingSound(event.clientY, getColorAtDistance(distanceDrawn));
});

canvas.addEventListener("mousemove", (event) => {
  if (!isDrawing) {
    return;
  }

  drawLine(event.clientX, event.clientY);
});

window.addEventListener("mouseup", () => {
  isDrawing = false;
  stopDrawingSound();
});

canvas.addEventListener("mouseleave", () => {
  isDrawing = false;
  stopDrawingSound();
});

colorButton.addEventListener("click", () => {
  colorPicker.click();
});

colorPicker.addEventListener("change", () => {
  addColorToQueue(colorPicker.value);
});

resetColorsButton.addEventListener("click", () => {
  resetColorQueue();
});

magnetModeButton.addEventListener("click", () => {
  toggleMagnetMode();
});

symmetryModeButton.addEventListener("click", () => {
  toggleSymmetryMode();
});

recordLoopButton.addEventListener("click", () => {
  startLoopRecording();
});

shakeClearButton.addEventListener("click", () => {
  triggerShakeToClear();
});

window.addEventListener("resize", resizeCanvas);
renderPalette();
resizeCanvas();
startVisualLoop();
