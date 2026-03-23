// Scale threshold input
const scaleThresholdInput = document.getElementById("scaleThreshold");
// Track ID counter
let nextTrackId = 1;
// Tracks for detected objects
let tracks = new Map();
// Sensitivity input
const sensitivityInput = document.getElementById("sensitivity");
// --- Constants ---
const THEME_STORAGE_KEY = "theme";
// --- Global error handler for debugging ---
window.addEventListener('error', function(event) {
  let errorBox = document.getElementById('globalErrorBox');
  if (!errorBox) {
    errorBox = document.createElement('div');
    errorBox.id = 'globalErrorBox';
    errorBox.style.position = 'fixed';
    errorBox.style.bottom = '0';
    errorBox.style.left = '0';
    errorBox.style.right = '0';
    errorBox.style.background = '#ff4f5e';
    errorBox.style.color = '#fff';
    errorBox.style.padding = '1em';
    errorBox.style.zIndex = '9999';
    errorBox.style.fontFamily = 'monospace';
    document.body.appendChild(errorBox);
  }
  errorBox.textContent = 'JS Error: ' + event.message + ' at ' + event.filename + ':' + event.lineno;
});
 
// --- DOM Elements ---
const webhookStatusEl = document.getElementById("webhookStatus");

// --- State variables ---
let detectLoopTimer = null;
let localEvents = [];
const themeToggleBtn = document.getElementById("themeToggle");
const elaborateSettingsBtn = document.getElementById("elaborateSettingsBtn");
const settingsHelpEl = document.getElementById("settingsHelp");
const eventCooldownInput = document.getElementById("eventCooldown");
const soundCooldownInput = document.getElementById("soundCooldown");
const eventCooldownValueEl = document.getElementById("eventCooldownValue");
const soundCooldownValueEl = document.getElementById("soundCooldownValue");
const objectThresholdsInput = document.getElementById("objectThresholds");
const objectCooldownsInput = document.getElementById("objectCooldowns");
const movementTypeEl = document.getElementById("movementType");
const modelStatusEl = document.getElementById("modelStatus");
const eventStatsLineEl = document.getElementById("eventStatsLine");
const eventListEl = document.getElementById("eventList");
const trackedListEl = document.getElementById("trackedList");
const objectLabelEl = document.getElementById("objectLabel");
const motionIntensityEl = document.getElementById("motionIntensity");
const scaleTrendEl = document.getElementById("scaleTrend");
const overlayCanvas = document.getElementById("overlayCanvas");
const camera = document.getElementById("camera");
let overlayCtx = overlayCanvas ? overlayCanvas.getContext("2d") : null;

// Dashboard elements
const topMovementEl = document.getElementById("topMovement");
const alertsPerMinuteEl = document.getElementById("alertsPerMinute");
const mostActiveHourEl = document.getElementById("mostActiveHour");

// Audio context
let audioContext = null;

// --- Sound Map ---
const movementSoundMap = {
  left: () => twoTone(210, 170, 0.09),
  right: () => beep(860, 0.12, "square"),
  up: () => sweep(340, 820, 0.18),
  down: () => sweep(840, 260, 0.22),
  forward: () => pulse(690, 0.08, 3),
  backward: () => pulse(240, 0.18, 2)
};

function setTextWithFlash(el, value) {
  const next = String(value);
  if (el.textContent === next) {
    return;
  }

  el.textContent = next;
  el.classList.remove("value-flash");
  void el.offsetWidth;
  el.classList.add("value-flash");
}

function initButtonAnimations() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    return;
  }

  const buttons = document.querySelectorAll("button");
  buttons.forEach((button) => {
    button.addEventListener("mousemove", (event) => {
      const rect = button.getBoundingClientRect();
      const px = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const py = (event.clientY - rect.top) / Math.max(rect.height, 1);
      const mx = (px - 0.5) * 5;
      const my = (py - 0.5) * 5;
      button.style.setProperty("--mx", `${mx.toFixed(2)}px`);
      button.style.setProperty("--my", `${my.toFixed(2)}px`);
      button.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
      button.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
    });

    button.addEventListener("mouseleave", () => {
      button.style.setProperty("--mx", "0px");
      button.style.setProperty("--my", "0px");
      button.style.setProperty("--gx", "50%");
      button.style.setProperty("--gy", "50%");
    });
  });
}

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function envelope(gainNode, startTime, duration, peak = 0.2) {
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(peak, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
}

function beep(frequency, duration = 0.15, wave = "sine") {
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = wave;
  osc.frequency.setValueAtTime(frequency, now);
  envelope(gain, now, duration, 0.24);

  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

function twoTone(f1, f2, stepDuration) {
  beep(f1, stepDuration, "triangle");
  setTimeout(() => beep(f2, stepDuration, "triangle"), stepDuration * 1000 + 22);
}

function sweep(from, to, duration) {
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + duration);
  envelope(gain, now, duration, 0.18);

  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function pulse(frequency, durationEach, count) {
  for (let i = 0; i < count; i += 1) {
    setTimeout(() => beep(frequency, durationEach, "square"), i * durationEach * 1000 * 1.4);
  }
}

function maybePlayMovementAlarm(type, track) {
  const now = performance.now();
  const coolDownMs = getObjectCooldownMs(track.label, Number(soundCooldownInput.value));

  if (type === "none" || !movementSoundMap[type]) {
    return;
  }

  if (now - track.lastSoundAt < coolDownMs && track.lastDirection === type) {
    return;
  }

  movementSoundMap[type]();
  track.lastSoundAt = now;
  track.lastDirection = type;
}

function parseObjectNumberMap(rawText) {
  const map = new Map();
  const chunks = String(rawText || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const [rawKey, rawValue] = chunk.split(":").map((item) => String(item || "").trim());
    if (!rawKey || !rawValue) {
      continue;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) {
      continue;
    }

    map.set(rawKey.toLowerCase(), numericValue);
  }

  return map;
}

function getObjectConfidenceThreshold(label, defaultThreshold) {
  const objectMap = parseObjectNumberMap(objectThresholdsInput.value);
  const override = objectMap.get(String(label || "").toLowerCase());
  if (Number.isFinite(override)) {
    return Math.max(0.05, Math.min(0.99, override));
  }
  return defaultThreshold;
}

function getObjectCooldownMs(label, defaultMs) {
  const objectMap = parseObjectNumberMap(objectCooldownsInput.value);
  const override = objectMap.get(String(label || "").toLowerCase());
  if (Number.isFinite(override)) {
    return Math.max(200, Math.min(10000, override));
  }
  return defaultMs;
}

function updateCooldownLabels() {
  eventCooldownValueEl.textContent = String(Math.round(Number(eventCooldownInput.value)));
  soundCooldownValueEl.textContent = String(Math.round(Number(soundCooldownInput.value)));
}

function applyTheme(theme) {
  const safeTheme = theme === "light" ? "light" : "dark";
  document.body.setAttribute("data-theme", safeTheme);
  themeToggleBtn.textContent = safeTheme === "light" ? "Theme: Bright White" : "Theme: Dark";
}

function getDeviceTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function loadSavedTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(saved || getDeviceTheme());
}

async function startCamera() {
  initAudio();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    camera.srcObject = stream;
    await camera.play();
    overlayCanvas.width = camera.videoWidth || 640;
    overlayCanvas.height = camera.videoHeight || 480;
    running = true;
    detectLoopTimer = window.setInterval(detectObjects, 260);
  } catch (err) {
    setTextWithFlash(movementTypeEl, "camera error");
    let errorBox = document.getElementById('globalErrorBox');
    if (!errorBox) {
      errorBox = document.createElement('div');
      errorBox.id = 'globalErrorBox';
      errorBox.style.position = 'fixed';
      errorBox.style.bottom = '0';
      errorBox.style.left = '0';
      errorBox.style.right = '0';
      errorBox.style.background = '#ff4f5e';
      errorBox.style.color = '#fff';
      errorBox.style.padding = '1em';
      errorBox.style.zIndex = '9999';
      errorBox.style.fontFamily = 'monospace';
      document.body.appendChild(errorBox);
    }
    errorBox.textContent = 'Camera Error: ' + err.message;
    throw err;
  }
}

function classifyMotion(dx, dy, areaDeltaRatio, speed) {
  if (speed < 2.4 && Math.abs(areaDeltaRatio) < 0.055) {
    return "none";
  }

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const scaleThreshold = Math.max(0.01, Number(scaleThresholdInput.value));

  if (Math.abs(areaDeltaRatio) > scaleThreshold) {
    return areaDeltaRatio > 0 ? "forward" : "backward";
  }

  if (absX > absY && absX > 1.8) {
    return dx > 0 ? "right" : "left";
  }

  if (absY <= 1.8) {
    return "none";
  }

  return dy > 0 ? "down" : "up";
}

function iou(boxA, boxB) {
  const [ax, ay, aw, ah] = boxA;
  const [bx, by, bw, bh] = boxB;
  const xA = Math.max(ax, bx);
  const yA = Math.max(ay, by);
  const xB = Math.min(ax + aw, bx + bw);
  const yB = Math.min(ay + ah, by + bh);

  if (xB <= xA || yB <= yA) {
    return 0;
  }

  const inter = (xB - xA) * (yB - yA);
  const union = aw * ah + bw * bh - inter;
  return inter / Math.max(union, 1);
}

function pickTrackForDetection(det, consumedTrackIds) {
  let bestTrack = null;
  let bestScore = 0;

  for (const track of tracks.values()) {
    if (consumedTrackIds.has(track.id) || track.label !== det.class) {
      continue;
    }

    const score = iou(track.bbox, det.bbox);
    if (score > bestScore) {
      bestScore = score;
      bestTrack = track;
    }
  }

  if (bestTrack && bestScore > 0.2) {
    return bestTrack;
  }

  return null;
}

function pushEventLine(entry) {
  localEvents.unshift(entry);
  if (localEvents.length > 300) {
    localEvents.pop();
  }

  renderEventList();
  renderDashboard();
}

function renderEventList() {
  localEvents.sort((a, b) => new Date(b.rawTime).getTime() - new Date(a.rawTime).getTime());

  eventListEl.innerHTML = "";
  let totalConfidence = 0;
  let confidenceCount = 0;
  let totalIntensity = 0;
  let intensityCount = 0;

  for (const evt of localEvents) {
    if (Number.isFinite(evt.confidence)) {
      totalConfidence += evt.confidence;
      confidenceCount += 1;
    }
    if (Number.isFinite(evt.intensity)) {
      totalIntensity += evt.intensity;
      intensityCount += 1;
    }

    const confText = Number.isFinite(evt.confidence) ? evt.confidence.toFixed(2) : "n/a";
    const intensityText = Number.isFinite(evt.intensity) ? evt.intensity.toFixed(2) : "n/a";
    const boxText = Array.isArray(evt.bbox)
      ? `${Math.round(evt.bbox[0])},${Math.round(evt.bbox[1])},${Math.round(evt.bbox[2])}x${Math.round(evt.bbox[3])}`
      : "n/a";

    const li = document.createElement("li");
    li.textContent = `${evt.time} | ${evt.objectLabel}#${evt.trackId} | ${evt.movement} | conf ${confText} | int ${intensityText} | box ${boxText}`;
    if (evt.isNew) {
      li.classList.add("event-enter");
      evt.isNew = false;
    }
    eventListEl.appendChild(li);
    if (eventListEl.children.length >= 20) {
      break;
    }
  }

  const avgConf = confidenceCount ? (totalConfidence / confidenceCount).toFixed(2) : "0.00";
  const avgIntensity = intensityCount ? (totalIntensity / intensityCount).toFixed(2) : "0.00";
  eventStatsLineEl.textContent = `events: ${localEvents.length} | avg conf: ${avgConf} | avg intensity: ${avgIntensity}`;
}

async function postEvent(event) {
  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });
    const result = await response.json();
    if (typeof result.webhook?.sent === "boolean") {
      webhookStatusEl.textContent = result.webhook.sent
        ? `sent (${result.webhook.status || "ok"})`
        : `configured=${webhookConfigured} (${result.webhook.reason || "not sent"})`;
    }
  } catch (err) {
    webhookStatusEl.textContent = `error: ${err.message}`;
  }
}

function updateTrackedList() {
  trackedListEl.innerHTML = "";
  const activeTracks = Array.from(tracks.values())
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, 8);

  if (!activeTracks.length) {
    const li = document.createElement("li");
    li.textContent = "none";
    trackedListEl.appendChild(li);
    return;
  }

  for (const track of activeTracks) {
    const li = document.createElement("li");
    li.textContent = `${track.label}#${track.id} ${track.lastDirection || "none"} conf:${track.confidence.toFixed(2)}`;
    trackedListEl.appendChild(li);
  }
}

function drawDetections(detections) {
  const w = overlayCanvas.width;
  const h = overlayCanvas.height;
  overlayCtx.clearRect(0, 0, w, h);
  overlayCtx.lineWidth = 2;
  overlayCtx.font = "14px Trebuchet MS";

  for (const det of detections) {
    const [x, y, boxW, boxH] = det.bbox;
    overlayCtx.strokeStyle = "#f8c44f";
    overlayCtx.fillStyle = "rgba(248, 196, 79, 0.15)";
    overlayCtx.fillRect(x, y, boxW, boxH);
    overlayCtx.strokeRect(x, y, boxW, boxH);
    overlayCtx.fillStyle = "#e8f6ff";
    overlayCtx.fillText(`${det.class} ${det.score.toFixed(2)}`, x + 5, Math.max(16, y - 8));
  }
}

function getCssVar(name, fallback) {
  const raw = getComputedStyle(document.body).getPropertyValue(name);
  const value = String(raw || "").trim();
  return value || fallback;
}

function drawBarChart(canvas, labels, values, color) {
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pad = 28;
  const maxValue = Math.max(1, ...values);
  const barWidth = Math.max(8, (width - pad * 2) / Math.max(values.length, 1) - 4);
  const surface = getCssVar("--chart-surface", "#0e1c2d");
  const grid = getCssVar("--chart-grid", "rgba(173, 220, 255, 0.25)");
  const label = getCssVar("--chart-label", "#d8f1ff");

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = grid;
  ctx.beginPath();
  ctx.moveTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.stroke();

  values.forEach((value, idx) => {
    const x = pad + idx * (barWidth + 4);
    const barHeight = ((height - pad * 2) * value) / maxValue;
    const y = height - pad - barHeight;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);

    if (labels.length <= 12 || idx % 2 === 0) {
      ctx.fillStyle = label;
      ctx.font = "10px Trebuchet MS";
      ctx.fillText(labels[idx], x, height - 10);
    }
  });
}

function drawHeatmap(canvas, points, baseWidth, baseHeight) {
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const cols = 10;
  const rows = 6;
  const counts = Array.from({ length: rows }, () => Array(cols).fill(0));
  const surface = getCssVar("--chart-surface", "#0e1c2d");

  for (const point of points) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      continue;
    }

    const px = Math.max(0, Math.min(cols - 1, Math.floor((point.x / Math.max(1, baseWidth)) * cols)));
    const py = Math.max(0, Math.min(rows - 1, Math.floor((point.y / Math.max(1, baseHeight)) * rows)));
    counts[py][px] += 1;
  }

  const maxValue = Math.max(1, ...counts.flat());
  const cellW = width / cols;
  const cellH = height / rows;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const intensity = counts[y][x] / maxValue;
      const r = Math.floor(40 + intensity * 210);
      const g = Math.floor(48 + intensity * 130);
      const b = Math.floor(70 - intensity * 40);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x * cellW + 1, y * cellH + 1, cellW - 2, cellH - 2);
    }
  }
}

function renderDashboard() {
  const movements = ["left", "right", "up", "down", "forward", "backward"];
  const movementCounts = Object.fromEntries(movements.map((name) => [name, 0]));
  const hourlyCounts = Array(24).fill(0);

  const now = Date.now();
  const minuteBuckets = Array(10).fill(0);
  const heatmapPoints = [];

  for (const evt of localEvents) {
    if (evt.movement && movementCounts[evt.movement] !== undefined) {
      movementCounts[evt.movement] += 1;
    }

    const evtTime = new Date(evt.rawTime || Date.now());
    if (!Number.isNaN(evtTime.getTime())) {
      hourlyCounts[evtTime.getHours()] += 1;
      const minuteAge = Math.floor((now - evtTime.getTime()) / 60000);
      if (minuteAge >= 0 && minuteAge < minuteBuckets.length) {
        const idx = minuteBuckets.length - 1 - minuteAge;
        minuteBuckets[idx] += 1;
      }
    }

    if (Array.isArray(evt.bbox) && evt.bbox.length === 4) {
      heatmapPoints.push({
        x: evt.bbox[0] + evt.bbox[2] / 2,
        y: evt.bbox[1] + evt.bbox[3] / 2
      });
    }
  }

  const movementValues = movements.map((name) => movementCounts[name]);
  drawBarChart(movementChart, movements, movementValues, "#f8c44f");

  const hourlyLabels = hourlyCounts.map((_, idx) => `${idx}`);
  drawBarChart(hourlyChart, hourlyLabels, hourlyCounts, "#7bd3ff");

  const freqLabels = Array.from({ length: minuteBuckets.length }, (_, idx) => `-${minuteBuckets.length - 1 - idx}m`);
  drawBarChart(frequencyChart, freqLabels, minuteBuckets, "#9ee99a");
  drawHeatmap(heatmapChart, heatmapPoints, overlayCanvas.width || 640, overlayCanvas.height || 480);

  const top = movements
    .map((name) => ({ name, count: movementCounts[name] }))
    .sort((a, b) => b.count - a.count)[0];
  setTextWithFlash(topMovementEl, top.count > 0 ? `${top.name} (${top.count})` : "none");

  const activeHour = hourlyCounts
    .map((count, hour) => ({ count, hour }))
    .sort((a, b) => b.count - a.count)[0];
  setTextWithFlash(mostActiveHourEl, activeHour.count > 0 ? `${activeHour.hour}:00 (${activeHour.count})` : "n/a");

  const totalRecentAlerts = minuteBuckets.reduce((sum, value) => sum + value, 0);
  setTextWithFlash(alertsPerMinuteEl, `${(totalRecentAlerts / minuteBuckets.length).toFixed(2)} alerts/min`);
}

async function detectObjects() {
  if (!running || !model || camera.readyState < 2) {
    return;
  }

  const rawDetections = await model.detect(camera, 12);
  const defaultThreshold = Number(sensitivityInput.value) / 100;
  const detections = rawDetections.filter((d) => {
    const minThreshold = getObjectConfidenceThreshold(d.class, defaultThreshold);
    return d.score >= Math.max(0.05, minThreshold);
  });

  drawDetections(detections);

  const now = performance.now();
  const consumedTrackIds = new Set();
  let bestMovement = {
    movement: "none",
    objectLabel: "none",
    intensity: 0,
    scaleTrend: 0
  };

  for (const det of detections) {
    let track = pickTrackForDetection(det, consumedTrackIds);
    const [x, y, w, h] = det.bbox;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const area = w * h;

    if (!track) {
      track = {
        id: nextTrackId,
        label: det.class,
        confidence: det.score,
        bbox: det.bbox,
        cx,
        cy,
        area,
        lastSeenAt: now,
        lastDirection: "none",
        lastEventAt: 0,
        lastSoundAt: 0
      };
      tracks.set(nextTrackId, track);
      nextTrackId += 1;
      consumedTrackIds.add(track.id);
      continue;
    }

    consumedTrackIds.add(track.id);

    const dx = cx - track.cx;
    const dy = cy - track.cy;
    const areaDeltaRatio = (area - track.area) / Math.max(track.area, 1);
    const speed = Math.sqrt(dx * dx + dy * dy);
    const movement = classifyMotion(dx, dy, areaDeltaRatio, speed);

    track.confidence = det.score;
    track.bbox = det.bbox;
    track.cx = cx;
    track.cy = cy;
    track.area = area;
    track.lastSeenAt = now;

    if (movement !== "none") {
      maybePlayMovementAlarm(movement, track);

      const intensity = speed + Math.abs(areaDeltaRatio) * 100;
      if (intensity > bestMovement.intensity) {
        bestMovement = {
          movement,
          objectLabel: det.class,
          intensity,
          scaleTrend: areaDeltaRatio,
          track
        };
      }

      const eventCooldownMs = getObjectCooldownMs(det.class, Number(eventCooldownInput.value));
      const objectLastAt = objectLastEventAt.get(det.class) || 0;

      if (now - track.lastEventAt > eventCooldownMs && now - objectLastAt > eventCooldownMs * 0.6) {
        track.lastEventAt = now;
        objectLastEventAt.set(det.class, now);

        const eventTimeIso = new Date().toISOString();
        const event = {
          source: "camera-client",
          movement,
          objectLabel: det.class,
          trackId: track.id,
          confidence: det.score,
          intensity,
          bbox: det.bbox,
          time: eventTimeIso
        };

        postEvent(event);
        pushEventLine({
          time: new Date().toLocaleTimeString(),
          rawTime: eventTimeIso,
          movement,
          objectLabel: det.class,
          trackId: track.id,
          bbox: det.bbox,
          confidence: det.score,
          intensity,
          isNew: true
        });
      }
    }
  }

  for (const [trackId, track] of tracks) {
    if (now - track.lastSeenAt > 2500) {
      tracks.delete(trackId);
    }
  }

  setTextWithFlash(movementTypeEl, bestMovement.movement);
  setTextWithFlash(objectLabelEl, bestMovement.objectLabel);
  setTextWithFlash(motionIntensityEl, bestMovement.intensity.toFixed(2));
  setTextWithFlash(scaleTrendEl, bestMovement.scaleTrend.toFixed(4));
  updateTrackedList();
}

async function loadModel() {
  setTextWithFlash(modelStatusEl, "loading model...");
  // Wait for cocoSsd to be available (in case script is still loading)
  let tries = 0;
  while (typeof window.cocoSsd === "undefined" && tries < 40) {
    await new Promise((res) => setTimeout(res, 125));
    tries++;
  }
  if (typeof window.cocoSsd === "undefined") {
    setTextWithFlash(modelStatusEl, "model load failed: coco-ssd not available");
    throw new Error("cocoSsd is not loaded. Check your internet connection or CDN access.");
  }
  try {
    model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
    setTextWithFlash(modelStatusEl, "model ready");
  } catch (err) {
    setTextWithFlash(modelStatusEl, "model load failed");
    throw err;
  }
}

async function refreshWebhookStatus() {
  // Gracefully handle missing backend
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("No backend");
    const info = await response.json();
    webhookConfigured = Boolean(info.webhookConfigured);
    setTextWithFlash(webhookStatusEl, webhookConfigured ? "configured" : "not configured");
  } catch (err) {
    setTextWithFlash(webhookStatusEl, "(no backend)");
  }
}

async function loadRecentEvents() {
  // Gracefully handle missing backend
  try {
    const response = await fetch("/api/events?limit=120");
    if (!response.ok) throw new Error("No backend");
    const payload = await response.json();
    const fromServer = Array.isArray(payload.events) ? payload.events : [];

    localEvents.length = 0;
    for (let i = fromServer.length - 1; i >= 0; i -= 1) {
      const evt = fromServer[i];
      localEvents.unshift({
        time: new Date(evt.time || Date.now()).toLocaleTimeString(),
        rawTime: evt.time || new Date().toISOString(),
        movement: evt.movement || "unknown",
        objectLabel: evt.objectLabel || "unknown",
        trackId: Number.isFinite(evt.trackId) ? evt.trackId : 0,
        bbox: evt.bbox || null,
        confidence: Number.isFinite(evt.confidence) ? evt.confidence : null,
        intensity: Number.isFinite(evt.intensity) ? evt.intensity : null
      });
    }

    renderEventList();
    renderDashboard();
  } catch (err) {
    // No backend: show friendly message
    localEvents.length = 0;
    renderEventList();
    renderDashboard();
  }
}

// Gracefully skip posting events if no backend
async function postEvent(event) {
  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });
    if (!response.ok) throw new Error("No backend");
    const result = await response.json();
    if (typeof result.webhook?.sent === "boolean") {
      webhookStatusEl.textContent = result.webhook.sent
        ? `sent (${result.webhook.status || "ok"})`
        : `configured=${webhookConfigured} (${result.webhook.reason || "not sent"})`;
    }
  } catch (err) {
    webhookStatusEl.textContent = "(no backend)";
  }
}
elaborateSettingsBtn.addEventListener("click", () => {
  const isHidden = settingsHelpEl.classList.toggle("is-hidden");
  elaborateSettingsBtn.textContent = isHidden ? "Elaborate" : "Hide";
});

startButton.addEventListener("click", async () => {

  // Play a test beep to confirm audio works after user interaction
  initAudio();
  beep(600, 0.2, "sine");

  startButton.disabled = true;
  startButton.textContent = "Loading...";
  startButton.classList.remove("pulse-idle");

  try {
    await loadModel();
    await refreshWebhookStatus();
    await loadRecentEvents();
    await startCamera();
    startButton.textContent = "Detection Active";
    startButton.classList.add("pulse-active");
  } catch (err) {
    console.error(err);
    setTextWithFlash(movementTypeEl, "camera error");
    setTextWithFlash(modelStatusEl, "model load failed");
    startButton.textContent = "Start Camera";
    startButton.disabled = false;
    startButton.classList.remove("pulse-active");
    startButton.classList.add("pulse-idle");
    if (detectLoopTimer) {
      clearInterval(detectLoopTimer);
      detectLoopTimer = null;
    }
  }
});
