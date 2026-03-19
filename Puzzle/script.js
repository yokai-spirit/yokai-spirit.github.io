const CANVAS_SIZE = 400;
const DEFAULT_GRID_SIZE = 5;
const SHAPE_MODES = ["squares", "triangles", "polygons"];

// Core UI references used across puzzle, timer, camera, and leaderboard systems.

const uploadInput = document.getElementById("uploadInput");
const difficultySelect = document.getElementById("difficultySelect");
const shapeBtn = document.getElementById("shapeBtn");
const cameraBtn = document.getElementById("cameraBtn");
const hintBtn = document.getElementById("hintBtn");
const cameraModal = document.getElementById("cameraModal");
const cameraPreview = document.getElementById("cameraPreview");
const captureBtn = document.getElementById("captureBtn");
const closeCameraBtn = document.getElementById("closeCameraBtn");
const explodeBtn = document.getElementById("explodeBtn");
const cutBtn = document.getElementById("cutBtn");
const titleEl = document.getElementById("title");
const assemblyField = document.getElementById("assemblyField");
const storage = document.getElementById("storage");
const originalCanvas = document.getElementById("originalCanvas");
const originalCtx = originalCanvas.getContext("2d");
const fireworksCanvas = document.getElementById("fireworksCanvas");
const fireworksCtx = fireworksCanvas.getContext("2d");
const musicPlayerEl = document.getElementById("musicPlayer");
const musicPlaylistEl = document.getElementById("musicPlaylist");
const timerValueEl = document.getElementById("timerValue");
const bestTimeValueEl = document.getElementById("bestTimeValue");
const scoreHistoryEl = document.getElementById("scoreHistory");
const resetScoreBtn = document.getElementById("resetScoreBtn");
const saveScoreJsonBtn = document.getElementById("saveScoreJsonBtn");

const SCORE_HISTORY_STORAGE_KEY = "pixelPuzzleScoreHistoryV1";
const SCORE_HISTORY_LIMIT = 3;

// Difficulty metadata is reused in the leaderboard label formatting.
const DIFFICULTY_META = {
  3: "Easy",
  5: "Normal",
  10: "Medium",
  12: "Hard",
};

const SOUNDTRACKS = [
  { title: "Glass Ocean", src: "Glass Ocean.mp3" },
  { title: "Solitary Grace", src: "Solitary Grace.mp3" },
  { title: "House of Cards", src: "House of Cards.mp3" },
  { title: "Peace of Mind", src: "Peace of Mind.mp3" },
];

// Runtime state for puzzle flow, animation, music, and timing.
let sourceImage = null;
let draggedElement = null;
let gridSize = DEFAULT_GRID_SIZE;
let pieceSize = CANVAS_SIZE / gridSize;
let cameraStream = null;
let hintVisible = false;
let audioContext = null;
let shapeMode = SHAPE_MODES[0];
let puzzleSolved = false;
let fireworksParticles = [];
let fireworksFrameId = null;
let currentTrackIndex = 0;
let musicPlayer = null;
let timerStartAt = null;
let timerElapsedMs = 0;
let timerIntervalId = null;
let timerArmed = false;
let scoreHistory = [];

// Converts elapsed milliseconds into mm:ss.t for compact UI display.
function formatDuration(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = safeMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((safeMs % 1000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function getBestTimeFromHistory() {
  if (scoreHistory.length === 0) {
    return null;
  }

  return scoreHistory[0].timeMs;
}

function formatDifficultyLabel(difficulty) {
  const levelLabel = DIFFICULTY_META[difficulty] || "Custom";
  return `${difficulty}x${difficulty} - ${levelLabel}`;
}

function loadScoreHistory() {
  try {
    const raw = window.localStorage.getItem(SCORE_HISTORY_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return;
    }

    // Validate persisted entries to avoid corrupt or incompatible payloads.
    scoreHistory = parsed
      .map((item) => ({
        difficulty: Number(item?.difficulty),
        timeMs: Number(item?.timeMs),
      }))
      .filter((item) => {
        const validDifficulty = [3, 5, 10, 12].includes(item.difficulty);
        const validTime = Number.isFinite(item.timeMs) && item.timeMs > 0;
        return validDifficulty && validTime;
      })
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(0, SCORE_HISTORY_LIMIT);
  } catch (error) {
    // Ignore storage access issues and continue without persistence.
  }
}

function saveScoreHistory() {
  try {
    window.localStorage.setItem(SCORE_HISTORY_STORAGE_KEY, JSON.stringify(scoreHistory));
  } catch (error) {
    // Ignore storage write issues.
  }
}

function renderTimerValue() {
  if (timerValueEl) {
    timerValueEl.textContent = formatDuration(timerElapsedMs);
  }
}

function renderScoreHistory() {
  if (bestTimeValueEl) {
    const bestTimeMs = getBestTimeFromHistory();
    bestTimeValueEl.textContent = bestTimeMs == null ? "--:--.-" : formatDuration(bestTimeMs);
  }

  if (!scoreHistoryEl) {
    return;
  }

  scoreHistoryEl.innerHTML = "";

  if (scoreHistory.length === 0) {
    const empty = document.createElement("li");
    empty.className = "score-history-item";
    empty.innerHTML = '<span class="score-history-label">No solved runs yet</span><span class="score-history-value">--:--.-</span>';
    scoreHistoryEl.appendChild(empty);
    return;
  }

  scoreHistory.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "score-history-item";
    item.innerHTML = `<span class="score-history-label">${formatDifficultyLabel(entry.difficulty)}</span><span class="score-history-value">${formatDuration(entry.timeMs)}</span>`;
    scoreHistoryEl.appendChild(item);
  });
}

function recordSolveResult(difficulty, timeMs) {
  scoreHistory.push({ difficulty, timeMs });
  scoreHistory.sort((a, b) => a.timeMs - b.timeMs);

  // Keep only top N results globally (fastest first).
  if (scoreHistory.length > SCORE_HISTORY_LIMIT) {
    scoreHistory = scoreHistory.slice(0, SCORE_HISTORY_LIMIT);
  }

  saveScoreHistory();
  renderScoreHistory();
}

function buildLeaderboardPayload() {
  // Export format is intentionally explicit so it can be consumed by other tools.
  return {
    generatedAt: new Date().toISOString(),
    maxRecords: SCORE_HISTORY_LIMIT,
    records: scoreHistory.map((entry, index) => ({
      rank: index + 1,
      difficulty: `${entry.difficulty}x${entry.difficulty}`,
      difficultyLevel: DIFFICULTY_META[entry.difficulty] || "Custom",
      timeMs: Math.round(entry.timeMs),
      timeText: formatDuration(entry.timeMs),
    })),
  };
}

function downloadLeaderboardJson() {
  const payload = buildLeaderboardPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "leaderboard.json";
  link.click();
  URL.revokeObjectURL(url);
}

// Stops active timer loop and clears start timestamp.
function stopSolveTimer() {
  if (timerIntervalId !== null) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  timerStartAt = null;
}

function resetSolveTimer() {
  stopSolveTimer();
  timerArmed = false;
  timerElapsedMs = 0;
  renderTimerValue();
}

// Arming starts a new run logically, but does not start time until first interaction.
function armSolveTimer() {
  stopSolveTimer();
  timerArmed = true;
  timerElapsedMs = 0;
  renderTimerValue();
}

function startSolveTimer() {
  stopSolveTimer();
  timerArmed = false;
  timerElapsedMs = 0;
  timerStartAt = performance.now();
  renderTimerValue();

  timerIntervalId = window.setInterval(() => {
    if (timerStartAt == null) {
      return;
    }
    timerElapsedMs = performance.now() - timerStartAt;
    renderTimerValue();
  }, 100);
}

function tryStartSolveTimer() {
  if (!timerArmed || timerStartAt != null || puzzleSolved) {
    return;
  }

  startSolveTimer();
}

function completeSolveTimer() {
  if (timerStartAt == null) {
    return;
  }

  timerElapsedMs = performance.now() - timerStartAt;
  stopSolveTimer();
  renderTimerValue();
  recordSolveResult(gridSize, timerElapsedMs);
}

// Music player is independent from puzzle state and can run in parallel.
function initializeMusicPlaylist() {
  if (!musicPlayerEl || !musicPlaylistEl) {
    return;
  }

  if (typeof window.Plyr === "function") {
    musicPlayer = new window.Plyr(musicPlayerEl, {
      controls: ["play", "current-time", "mute"],
      keyboard: { focused: true, global: false },
      tooltips: { controls: false, seek: true },
    });
  }

  const setTrack = (index, autoPlay) => {
    currentTrackIndex = index;
    const track = SOUNDTRACKS[index];
    const encodedSrc = encodeURI(track.src);

    musicPlayerEl.src = encodedSrc;
    musicPlayerEl.load();

    const buttons = musicPlaylistEl.querySelectorAll(".playlist-item");
    buttons.forEach((button, buttonIndex) => {
      button.classList.toggle("active", buttonIndex === index);
    });

    if (!autoPlay) {
      return;
    }

    const activeMedia = musicPlayer ? musicPlayer.media : musicPlayerEl;
    activeMedia.play().catch(() => {
      // Playback can require direct user interaction depending on browser policy.
    });
  };

  SOUNDTRACKS.forEach((track, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "playlist-item";
    button.textContent = `${index + 1}. ${track.title}`;
    button.addEventListener("click", () => {
      setTrack(index, true);
    });
    item.appendChild(button);
    musicPlaylistEl.appendChild(item);
  });

  musicPlayerEl.addEventListener("ended", () => {
    const nextIndex = (currentTrackIndex + 1) % SOUNDTRACKS.length;
    setTrack(nextIndex, true);
  });

  setTrack(0, false);
}

function resizeFireworksCanvas() {
  const ratio = window.devicePixelRatio || 1;
  fireworksCanvas.width = Math.floor(window.innerWidth * ratio);
  fireworksCanvas.height = Math.floor(window.innerHeight * ratio);
  fireworksCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function toggleExplosionButton(visible) {
  explodeBtn.classList.toggle("visible", visible);
}

// Fireworks particles are simple physics dots (velocity + gravity + fade).
function spawnFireworkBurst(x, y, hue, count = 44) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.12;
    const speed = 1.6 + Math.random() * 4.6;
    fireworksParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 40 + Math.random() * 22,
      maxLife: 62,
      size: 1.3 + Math.random() * 2.9,
      hue,
    });
  }
}

function runFireworks() {
  fireworksCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  fireworksParticles = fireworksParticles.filter((particle) => particle.life > 0);

  for (const particle of fireworksParticles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    fireworksCtx.beginPath();
    fireworksCtx.fillStyle = `hsla(${particle.hue}, 98%, 62%, ${alpha})`;
    fireworksCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    fireworksCtx.fill();

    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.985;
    particle.vy = particle.vy * 0.985 + 0.028;
    particle.life -= 1;
  }

  if (fireworksParticles.length > 0) {
    fireworksFrameId = requestAnimationFrame(runFireworks);
  } else {
    fireworksFrameId = null;
  }
}

function launchFireworks() {
  const rect = assemblyField.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < 5; i += 1) {
    const spreadX = (Math.random() - 0.5) * rect.width * 0.9;
    const spreadY = (Math.random() - 0.5) * rect.height * 0.8;
    const hue = 140 + Math.random() * 140;
    spawnFireworkBurst(cx + spreadX, cy + spreadY, hue, 30 + Math.floor(Math.random() * 24));
  }

  if (!fireworksFrameId) {
    runFireworks();
  }
}

// Deterministic RNG keeps polygon pieces stable for a given piece index.
function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function getTrianglePoints(index) {
  const orientation = index % 2;

  if (orientation === 0) {
    return [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
  }

  return [
    [1, 0],
    [1, 1],
    [0, 1],
  ];
}

function getPolygonPoints(index) {
  const rand = createSeededRandom((index + 1) * 1337);
  const pointsCount = 6 + Math.floor(rand() * 3);
  const center = 0.5;
  const baseRadius = 0.43;
  const jitter = 0.12;
  const points = [];

  for (let i = 0; i < pointsCount; i += 1) {
    const angle =
      -Math.PI / 2 +
      (i / pointsCount) * Math.PI * 2 +
      (rand() - 0.5) * 0.35;
    const radius = baseRadius + (rand() - 0.5) * jitter;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    points.push([x, y]);
  }

  return points;
}

function buildPathFromPoints(size, points) {
  const path = new Path2D();
  points.forEach(([x, y], i) => {
    const px = x * size;
    const py = y * size;
    if (i === 0) {
      path.moveTo(px, py);
    } else {
      path.lineTo(px, py);
    }
  });
  path.closePath();
  return path;
}

function pointsToClipPath(points) {
  const coords = points.map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`);
  return `polygon(${coords.join(", ")})`;
}

// Piece/cell shape helpers are routed by current shapeMode.
function getPiecePath(size, index) {
  if (shapeMode === "triangles") {
    return buildPathFromPoints(size, getTrianglePoints(index));
  }

  if (shapeMode === "polygons") {
    return buildPathFromPoints(size, getPolygonPoints(index));
  }

  return null;
}

function getCellClipPath(index) {
  if (shapeMode === "triangles") {
    return pointsToClipPath(getTrianglePoints(index));
  }

  if (shapeMode === "polygons") {
    return pointsToClipPath(getPolygonPoints(index));
  }

  return "none";
}

function updateShapeButtonLabel() {
  const label = shapeMode.charAt(0).toUpperCase() + shapeMode.slice(1);
  shapeBtn.textContent = `Shape: ${label}`;
}

function updateCellHintPosition(cell, index) {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;

  const x = gridSize > 1 ? (col / (gridSize - 1)) * 100 : 0;
  const y = gridSize > 1 ? (row / (gridSize - 1)) * 100 : 0;

  cell.style.setProperty("--hint-x", `${x}%`);
  cell.style.setProperty("--hint-y", `${y}%`);
}

function playSnapSound() {
  try {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      audioContext = new AudioCtx();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(710, now);
    osc.frequency.exponentialRampToValueAtTime(1160, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch (error) {
    // Sound is optional, so failures should not block interaction.
  }
}

function pulseCell(cell) {
  cell.classList.remove("snap-flash");
  // Force reflow so repeated snaps retrigger the animation.
  void cell.offsetWidth;
  cell.classList.add("snap-flash");
}

function applyMagnetSnap(piece, droppedCell) {
  const droppedIndex = Number(droppedCell.dataset.index);
  const targetIndex = Number(piece.dataset.pieceIndex);

  if (!Number.isFinite(droppedIndex) || !Number.isFinite(targetIndex)) {
    return;
  }

  // Strict magnet: only snap in the exact section user selected.
  if (droppedIndex !== targetIndex) {
    return;
  }

  pulseCell(droppedCell);
  playSnapSound();
}

function refreshFilledCellState() {
  const cells = assemblyField.querySelectorAll(".field-cell");
  cells.forEach((cell) => {
    cell.classList.toggle("filled", Boolean(cell.querySelector(".piece")));
  });
}

function updateHintSource() {
  if (!sourceImage) {
    assemblyField.style.removeProperty("--hint-image");
    return;
  }

  const hintDataUrl = originalCanvas.toDataURL("image/png");
  assemblyField.style.setProperty("--hint-image", `url("${hintDataUrl}")`);
}

function setHintVisibility(visible) {
  hintVisible = visible;
  assemblyField.classList.toggle("hint-enabled", hintVisible);
  hintBtn.textContent = hintVisible ? "Hide view" : "View";
}

function updateGridStyles() {
  const gap = gridSize >= 12 ? 3 : gridSize >= 10 ? 4 : 8;
  assemblyField.style.setProperty("--grid-size", String(gridSize));
  assemblyField.style.setProperty("--cell-size", `${pieceSize}px`);
  assemblyField.style.setProperty("--gap", `${gap}px`);
}

function setDifficulty(nextGridSize) {
  gridSize = nextGridSize;
  pieceSize = CANVAS_SIZE / gridSize;
  updateGridStyles();
}

function initializeGrid() {
  assemblyField.innerHTML = "";
  updateGridStyles();

  // Each target cell knows its expected piece index.
  for (let i = 0; i < gridSize * gridSize; i += 1) {
    const cell = document.createElement("div");
    cell.className = "field-cell";
    cell.dataset.index = String(i);
    updateCellHintPosition(cell, i);
    cell.style.clipPath = getCellClipPath(i);

    cell.addEventListener("dragover", onDragOver);
    cell.addEventListener("drop", onDropToCell);
    cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"));

    assemblyField.appendChild(cell);
  }
}

function clearBoardAndStorage() {
  initializeGrid();
  storage.innerHTML = "";
  puzzleSolved = false;
  // Any board reset invalidates current timer run.
  resetSolveTimer();
  toggleExplosionButton(false);
  setTitleDefault();
}

function setTitleDefault() {
  titleEl.textContent = "Pixel Puzzle";
  titleEl.classList.remove("title-success");
}

function setTitleSuccess() {
  titleEl.textContent = "Success";
  titleEl.classList.add("title-success");
}

function useImage(image) {
  sourceImage = image;
  drawImageToOriginalCanvas(sourceImage);
  updateHintSource();
  cutBtn.disabled = false;
  clearBoardAndStorage();
}

function onDragStart(event) {
  // First real interaction starts the run clock.
  tryStartSolveTimer();
  draggedElement = event.currentTarget;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedElement.dataset.pieceIndex || "");
}

function onDragEnd() {
  draggedElement = null;
}

function onDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  event.currentTarget.classList.add("drag-over");
}

function onDropToCell(event) {
  event.preventDefault();
  const cell = event.currentTarget;
  cell.classList.remove("drag-over");

  if (!draggedElement) {
    return;
  }

  const existingPiece = cell.querySelector(".piece");
  if (existingPiece) {
    storage.appendChild(existingPiece);
  }

  cell.appendChild(draggedElement);
  // Snap feedback is cosmetic; validation happens in checkCompletion().
  applyMagnetSnap(draggedElement, cell);
  refreshFilledCellState();
  checkCompletion();
}

function onDropToStorage(event) {
  event.preventDefault();
  storage.classList.remove("drag-over");

  if (!draggedElement) {
    return;
  }

  storage.appendChild(draggedElement);
  refreshFilledCellState();
  checkCompletion();
}

function drawImageToOriginalCanvas(image) {
  originalCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Center-crop behavior to fill square canvas while preserving aspect ratio.
  const scale = Math.max(CANVAS_SIZE / image.width, CANVAS_SIZE / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (CANVAS_SIZE - drawWidth) / 2;
  const offsetY = (CANVAS_SIZE - drawHeight) / 2;

  originalCtx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function makePiece(index) {
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;

  const pieceCanvas = document.createElement("canvas");
  pieceCanvas.width = pieceSize;
  pieceCanvas.height = pieceSize;
  const pieceCtx = pieceCanvas.getContext("2d");
  const piecePath = getPiecePath(pieceSize, index);

  if (piecePath) {
    pieceCtx.save();
    pieceCtx.clip(piecePath);
  }

  pieceCtx.drawImage(
    originalCanvas,
    col * pieceSize,
    row * pieceSize,
    pieceSize,
    pieceSize,
    0,
    0,
    pieceSize,
    pieceSize
  );

  if (piecePath) {
    pieceCtx.restore();
    pieceCtx.strokeStyle = "rgba(255, 255, 255, 0.48)";
    pieceCtx.lineWidth = Math.max(1, pieceSize * 0.02);
    pieceCtx.stroke(piecePath);
  }

  const piece = document.createElement("img");
  piece.className = "piece";
  piece.src = pieceCanvas.toDataURL("image/png");
  piece.draggable = true;
  piece.dataset.pieceIndex = String(index);

  piece.addEventListener("dragstart", onDragStart);
  piece.addEventListener("dragend", onDragEnd);

  return piece;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createPuzzlePieces() {
  clearBoardAndStorage();

  // Generate one piece per grid cell, then shuffle into storage tray.
  const pieces = [];
  for (let i = 0; i < gridSize * gridSize; i += 1) {
    pieces.push(makePiece(i));
  }

  const shuffled = shuffleArray(pieces);
  shuffled.forEach((piece) => storage.appendChild(piece));
  // Timer starts on first drag, not immediately when pieces are generated.
  armSolveTimer();
}

function checkCompletion() {
  const cells = assemblyField.querySelectorAll(".field-cell");

  for (let i = 0; i < cells.length; i += 1) {
    const piece = cells[i].querySelector(".piece");
    if (!piece) {
      puzzleSolved = false;
      toggleExplosionButton(false);
      setTitleDefault();
      return;
    }

    if (Number(piece.dataset.pieceIndex) !== i) {
      puzzleSolved = false;
      toggleExplosionButton(false);
      setTitleDefault();
      return;
    }
  }

  setTitleSuccess();

  if (!puzzleSolved) {
    puzzleSolved = true;
    completeSolveTimer();
    toggleExplosionButton(true);
    launchFireworks();
  }
}

function stopCameraStream() {
  if (!cameraStream) {
    return;
  }

  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  cameraPreview.srcObject = null;
}

async function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    window.alert("Camera is not supported in this browser.");
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    cameraPreview.srcObject = cameraStream;
    cameraModal.classList.add("open");
    cameraModal.setAttribute("aria-hidden", "false");
  } catch (error) {
    window.alert("Camera access was denied or unavailable.");
  }
}

function closeCamera() {
  cameraModal.classList.remove("open");
  cameraModal.setAttribute("aria-hidden", "true");
  stopCameraStream();
}

function captureFromCamera() {
  if (!cameraPreview.videoWidth || !cameraPreview.videoHeight) {
    return;
  }

  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = cameraPreview.videoWidth;
  captureCanvas.height = cameraPreview.videoHeight;
  const captureCtx = captureCanvas.getContext("2d");

  captureCtx.drawImage(
    cameraPreview,
    0,
    0,
    captureCanvas.width,
    captureCanvas.height
  );

  const image = new Image();
  image.onload = () => {
    useImage(image);
    closeCamera();
  };
  image.src = captureCanvas.toDataURL("image/png");
}

uploadInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      useImage(image);
    };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

difficultySelect.addEventListener("change", () => {
  const selected = Number(difficultySelect.value);
  if (![3, 5, 10, 12].includes(selected)) {
    return;
  }

  setDifficulty(selected);
  clearBoardAndStorage();
});

shapeBtn.addEventListener("click", () => {
  const currentIndex = SHAPE_MODES.indexOf(shapeMode);
  const nextIndex = (currentIndex + 1) % SHAPE_MODES.length;
  shapeMode = SHAPE_MODES[nextIndex];
  updateShapeButtonLabel();

  if (sourceImage) {
    drawImageToOriginalCanvas(sourceImage);
    createPuzzlePieces();
  }
});

explodeBtn.addEventListener("click", () => {
  if (!puzzleSolved) {
    return;
  }

  launchFireworks();
});

cutBtn.addEventListener("click", () => {
  if (!sourceImage) {
    return;
  }

  drawImageToOriginalCanvas(sourceImage);
  createPuzzlePieces();
});

hintBtn.addEventListener("click", () => {
  if (!sourceImage) {
    return;
  }

  setHintVisibility(!hintVisible);
});

cameraBtn.addEventListener("click", openCamera);
closeCameraBtn.addEventListener("click", closeCamera);
captureBtn.addEventListener("click", captureFromCamera);
cameraModal.addEventListener("click", (event) => {
  if (event.target === cameraModal) {
    closeCamera();
  }
});
window.addEventListener("beforeunload", stopCameraStream);
window.addEventListener("resize", resizeFireworksCanvas);

resetScoreBtn?.addEventListener("click", () => {
  scoreHistory = [];
  saveScoreHistory();
  renderScoreHistory();
});

saveScoreJsonBtn?.addEventListener("click", () => {
  downloadLeaderboardJson();
});

storage.addEventListener("dragover", onDragOver);
storage.addEventListener("dragleave", () => storage.classList.remove("drag-over"));
storage.addEventListener("drop", onDropToStorage);

cutBtn.disabled = true;
setHintVisibility(false);
updateShapeButtonLabel();
setDifficulty(DEFAULT_GRID_SIZE);
// App bootstrap sequence.
initializeGrid();
resizeFireworksCanvas();
toggleExplosionButton(false);
loadScoreHistory();
renderTimerValue();
renderScoreHistory();
initializeMusicPlaylist();
