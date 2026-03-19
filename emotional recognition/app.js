const video = document.getElementById("webcam");
const emotionLabel = document.getElementById("emotionLabel");
const confidenceLabel = document.getElementById("confidenceLabel");
const videoWrap = document.querySelector(".video-wrap");
const stickerLayer = document.getElementById("stickerLayer");
const pingPongCanvas = document.getElementById("pingPongCanvas");
const smackModeButton = document.getElementById("smackModeButton");
const glitchFilterButton = document.getElementById("glitchFilterButton");
const liveFilterButton = document.getElementById("liveFilterButton");
const pingPongFilterButton = document.getElementById("pingPongFilterButton");
const liveBadge = document.getElementById("liveBadge");
const pingPongCtx = pingPongCanvas?.getContext("2d");

const MODEL_BASE_URI = "https://justadudewhohacks.github.io/face-api.js/models";
const EMOTION_CLASSES = [
  "emotion-happy",
  "emotion-sad",
  "emotion-neutral",
  "emotion-angry",
];
const EMOTION_WEIGHTS = {
  happy: 1.0,
  sad: 1.0,
  neutral: 0.92,
  angry: 1.45,
};
const EMOTION_STICKERS = {
  happy: ["😂", "🤣", "😆", "😄", "😁", "🥳", "✨", "🎉"],
  sad: ["😭", "😢", "🥺", "💧", "☔", "🌧️", "😞", "🫗"],
  neutral: ["🙂", "😐", "🫥", "🪞", "⚪", "🫧", "💬", "🧊"],
  angry: ["😡", "🤬", "💢", "🔥", "👿", "⚡", "🥊", "🧨"],
};
const STICKER_ANGLES = [-90, -45, 0, 45, 90];

let isSmackModeOn = false;
let isGlitchFilterOn = false;
let isLiveFilterOn = false;
let isPingPongGameOn = false;
let currentEmotion = "neutral";
let pingPongFrameId = null;
let pingPongLastTime = 0;
let lastBallTouch = "player";

const pingPongState = {
  paddleWidth: 11,
  paddleHeight: 92,
  playerSpeed: 320,
  playerY: 120,
  botY: 120,
  botBaseSpeed: 210,
  botMaxSpeed: 520,
  botReaction: 0.15,
  botTrackingError: 24,
  botTargetY: 120,
  ballX: 160,
  ballY: 120,
  ballRadius: 7,
  ballVx: 220,
  ballVy: 145,
  maxLives: 3,
  playerLives: 3,
  roundCount: 0,
  spikesActive: false,
  spikeDepth: 14,
  spikeTopGaps: [],
  spikeBottomGaps: [],
  bonusActive: false,
  bonusX: 0,
  bonusY: 0,
  bonusRadius: 10,
  playerScore: 0,
  botScore: 0,
};
const playerInput = {
  up: false,
  down: false,
};

// Emotion-based sticker lookup used when smack mode is enabled.
function getStickerSetForEmotion(emotion) {
  return EMOTION_STICKERS[emotion] || EMOTION_STICKERS.neutral;
}

function setSmackModeButtonState() {
  if (!smackModeButton) {
    return;
  }

  smackModeButton.classList.toggle("active", isSmackModeOn);
  smackModeButton.textContent = `Smack Sticker Mode: ${isSmackModeOn ? "On" : "Off"}`;
}

function setGlitchFilterButtonState() {
  if (!glitchFilterButton || !videoWrap) {
    return;
  }

  glitchFilterButton.classList.toggle("active", isGlitchFilterOn);
  glitchFilterButton.textContent = `Glitch Filter: ${isGlitchFilterOn ? "On" : "Off"}`;
  videoWrap.classList.toggle("glitch-active", isGlitchFilterOn);
}

function setLiveFilterButtonState() {
  if (!liveFilterButton || !videoWrap) {
    return;
  }

  liveFilterButton.classList.toggle("active", isLiveFilterOn);
  liveFilterButton.textContent = `Live Filter: ${isLiveFilterOn ? "On" : "Off"}`;
  videoWrap.classList.toggle("live-active", isLiveFilterOn);

  if (liveBadge) {
    liveBadge.setAttribute("aria-hidden", isLiveFilterOn ? "false" : "true");
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function generateSpikeGaps(width) {
  const gaps = [];
  const gapCount = Math.floor(randomInRange(2, 5));
  const minGap = 34;
  const maxGap = 110;
  const edgeMargin = 24;
  const minSpacing = 18;

  for (let i = 0; i < gapCount; i += 1) {
    let placed = false;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const size = randomInRange(minGap, maxGap);
      const start = randomInRange(edgeMargin, Math.max(edgeMargin + 1, width - edgeMargin - size));
      const end = start + size;

      const overlaps = gaps.some((gap) => !(end + minSpacing < gap.start || start - minSpacing > gap.end));
      if (!overlaps) {
        gaps.push({ start, end });
        placed = true;
        break;
      }
    }

    if (!placed) {
      break;
    }
  }

  gaps.sort((a, b) => a.start - b.start);
  return gaps;
}

function generateSpikeLayout() {
  if (!pingPongCanvas) {
    return;
  }

  // Bonus rounds intentionally use full spike walls (no gaps).
  if (pingPongState.bonusActive) {
    pingPongState.spikeTopGaps = [];
    pingPongState.spikeBottomGaps = [];
    return;
  }

  const width = pingPongCanvas.width;
  pingPongState.spikeTopGaps = generateSpikeGaps(width);
  pingPongState.spikeBottomGaps = generateSpikeGaps(width);
}

function isBallInSpikeGap(x, gaps) {
  return gaps.some((gap) => x >= gap.start && x <= gap.end);
}

function predictBallYAtX(targetX, width, height) {
  if (Math.abs(pingPongState.ballVx) < 0.001) {
    return pingPongState.ballY;
  }

  const time = (targetX - pingPongState.ballX) / pingPongState.ballVx;

  if (time <= 0) {
    return pingPongState.ballY;
  }

  let projectedY = pingPongState.ballY + pingPongState.ballVy * time;
  const minY = pingPongState.ballRadius;
  const maxY = height - pingPongState.ballRadius;
  const playSpan = Math.max(1, maxY - minY);

  // Reflect projected Y within top/bottom bounds to estimate bounces.
  while (projectedY < minY || projectedY > maxY) {
    if (projectedY > maxY) {
      projectedY = maxY - (projectedY - maxY);
    } else if (projectedY < minY) {
      projectedY = minY + (minY - projectedY);
    }

    // Guard against rare float edge loops.
    projectedY = clamp(projectedY, minY - playSpan, maxY + playSpan);
  }

  return projectedY;
}

function resizePingPongCanvas() {
  if (!videoWrap || !pingPongCanvas) {
    return;
  }

  const rect = videoWrap.getBoundingClientRect();
  pingPongCanvas.width = Math.max(1, Math.floor(rect.width));
  pingPongCanvas.height = Math.max(1, Math.floor(rect.height));

  const maxY = Math.max(0, pingPongCanvas.height - pingPongState.paddleHeight);
  pingPongState.playerY = clamp(pingPongState.playerY, 0, maxY);
  pingPongState.botY = clamp(pingPongState.botY, 0, maxY);
}

function resetPingPongBall(direction = 1) {
  if (!pingPongCanvas) {
    return;
  }

  pingPongState.ballX = pingPongCanvas.width / 2;
  pingPongState.ballY = pingPongCanvas.height / 2;
  pingPongState.ballVx = direction * 220;
  pingPongState.ballVy = (Math.random() * 180 - 90) || 120;
  lastBallTouch = direction > 0 ? "player" : "bot";
  // Every rally gets a fresh spike pattern.
  generateSpikeLayout();
}

function spawnHealthBonus() {
  if (!pingPongCanvas) {
    return;
  }

  const margin = 56;
  const minX = pingPongCanvas.width * 0.3;
  const maxX = pingPongCanvas.width * 0.7;

  pingPongState.bonusX = Math.random() * (maxX - minX) + minX;
  pingPongState.bonusY = Math.random() * (pingPongCanvas.height - margin * 2) + margin;
  pingPongState.bonusActive = true;
}

function startPingPongGame() {
  if (!pingPongCanvas) {
    return;
  }

  resizePingPongCanvas();
  pingPongState.playerY = Math.max(0, pingPongCanvas.height / 2 - pingPongState.paddleHeight / 2);
  pingPongState.botY = pingPongState.playerY;
  pingPongState.botTargetY = pingPongState.botY + pingPongState.paddleHeight / 2;
  pingPongState.playerLives = pingPongState.maxLives;
  pingPongState.roundCount = 0;
  pingPongState.spikesActive = true;
  pingPongState.bonusActive = false;
  resetPingPongBall(Math.random() > 0.5 ? 1 : -1);
  pingPongLastTime = 0;

  if (pingPongFrameId !== null) {
    cancelAnimationFrame(pingPongFrameId);
  }

  pingPongFrameId = requestAnimationFrame(runPingPongFrame);
}

function stopPingPongGame() {
  if (pingPongFrameId !== null) {
    cancelAnimationFrame(pingPongFrameId);
    pingPongFrameId = null;
  }

  if (pingPongCtx && pingPongCanvas) {
    pingPongCtx.clearRect(0, 0, pingPongCanvas.width, pingPongCanvas.height);
  }
}

function drawPingPongGame() {
  if (!pingPongCtx || !pingPongCanvas) {
    return;
  }

  const width = pingPongCanvas.width;
  const height = pingPongCanvas.height;
  const leftPaddleX = 18;
  const rightPaddleX = width - 18 - pingPongState.paddleWidth;

  pingPongCtx.clearRect(0, 0, width, height);
  pingPongCtx.fillStyle = "rgba(4, 8, 18, 0.2)";
  pingPongCtx.fillRect(0, 0, width, height);

  if (pingPongState.spikesActive) {
    pingPongCtx.fillStyle = "rgba(255, 90, 110, 0.9)";
    const spikeStep = 18;
    const spikeSize = 10;

    // Draw spikes only outside the generated gap ranges.
    for (let x = 0; x <= width + spikeStep; x += spikeStep) {
      const spikeTipX = x + spikeSize / 2;

      if (!isBallInSpikeGap(spikeTipX, pingPongState.spikeTopGaps)) {
        pingPongCtx.beginPath();
        pingPongCtx.moveTo(x, 0);
        pingPongCtx.lineTo(spikeTipX, pingPongState.spikeDepth);
        pingPongCtx.lineTo(x + spikeSize, 0);
        pingPongCtx.closePath();
        pingPongCtx.fill();
      }

      if (!isBallInSpikeGap(spikeTipX, pingPongState.spikeBottomGaps)) {
        pingPongCtx.beginPath();
        pingPongCtx.moveTo(x, height);
        pingPongCtx.lineTo(spikeTipX, height - pingPongState.spikeDepth);
        pingPongCtx.lineTo(x + spikeSize, height);
        pingPongCtx.closePath();
        pingPongCtx.fill();
      }
    }
  }

  pingPongCtx.strokeStyle = "rgba(180, 204, 255, 0.42)";
  pingPongCtx.setLineDash([8, 10]);
  pingPongCtx.beginPath();
  pingPongCtx.moveTo(width / 2, 0);
  pingPongCtx.lineTo(width / 2, height);
  pingPongCtx.stroke();
  pingPongCtx.setLineDash([]);

  pingPongCtx.fillStyle = "#ffffff";
  pingPongCtx.fillRect(leftPaddleX, pingPongState.playerY, pingPongState.paddleWidth, pingPongState.paddleHeight);

  pingPongCtx.fillStyle = "#40ff6a";
  pingPongCtx.fillRect(rightPaddleX, pingPongState.botY, pingPongState.paddleWidth, pingPongState.paddleHeight);

  pingPongCtx.fillStyle = "#8cf3ff";
  pingPongCtx.beginPath();
  pingPongCtx.arc(pingPongState.ballX, pingPongState.ballY, pingPongState.ballRadius, 0, Math.PI * 2);
  pingPongCtx.fill();

  if (pingPongState.bonusActive) {
    pingPongCtx.fillStyle = "rgba(255, 88, 88, 0.25)";
    pingPongCtx.beginPath();
    pingPongCtx.arc(pingPongState.bonusX, pingPongState.bonusY, pingPongState.bonusRadius + 5, 0, Math.PI * 2);
    pingPongCtx.fill();

    pingPongCtx.fillStyle = "#ff5f5f";
    pingPongCtx.beginPath();
    pingPongCtx.arc(pingPongState.bonusX, pingPongState.bonusY, pingPongState.bonusRadius, 0, Math.PI * 2);
    pingPongCtx.fill();

    pingPongCtx.font = "700 16px 'Space Grotesk', sans-serif";
    pingPongCtx.textAlign = "center";
    pingPongCtx.fillStyle = "#ffffff";
    pingPongCtx.fillText("❤️", pingPongState.bonusX, pingPongState.bonusY + 6);
  }

  pingPongCtx.font = "700 22px 'Space Grotesk', sans-serif";
  pingPongCtx.textAlign = "center";
  pingPongCtx.fillStyle = "rgba(235, 245, 255, 0.9)";
  pingPongCtx.fillText(`${pingPongState.playerScore} : ${pingPongState.botScore}`, width / 2, 30);

  const hearts = "💜".repeat(pingPongState.playerLives);
  pingPongCtx.font = "700 20px 'Space Grotesk', sans-serif";
  pingPongCtx.textAlign = "left";
  pingPongCtx.fillText(hearts, Math.max(14, width / 2 - 180), 30);
}

function handleRoundEnd(loser) {
  // Round transitions update bonus state before serving the next ball.
  pingPongState.roundCount += 1;
  const shouldSpawnBonus = pingPongState.roundCount % 2 === 0;

  pingPongState.bonusActive = false;
  if (shouldSpawnBonus) {
    spawnHealthBonus();
  }

  if (loser === "player") {
    pingPongState.playerLives = Math.max(0, pingPongState.playerLives - 1);
    pingPongState.botScore += 1;

    if (pingPongState.playerLives === 0) {
      pingPongState.playerLives = pingPongState.maxLives;
      pingPongState.playerScore = 0;
      pingPongState.botScore = 0;
      pingPongState.roundCount = 0;
      pingPongState.bonusActive = false;
      pingPongState.spikesActive = true;
      resetPingPongBall(1);
      return;
    }

    resetPingPongBall(1);
  } else {
    pingPongState.playerScore += 1;
    resetPingPongBall(-1);
  }
}

function handleSpikeHit() {
  if (lastBallTouch === "bot") {
    // Bot caused spike contact: player is rewarded.
    pingPongState.playerScore += 1;
    resetPingPongBall(-1);
    return;
  }

  // If player sends the ball into spikes, do a full match reset.
  pingPongState.playerLives = pingPongState.maxLives;
  pingPongState.playerScore = 0;
  pingPongState.botScore = 0;
  pingPongState.roundCount = 0;
  pingPongState.bonusActive = false;
  resetPingPongBall(1);
}

function runPingPongFrame(timestamp) {
  if (!isPingPongGameOn || !pingPongCanvas) {
    pingPongFrameId = null;
    return;
  }

  if (pingPongLastTime === 0) {
    pingPongLastTime = timestamp;
  }

  const dt = Math.min((timestamp - pingPongLastTime) / 1000, 0.04);
  pingPongLastTime = timestamp;

  const width = pingPongCanvas.width;
  const height = pingPongCanvas.height;
  const leftPaddleX = 18;
  const rightPaddleX = width - 18 - pingPongState.paddleWidth;

  if (playerInput.up && !playerInput.down) {
    pingPongState.playerY -= pingPongState.playerSpeed * dt;
  }

  if (playerInput.down && !playerInput.up) {
    pingPongState.playerY += pingPongState.playerSpeed * dt;
  }

  pingPongState.playerY = clamp(pingPongState.playerY, 0, height - pingPongState.paddleHeight);

  // AI paddle predicts ball intercept and moves with imperfect reaction.
  const botCenterY = pingPongState.botY + pingPongState.paddleHeight / 2;
  const ballMovingToBot = pingPongState.ballVx > 0;
  const predictedY = predictBallYAtX(rightPaddleX - pingPongState.ballRadius, width, height);
  const fallbackY = height / 2;
  const targetY = ballMovingToBot ? predictedY : fallbackY;

  const distanceToBot = Math.max(0, rightPaddleX - pingPongState.ballX);
  const urgency = 1 - clamp(distanceToBot / Math.max(1, width * 0.55), 0, 1);
  const noiseRange = pingPongState.botTrackingError * (ballMovingToBot ? 1 - urgency * 0.68 : 0.35);
  const trackingNoise = (Math.random() - 0.5) * noiseRange;
  const imperfectTargetY = targetY + trackingNoise;
  const reactionLerp = clamp(dt / pingPongState.botReaction, 0, 1);

  pingPongState.botTargetY += (imperfectTargetY - pingPongState.botTargetY) * reactionLerp;
  const deltaY = pingPongState.botTargetY - botCenterY;

  const neededSpeed =
    pingPongState.botBaseSpeed +
    Math.abs(deltaY) * 1.35 +
    Math.abs(pingPongState.ballVx) * 0.28 +
    urgency * 170;
  const botSpeed = clamp(neededSpeed, pingPongState.botBaseSpeed, pingPongState.botMaxSpeed);

  if (Math.abs(deltaY) > 3) {
    const moveStep = Math.min(Math.abs(deltaY), botSpeed * dt);
    pingPongState.botY += Math.sign(deltaY) * moveStep;
  }

  pingPongState.botY = clamp(pingPongState.botY, 0, height - pingPongState.paddleHeight);

  pingPongState.ballX += pingPongState.ballVx * dt;
  pingPongState.ballY += pingPongState.ballVy * dt;

  if (pingPongState.spikesActive) {
    const touchedTopSpikes =
      pingPongState.ballY - pingPongState.ballRadius <= pingPongState.spikeDepth &&
      !isBallInSpikeGap(pingPongState.ballX, pingPongState.spikeTopGaps);
    const touchedBottomSpikes =
      pingPongState.ballY + pingPongState.ballRadius >= height - pingPongState.spikeDepth &&
      !isBallInSpikeGap(pingPongState.ballX, pingPongState.spikeBottomGaps);

    if (touchedTopSpikes || touchedBottomSpikes) {
      handleSpikeHit();
      drawPingPongGame();
      pingPongFrameId = requestAnimationFrame(runPingPongFrame);
      return;
    }
  }

  if (pingPongState.ballY - pingPongState.ballRadius <= 0 || pingPongState.ballY + pingPongState.ballRadius >= height) {
    pingPongState.ballVy *= -1;
    pingPongState.ballY = clamp(pingPongState.ballY, pingPongState.ballRadius, height - pingPongState.ballRadius);
  }

  const playerHit =
    pingPongState.ballX - pingPongState.ballRadius <= leftPaddleX + pingPongState.paddleWidth &&
    pingPongState.ballY >= pingPongState.playerY &&
    pingPongState.ballY <= pingPongState.playerY + pingPongState.paddleHeight &&
    pingPongState.ballVx < 0;

  if (playerHit) {
    // Store ball ownership for spike outcome rules.
    lastBallTouch = "player";
    pingPongState.ballX = leftPaddleX + pingPongState.paddleWidth + pingPongState.ballRadius;
    pingPongState.ballVx = Math.abs(pingPongState.ballVx) * 1.04;
    const hitOffset = (pingPongState.ballY - (pingPongState.playerY + pingPongState.paddleHeight / 2)) / (pingPongState.paddleHeight / 2);
    pingPongState.ballVy += hitOffset * 130;
  }

  const botHitMargin = clamp(Math.abs(pingPongState.ballVx) * 0.01, 2, 10);
  const botHit =
    pingPongState.ballX + pingPongState.ballRadius >= rightPaddleX &&
    pingPongState.ballY >= pingPongState.botY + botHitMargin &&
    pingPongState.ballY <= pingPongState.botY + pingPongState.paddleHeight - botHitMargin &&
    pingPongState.ballVx > 0;

  if (botHit) {
    // Store ball ownership for spike outcome rules.
    lastBallTouch = "bot";
    pingPongState.ballX = rightPaddleX - pingPongState.ballRadius;
    pingPongState.ballVx = -Math.abs(pingPongState.ballVx) * 1.04;
    const hitOffset = (pingPongState.ballY - (pingPongState.botY + pingPongState.paddleHeight / 2)) / (pingPongState.paddleHeight / 2);
    pingPongState.ballVy += hitOffset * 95;
  }

  if (pingPongState.bonusActive) {
    const dx = pingPongState.ballX - pingPongState.bonusX;
    const dy = pingPongState.ballY - pingPongState.bonusY;
    const hitDistance = pingPongState.ballRadius + pingPongState.bonusRadius;

    if (dx * dx + dy * dy <= hitDistance * hitDistance) {
      pingPongState.playerLives = pingPongState.maxLives;
      pingPongState.bonusActive = false;
    }
  }

  if (pingPongState.ballX < -20) {
    handleRoundEnd("player");
  }

  if (pingPongState.ballX > width + 20) {
    handleRoundEnd("bot");
  }

  drawPingPongGame();
  pingPongFrameId = requestAnimationFrame(runPingPongFrame);
}

function setPingPongFilterButtonState() {
  if (!pingPongFilterButton || !videoWrap) {
    return;
  }

  pingPongFilterButton.classList.toggle("active", isPingPongGameOn);
  pingPongFilterButton.textContent = `Ping Pong Game: ${isPingPongGameOn ? "On" : "Off"}`;
  videoWrap.classList.toggle("pingpong-game-active", isPingPongGameOn);

  if (isPingPongGameOn) {
    startPingPongGame();
  } else {
    stopPingPongGame();
  }
}

function addSmackSticker(clientX, clientY) {
  if (!videoWrap || !stickerLayer) {
    return;
  }

  const rect = videoWrap.getBoundingClientRect();
  const left = clientX - rect.left;
  const top = clientY - rect.top;

  if (left < 0 || top < 0 || left > rect.width || top > rect.height) {
    return;
  }

  const sticker = document.createElement("span");
  const emojiPool = getStickerSetForEmotion(currentEmotion);
  const emoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];
  const angle = STICKER_ANGLES[Math.floor(Math.random() * STICKER_ANGLES.length)];

  sticker.className = "click-sticker";
  sticker.textContent = emoji;
  sticker.style.left = `${left}px`;
  sticker.style.top = `${top}px`;
  sticker.style.setProperty("--sticker-angle", `${angle}deg`);

  stickerLayer.appendChild(sticker);
  sticker.addEventListener("animationend", () => sticker.remove(), { once: true });
}

function initStickerControls() {
  if (!videoWrap || !stickerLayer || !smackModeButton || !glitchFilterButton || !liveFilterButton || !pingPongFilterButton) {
    return;
  }

  smackModeButton.addEventListener("click", () => {
    isSmackModeOn = !isSmackModeOn;
    setSmackModeButtonState();
  });

  glitchFilterButton.addEventListener("click", () => {
    isGlitchFilterOn = !isGlitchFilterOn;
    setGlitchFilterButtonState();
  });

  liveFilterButton.addEventListener("click", () => {
    isLiveFilterOn = !isLiveFilterOn;
    setLiveFilterButtonState();
  });

  pingPongFilterButton.addEventListener("click", () => {
    isPingPongGameOn = !isPingPongGameOn;
    setPingPongFilterButtonState();
  });

  window.addEventListener("keydown", (event) => {
    if (!isPingPongGameOn) {
      return;
    }

    if (event.key === "ArrowUp") {
      playerInput.up = true;
      event.preventDefault();
    }

    if (event.key === "ArrowDown") {
      playerInput.down = true;
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowUp") {
      playerInput.up = false;
      event.preventDefault();
    }

    if (event.key === "ArrowDown") {
      playerInput.down = false;
      event.preventDefault();
    }
  });

  videoWrap.addEventListener("click", (event) => {
    if (!isSmackModeOn) {
      return;
    }

    addSmackSticker(event.clientX, event.clientY);
  });

  setSmackModeButtonState();
  setGlitchFilterButtonState();
  setLiveFilterButtonState();
  setPingPongFilterButtonState();

  window.addEventListener("resize", () => {
    if (!isPingPongGameOn) {
      return;
    }

    resizePingPongCanvas();
  });
}

function setEmotionVisualState(emotion, confidence) {
  // Keep latest detected emotion so sticker emojis match mood.
  currentEmotion = emotion;

  document.body.classList.remove(...EMOTION_CLASSES);
  document.body.classList.add(`emotion-${emotion}`);

  emotionLabel.textContent = emotion.charAt(0).toUpperCase() + emotion.slice(1);
  confidenceLabel.textContent = `${(confidence * 100).toFixed(1)}%`;
}

function mapExpressionToEmotion(expressions) {
  if (!expressions) {
    return { emotion: "neutral", confidence: 0 };
  }

  // Add a small disgust contribution because many angry faces split between angry/disgusted.
  const angrySignal = (expressions.angry || 0) + (expressions.disgusted || 0) * 0.42;

  const candidates = {
    happy: (expressions.happy || 0) * EMOTION_WEIGHTS.happy,
    sad: (expressions.sad || 0) * EMOTION_WEIGHTS.sad,
    neutral: (expressions.neutral || 0) * EMOTION_WEIGHTS.neutral,
    angry: angrySignal * EMOTION_WEIGHTS.angry,
  };

  const [emotion, confidence] = Object.entries(candidates).reduce((best, current) =>
    current[1] > best[1] ? current : best
  );

  return { emotion, confidence };
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
  } catch (error) {
    emotionLabel.textContent = "Camera access blocked";
    confidenceLabel.textContent = "Enable camera permission";
    console.error("Could not access camera", error);
  }
}

async function loadModels() {
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_URI),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_BASE_URI),
    ]);
  } catch (error) {
    emotionLabel.textContent = "Model loading failed";
    confidenceLabel.textContent = "Check internet connection";
    console.error("Could not load face-api models", error);
    throw error;
  }
}

async function detectLoop() {
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.45,
  });

  window.setInterval(async () => {
    if (video.readyState < 2) {
      return;
    }

    const detection = await faceapi
      .detectSingleFace(video, options)
      .withFaceExpressions();

    if (!detection) {
      setEmotionVisualState("neutral", 0);
      emotionLabel.textContent = "No face detected";
      return;
    }

    const { emotion, confidence } = mapExpressionToEmotion(detection.expressions);
    setEmotionVisualState(emotion, confidence);
  }, 700);
}

async function init() {
  if (!navigator.mediaDevices?.getUserMedia) {
    emotionLabel.textContent = "Browser unsupported";
    confidenceLabel.textContent = "Use a modern browser";
    return;
  }

  // Controls are usable even before model/camera startup completes.
  initStickerControls();
  await loadModels();
  await startCamera();
  await detectLoop();
}

init();
