const canvas = document.getElementById("paintCanvas");
const ctx = canvas.getContext("2d");
const materialButtons = document.querySelectorAll(".material-btn[data-material]");
const organizeBtn = document.getElementById("organizeBtn");
const windBtn = document.getElementById("windBtn");
const heatBtn = document.getElementById("heatBtn");
const freezeBtn = document.getElementById("freezeBtn");
const screenshotBtn = document.getElementById("screenshotBtn");
const portalsBtn = document.getElementById("portalsBtn");
const bootOverlay = document.getElementById("bootOverlay");
const bootText = document.getElementById("bootText");

const MATERIALS = {
	sand: {
		gravity: 0.22,
		drift: 0.02,
		spawnCount: 8,
		radiusMin: 1.5,
		radiusMax: 3.4,
		hueMin: 34,
		hueMax: 52,
		sat: 85,
		light: 55,
		lifeMin: 140,
		lifeRange: 80
	},
	water: {
		gravity: 0.12,
		drift: 0.13,
		spawnCount: 10,
		radiusMin: 1.2,
		radiusMax: 2.9,
		hueMin: 190,
		hueMax: 215,
		sat: 92,
		light: 58,
		lifeMin: 170,
		lifeRange: 80
	},
	gas: {
		gravity: -0.07,
		drift: 0.2,
		spawnCount: 6,
		radiusMin: 2.2,
		radiusMax: 5,
		hueMin: 115,
		hueMax: 150,
		sat: 70,
		light: 62,
		lifeMin: 100,
		lifeRange: 85
	}
};

const particles = [];
const maxParticles = 3500;
const brushRadius = 150;
const brushStrength = 0.5;
const fusionCellSize = 20;
const fusionBlendRate = 0.22;
const maxCollisionSoundsPerFrame = 3;
const collisionSoundCooldownMs = 28;
const logoPointSpacing = 8;
const logoSteerStrength = 0.11;
const logoDamping = 0.9;
const organizationPulseMs = 2600;
const maxTextTargets = 2600;
const windBaseX = 0.025;
const windGustMin = 0.04;
const windGustMax = 0.16;
const windWaveX = 0.035;
const windWaveY = 0.02;
const windShear = 0.015;
const heatCellSize = 26;
const heatAlphaMax = 0.62;
const gelCellSize = 14;
const gelBounceBoost = 0.88;
const gelSprayRadius = 2;
const portalLongSide = 92;
const portalShortSide = 12;
const portalCooldownMs = 260;
const portalAppearMs = 360;

const FUSION_BY_PAIR = {
	"sand+water": { hue: 28, sat: 98, light: 52 },
	"gas+water": { hue: 186, sat: 96, light: 54 },
	"gas+sand": { hue: 98, sat: 88, light: 56 }
};

let spraying = false;
let pointer = { x: 0, y: 0 };
let currentMaterial = "sand";
let brushMode = "attract";
let audioContext = null;
let noiseBuffer = null;
let lastCollisionSoundAt = 0;
let collisionSoundsThisFrame = 0;
let organizeActive = false;
let manualOrganize = false;
let pulseOrganize = false;
let apertureTargets = [];
let organizationPulseUntil = 0;
let windEnabled = false;
let heatMapEnabled = false;
let frozen = false;
let portalsEnabled = false;
let portalPlacementIndex = 0;
let currentWindGust = 0;
let targetWindGust = 0;
let nextWindShiftAt = performance.now() + 650;
const gelCells = new Set();
const portalAnchors = [
	{ xNorm: 0.18, yNorm: 0.8, color: "rgba(249, 115, 22, 0.95)", spawnAt: performance.now() },
	{ xNorm: 0.84, yNorm: 0.34, color: "rgba(239, 68, 68, 0.95)", spawnAt: performance.now() }
];
let portalRects = [];

function runBootSequence() {
	if (!bootOverlay || !bootText) {
		return;
	}

	const lines = [
		"[SYS] APERTURE SCIENCE MAINFRAME ONLINE",
		"[CHK] PARTICLE FIELD CONTAINMENT........OK",
		"[CHK] GELS / PORTALS / WIND ARRAYS......OK",
		"[AUTH] TEST CHAMBER CLEARANCE: C-137",
		"[BOOT] INITIALIZING EXPERIMENT INTERFACE"
	];

	let lineIndex = 0;
	let charIndex = 0;
	let currentLine = "";

	function typeFrame() {
		if (lineIndex >= lines.length) {
			setTimeout(() => {
				bootOverlay.classList.add("hidden");
				setTimeout(() => {
					bootOverlay.style.display = "none";
				}, 520);
			}, 420);
			return;
		}

		const source = lines[lineIndex];
		currentLine += source[charIndex];
		charIndex += 1;
		bootText.textContent = `${bootText.textContent}${currentLine.slice(-1)}`;

		if (charIndex >= source.length) {
			bootText.textContent += "\n";
			lineIndex += 1;
			charIndex = 0;
			currentLine = "";
			setTimeout(typeFrame, 130);
			return;
		}

		setTimeout(typeFrame, 16 + Math.random() * 34);
	}

	typeFrame();
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function resolvePortalOrientation(anchor) {
	if (anchor.yNorm <= 0.24 || anchor.yNorm >= 0.76) {
		return "horizontal";
	}
	return "vertical";
}

function resolvePortalNormal(anchor, orientation) {
	if (orientation === "horizontal") {
		return { x: 0, y: anchor.yNorm < 0.5 ? 1 : -1 };
	}
	return { x: anchor.xNorm < 0.5 ? 1 : -1, y: 0 };
}

function buildPortalRects(width, height) {
	portalRects = portalAnchors.map((anchor, index) => {
		const orientation = resolvePortalOrientation(anchor);
		const size = orientation === "horizontal"
			? { w: portalLongSide, h: portalShortSide }
			: { w: portalShortSide, h: portalLongSide };
		const centerX = anchor.xNorm * width;
		const centerY = anchor.yNorm * height;
		return {
			id: index,
			orientation,
			normal: resolvePortalNormal(anchor, orientation),
			color: anchor.color,
			x: centerX - size.w * 0.5,
			y: centerY - size.h * 0.5,
			w: size.w,
			h: size.h,
			cx: centerX,
			cy: centerY,
			spawnAt: anchor.spawnAt || performance.now()
		};
	});
}

function placePortalAt(x, y) {
	const anchor = portalAnchors[portalPlacementIndex % portalAnchors.length];
	anchor.xNorm = clamp(x / Math.max(1, window.innerWidth), 0.04, 0.96);
	anchor.yNorm = clamp(y / Math.max(1, window.innerHeight), 0.04, 0.96);
	anchor.spawnAt = performance.now();
	portalPlacementIndex = (portalPlacementIndex + 1) % portalAnchors.length;
	buildPortalRects(window.innerWidth, window.innerHeight);
}

function renderPortals(nowMs) {
	if (!portalsEnabled || portalRects.length < 2) {
		return;
	}

	const glowPulse = 0.8 + Math.sin(nowMs * 0.012) * 0.2;
	ctx.save();
	for (let i = 0; i < portalRects.length; i += 1) {
		const portal = portalRects[i];
		const appearT = clamp((nowMs - portal.spawnAt) / portalAppearMs, 0, 1);
		const easeOut = 1 - Math.pow(1 - appearT, 3);
		const scale = 0.25 + easeOut * 0.75;
		const alpha = 0.2 + easeOut * 0.8;
		ctx.save();
		ctx.translate(portal.cx, portal.cy);
		ctx.scale(scale, scale);
		ctx.translate(-portal.cx, -portal.cy);
		ctx.shadowBlur = (24 + glowPulse * 14) * (0.6 + easeOut * 0.4);
		ctx.shadowColor = portal.color;
		ctx.fillStyle = portal.color.replace("0.95", `${alpha}`);
		ctx.fillRect(portal.x, portal.y, portal.w, portal.h);
		ctx.shadowBlur = 0;
		ctx.fillStyle = `rgba(255, 255, 255, ${0.12 + easeOut * 0.18})`;
		ctx.fillRect(portal.x + 2, portal.y + 2, portal.w - 4, portal.h - 4);
		ctx.restore();

		if (appearT < 1) {
			ctx.save();
			ctx.strokeStyle = portal.color.replace("0.95", `${0.4 * (1 - appearT)}`);
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(portal.cx, portal.cy, portal.w * (0.8 + appearT), portal.h * (0.8 + appearT), 0, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		}
	}
	ctx.restore();
}

function teleportThroughPortals(particle, nowMs) {
	if (!portalsEnabled || portalRects.length < 2) {
		return;
	}
	if (particle.portalCooldownUntil && nowMs < particle.portalCooldownUntil) {
		return;
	}

	let source = null;
	for (let i = 0; i < portalRects.length; i += 1) {
		const portal = portalRects[i];
		if (
			particle.x >= portal.x && particle.x <= portal.x + portal.w &&
			particle.y >= portal.y && particle.y <= portal.y + portal.h
		) {
			source = portal;
			break;
		}
	}

	if (!source) {
		return;
	}

	const target = portalRects[(source.id + 1) % portalRects.length];
	const speed = Math.max(1.2, Math.hypot(particle.vx, particle.vy));
	particle.x = target.cx + target.normal.x * (target.w * 0.5 + particle.radius + 2);
	particle.y = target.cy + target.normal.y * (target.h * 0.5 + particle.radius + 2);
	particle.vx = target.normal.x * speed + (Math.random() - 0.5) * 0.4;
	particle.vy = target.normal.y * speed + (Math.random() - 0.5) * 0.4;
	particle.portalCooldownUntil = nowMs + portalCooldownMs;
}

function updateWindStorm(nowMs) {
	if (nowMs >= nextWindShiftAt) {
		targetWindGust = randomRange(windGustMin, windGustMax);
		nextWindShiftAt = nowMs + randomRange(280, 900);
	}

	currentWindGust += (targetWindGust - currentWindGust) * 0.05;

	return {
		x: windBaseX + currentWindGust + Math.sin(nowMs * 0.0052) * windWaveX,
		y: Math.cos(nowMs * 0.0043) * windWaveY
	};
}

function syncOrganizeState() {
	organizeActive = manualOrganize || pulseOrganize;
	organizeBtn.classList.toggle("active", organizeActive);
}

function triggerApertureOrganizationPulse() {
	apertureTargets = buildApertureTargets(window.innerWidth, window.innerHeight);
	ensureParticlesForLogo(apertureTargets.length);
	normalizeParticlesForAperture();
	pulseOrganize = true;
	organizationPulseUntil = performance.now() + organizationPulseMs;
	syncOrganizeState();
}

function randomRange(min, max) {
	return min + Math.random() * (max - min);
}

function randomMaterialName() {
	const choices = ["sand", "water", "gas"];
	return choices[Math.floor(Math.random() * choices.length)];
}

function recolorParticleForMaterial(particle, materialName) {
	const material = MATERIALS[materialName];
	particle.material = materialName;
	particle.radius = material.radiusMin + Math.random() * (material.radiusMax - material.radiusMin);
	particle.hue = material.hueMin + Math.random() * (material.hueMax - material.hueMin);
	particle.sat = material.sat;
	particle.light = material.light;
	particle.life = Math.max(particle.life, 260 + Math.random() * 200);
}

function createParticleOfMaterial(x, y, materialName) {
	const material = MATERIALS[materialName];
	const speed = 0.6 + Math.random() * 3;
	const angle = Math.random() * Math.PI * 2;
	return {
		x,
		y,
		vx: Math.cos(angle) * speed * 0.6,
		vy: Math.sin(angle) * speed - 1.2,
		radius: material.radiusMin + Math.random() * (material.radiusMax - material.radiusMin),
		life: 220 + Math.random() * 220,
		hue: material.hueMin + Math.random() * (material.hueMax - material.hueMin),
		sat: material.sat,
		light: material.light,
		material: materialName
	};
}

function buildApertureTargets(width, height) {
	const offscreen = document.createElement("canvas");
	offscreen.width = Math.max(1, Math.floor(width));
	offscreen.height = Math.max(1, Math.floor(height));
	const offCtx = offscreen.getContext("2d");
	if (!offCtx) {
		return [];
	}

	offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
	offCtx.fillStyle = "#ffffff";
	offCtx.textAlign = "center";
	offCtx.textBaseline = "middle";

	const apertureSize = Math.max(72, Math.min(width * 0.16, 170));
	const scienceSize = Math.max(28, Math.min(apertureSize * 0.42, 62));
	const centerX = width * 0.5;
	const centerY = height * 0.53;

	offCtx.font = `700 ${Math.round(apertureSize)}px "Segoe UI", Tahoma, sans-serif`;
	offCtx.fillText("Aperture", centerX, centerY);
	offCtx.font = `600 ${Math.round(scienceSize)}px "Segoe UI", Tahoma, sans-serif`;
	offCtx.fillText("science", centerX, centerY + apertureSize * 0.52);

	const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
	const data = imageData.data;
	const points = [];
	const step = 4;
	for (let y = 0; y < offscreen.height; y += step) {
		for (let x = 0; x < offscreen.width; x += step) {
			const idx = (y * offscreen.width + x) * 4 + 3;
			if (data[idx] > 40) {
				points.push({ x, y });
			}
		}
	}

	if (points.length > maxTextTargets) {
		const sampled = [];
		const pickStep = Math.max(1, Math.ceil(points.length / maxTextTargets));
		for (let i = 0; i < points.length; i += pickStep) {
			sampled.push(points[i]);
		}
		return sampled;
	}

	return points;
}

function ensureParticlesForLogo(targetCount) {
	const needed = Math.min(maxParticles, targetCount) - particles.length;
	for (let i = 0; i < needed; i += 1) {
		particles.push(
			createParticleOfMaterial(
				randomRange(window.innerWidth * 0.2, window.innerWidth * 0.8),
				randomRange(window.innerHeight * 0.1, window.innerHeight * 0.9),
				randomMaterialName()
			)
		);
	}

	if (particles.length > maxParticles) {
		particles.splice(0, particles.length - maxParticles);
	}

	const desired = Math.min(maxParticles, targetCount);
	if (organizeActive && particles.length > desired) {
		particles.splice(desired, particles.length - desired);
	}
}

function normalizeParticlesForAperture() {
	if (particles.length === 0) {
		return;
	}

	const cycle = ["sand", "water", "gas"];
	for (let i = 0; i < particles.length; i += 1) {
		recolorParticleForMaterial(particles[i], cycle[i % cycle.length]);
	}
}

function applySelfOrganization() {
	if (!organizeActive || apertureTargets.length === 0) {
		return;
	}

	const targetCount = apertureTargets.length;
	for (let i = 0; i < particles.length; i += 1) {
		const p = particles[i];
		const target = apertureTargets[i % targetCount];
		const dx = target.x - p.x;
		const dy = target.y - p.y;

		p.vx += dx * logoSteerStrength * 0.065;
		p.vy += dy * logoSteerStrength * 0.065;
		p.vx *= logoDamping;
		p.vy *= logoDamping;

		if (Math.hypot(dx, dy) < 5) {
			p.vx *= 0.68;
			p.vy *= 0.68;
		}
	}
}

function gelKey(cellX, cellY) {
	return `${cellX},${cellY}`;
}

function sprayGelAt(x, y) {
	const centerX = Math.floor(x / gelCellSize);
	const centerY = Math.floor(y / gelCellSize);
	for (let ox = -gelSprayRadius; ox <= gelSprayRadius; ox += 1) {
		for (let oy = -gelSprayRadius; oy <= gelSprayRadius; oy += 1) {
			if (ox * ox + oy * oy > gelSprayRadius * gelSprayRadius) {
				continue;
			}
			gelCells.add(gelKey(centerX + ox, centerY + oy));
		}
	}
}

function hasGelAt(x, y) {
	const cellX = Math.floor(x / gelCellSize);
	const cellY = Math.floor(y / gelCellSize);
	return gelCells.has(gelKey(cellX, cellY));
}

function renderGel() {
	if (gelCells.size === 0) {
		return;
	}

	ctx.save();
	ctx.globalCompositeOperation = "source-over";
	for (const key of gelCells) {
		const [xText, yText] = key.split(",");
		const x = Number(xText) * gelCellSize;
		const y = Number(yText) * gelCellSize;
		ctx.fillStyle = "rgba(139, 92, 246, 0.52)";
		ctx.fillRect(x, y, gelCellSize, gelCellSize);
		ctx.fillStyle = "rgba(216, 180, 255, 0.22)";
		ctx.fillRect(x + 2, y + 2, gelCellSize - 4, gelCellSize - 4);
	}
	ctx.restore();
}

function renderHeatMapOverlay() {
	if (!heatMapEnabled || particles.length === 0) {
		return;
	}

	const densityGrid = new Map();
	let peak = 0;

	for (let i = 0; i < particles.length; i += 1) {
		const p = particles[i];
		const cellX = Math.floor(p.x / heatCellSize);
		const cellY = Math.floor(p.y / heatCellSize);
		const key = `${cellX},${cellY}`;
		const next = (densityGrid.get(key) || 0) + 1;
		densityGrid.set(key, next);
		if (next > peak) {
			peak = next;
		}
	}

	if (peak === 0) {
		return;
	}

	ctx.save();
	ctx.globalCompositeOperation = "screen";

	for (const [key, count] of densityGrid.entries()) {
		const [xText, yText] = key.split(",");
		const x = Number(xText) * heatCellSize;
		const y = Number(yText) * heatCellSize;
		const t = count / peak;
		const hue = 220 - t * 220;
		const alpha = Math.min(heatAlphaMax, 0.08 + t * t * heatAlphaMax);
		ctx.fillStyle = `hsla(${hue}, 95%, 55%, ${alpha})`;
		ctx.fillRect(x, y, heatCellSize + 1, heatCellSize + 1);
	}

	ctx.restore();
}

function ensureAudioContext() {
	if (!audioContext) {
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		if (!AudioContextClass) {
			return null;
		}
		audioContext = new AudioContextClass();

		const bufferLength = Math.floor(audioContext.sampleRate * 0.08);
		noiseBuffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
		const channelData = noiseBuffer.getChannelData(0);
		for (let i = 0; i < channelData.length; i += 1) {
			channelData[i] = Math.random() * 2 - 1;
		}
	}

	if (audioContext.state === "suspended") {
		audioContext.resume().catch(() => {
			// Ignore resume failures until next user gesture.
		});
	}

	return audioContext;
}

function playClinkSound(intensity) {
	const ctxAudio = ensureAudioContext();
	if (!ctxAudio || ctxAudio.state !== "running") {
		return;
	}

	const now = ctxAudio.currentTime;
	const gain = ctxAudio.createGain();
	const osc = ctxAudio.createOscillator();
	const overtone = ctxAudio.createOscillator();

	const baseFreq = 820 + Math.random() * 420;
	osc.type = "triangle";
	osc.frequency.setValueAtTime(baseFreq, now);
	overtone.type = "sine";
	overtone.frequency.setValueAtTime(baseFreq * 1.9, now);

	const volume = Math.min(0.12, 0.03 + intensity * 0.025);
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(volume, now + 0.005);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

	osc.connect(gain);
	overtone.connect(gain);
	gain.connect(ctxAudio.destination);

	osc.start(now);
	overtone.start(now);
	osc.stop(now + 0.08);
	overtone.stop(now + 0.08);
}

function playCrackleSound(intensity) {
	const ctxAudio = ensureAudioContext();
	if (!ctxAudio || ctxAudio.state !== "running" || !noiseBuffer) {
		return;
	}

	const now = ctxAudio.currentTime;
	const source = ctxAudio.createBufferSource();
	const filter = ctxAudio.createBiquadFilter();
	const gain = ctxAudio.createGain();

	source.buffer = noiseBuffer;
	filter.type = "bandpass";
	filter.frequency.setValueAtTime(1800 + Math.random() * 1200, now);
	filter.Q.setValueAtTime(1.2, now);

	const volume = Math.min(0.13, 0.02 + intensity * 0.03);
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(volume, now + 0.004);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

	source.connect(filter);
	filter.connect(gain);
	gain.connect(ctxAudio.destination);

	source.start(now);
	source.stop(now + 0.065);
}

function maybePlayCollisionSound(materialA, materialB, impactStrength) {
	const nowMs = performance.now();
	if (collisionSoundsThisFrame >= maxCollisionSoundsPerFrame) {
		return;
	}
	if (nowMs - lastCollisionSoundAt < collisionSoundCooldownMs) {
		return;
	}
	if (impactStrength < 0.35) {
		return;
	}

	collisionSoundsThisFrame += 1;
	lastCollisionSoundAt = nowMs;

	const crackleBias = materialA === "gas" || materialB === "gas" || Math.random() < 0.35;
	if (crackleBias) {
		playCrackleSound(impactStrength);
	} else {
		playClinkSound(impactStrength);
	}
}

function pairKey(materialA, materialB) {
	return [materialA, materialB].sort().join("+");
}

function lerp(start, end, amount) {
	return start + (end - start) * amount;
}

function lerpHue(fromHue, toHue, amount) {
	let delta = ((toHue - fromHue + 540) % 360) - 180;
	if (delta < -180) {
		delta += 360;
	}
	return (fromHue + delta * amount + 360) % 360;
}

function resolveFusionColor(particleA, particleB) {
	if (particleA.material !== particleB.material) {
		const mapped = FUSION_BY_PAIR[pairKey(particleA.material, particleB.material)];
		if (mapped) {
			return mapped;
		}
	}

	const hueDiff = Math.abs((((particleA.hue - particleB.hue) % 360) + 540) % 360);
	if (particleA.material === particleB.material && Math.min(hueDiff, 360 - hueDiff) < 10) {
		return null;
	}

	return {
		hue: (particleA.hue + particleB.hue) * 0.5,
		sat: (particleA.sat + particleB.sat) * 0.5,
		light: (particleA.light + particleB.light) * 0.5
	};
}

function applyFusionToParticle(particle, fusionColor) {
	particle.hue = lerpHue(particle.hue, fusionColor.hue, fusionBlendRate);
	particle.sat = lerp(particle.sat, fusionColor.sat, fusionBlendRate);
	particle.light = lerp(particle.light, fusionColor.light, fusionBlendRate);
}

function resolveParticleCollisionsAndFusion() {
	const grid = new Map();

	for (let i = 0; i < particles.length; i += 1) {
		const p = particles[i];
		const cellX = Math.floor(p.x / fusionCellSize);
		const cellY = Math.floor(p.y / fusionCellSize);
		const key = `${cellX},${cellY}`;
		const cell = grid.get(key);
		if (cell) {
			cell.push(i);
		} else {
			grid.set(key, [i]);
		}
	}

	for (const [key, cellIndices] of grid.entries()) {
		const [cellXText, cellYText] = key.split(",");
		const cellX = Number(cellXText);
		const cellY = Number(cellYText);

		for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
			for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
				const neighborKey = `${cellX + offsetX},${cellY + offsetY}`;
				const neighborIndices = grid.get(neighborKey);
				if (!neighborIndices) {
					continue;
				}

				for (let i = 0; i < cellIndices.length; i += 1) {
					const aIndex = cellIndices[i];
					for (let j = 0; j < neighborIndices.length; j += 1) {
						const bIndex = neighborIndices[j];
						if (bIndex <= aIndex) {
							continue;
						}

						const a = particles[aIndex];
						const b = particles[bIndex];
						const dx = b.x - a.x;
						const dy = b.y - a.y;
						const minDist = a.radius + b.radius;
						const distSq = dx * dx + dy * dy;

						if (distSq > minDist * minDist) {
							continue;
						}

						const fusionColor = resolveFusionColor(a, b);
						if (fusionColor) {
							applyFusionToParticle(a, fusionColor);
							applyFusionToParticle(b, fusionColor);
						}

						const impactStrength = Math.hypot(b.vx - a.vx, b.vy - a.vy);
						maybePlayCollisionSound(a.material, b.material, impactStrength);

						const dist = Math.sqrt(distSq) || 0.001;
						const nx = dx / dist;
						const ny = dy / dist;
						const overlap = (minDist - dist) * 0.5;

						a.x -= nx * overlap;
						a.y -= ny * overlap;
						b.x += nx * overlap;
						b.y += ny * overlap;

						a.vx -= nx * 0.02;
						a.vy -= ny * 0.02;
						b.vx += nx * 0.02;
						b.vy += ny * 0.02;
					}
				}
			}
		}
	}
}

function resizeCanvas() {
	const ratio = window.devicePixelRatio || 1;
	canvas.width = Math.floor(window.innerWidth * ratio);
	canvas.height = Math.floor(window.innerHeight * ratio);
	canvas.style.width = `${window.innerWidth}px`;
	canvas.style.height = `${window.innerHeight}px`;
	ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
	apertureTargets = buildApertureTargets(window.innerWidth, window.innerHeight);
	buildPortalRects(window.innerWidth, window.innerHeight);
}

function createParticle(x, y) {
	return createParticleOfMaterial(x, y, currentMaterial);
}

function sprinkle(x, y) {
	const material = MATERIALS[currentMaterial];
	for (let i = 0; i < material.spawnCount; i += 1) {
		const offsetX = (Math.random() - 0.5) * 12;
		const offsetY = (Math.random() - 0.5) * 12;
		particles.push(createParticle(x + offsetX, y + offsetY));
	}

	if (particles.length > maxParticles) {
		particles.splice(0, particles.length - maxParticles);
	}
}

function applyBrushForce() {
	for (let i = 0; i < particles.length; i += 1) {
		const p = particles[i];
		const dx = pointer.x - p.x;
		const dy = pointer.y - p.y;
		const distSq = dx * dx + dy * dy;
		if (distSq <= 1 || distSq > brushRadius * brushRadius) {
			continue;
		}

		const dist = Math.sqrt(distSq);
		const nx = dx / dist;
		const ny = dy / dist;
		const falloff = 1 - dist / brushRadius;
		const direction = brushMode === "attract" ? 1 : -1;
		const impulse = brushStrength * falloff * direction;

		p.vx += nx * impulse;
		p.vy += ny * impulse;
	}
}

function setBrushModeFromEvent(event) {
	brushMode = event.shiftKey || event.button === 2 ? "repel" : "attract";
}

function updateAndDraw() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	collisionSoundsThisFrame = 0;
	const nowMs = performance.now();

	if (pulseOrganize && nowMs >= organizationPulseUntil) {
		pulseOrganize = false;
		syncOrganizeState();
	}

	if (organizeActive) {
		ensureParticlesForLogo(apertureTargets.length);
	}

	const stormWind = windEnabled ? updateWindStorm(nowMs) : null;

	if (!frozen) {
		for (let i = particles.length - 1; i >= 0; i -= 1) {
			const p = particles[i];
			const material = MATERIALS[p.material];
			p.vx += (Math.random() - 0.5) * material.drift;
			p.vy += material.gravity;

			if (stormWind) {
				const yRatio = p.y / Math.max(1, window.innerHeight);
				const shearX = (yRatio - 0.5) * windShear;
				p.vx += stormWind.x + shearX;
				p.vy += stormWind.y + Math.sin((p.x + nowMs * 0.23) * 0.018) * 0.004;
			}

			if (p.material === "water") {
				p.vx *= 0.997;
			}

			if (p.material === "gas") {
				p.vx *= 0.992;
				p.vy *= 0.995;
			}
			p.x += p.vx;
			p.y += p.vy;
			p.life -= 1;

			const floorY = window.innerHeight - p.radius;
			if (p.material !== "gas" && p.y > floorY) {
				p.y = floorY;
				if (p.material === "sand") {
					p.vy *= -0.15;
					p.vx *= 0.86;
				}
				if (p.material === "water") {
					p.vy *= -0.35;
					p.vx += (Math.random() - 0.5) * 0.55;
				}
			}

			if (hasGelAt(p.x, p.y + p.radius)) {
				if (p.vy > 0) {
					p.vy = -Math.max(1.4, Math.abs(p.vy) * gelBounceBoost);
				}
				p.vx += (Math.random() - 0.5) * 0.5;
			}

			teleportThroughPortals(p, nowMs);
		}

		resolveParticleCollisionsAndFusion();
		applySelfOrganization();
	}

	for (let i = particles.length - 1; i >= 0; i -= 1) {
		const p = particles[i];

		const alpha = Math.max(0, p.life / 190);
		ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${alpha})`;
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
		ctx.fill();

		const outBottom = p.y - p.radius > window.innerHeight;
		const outTop = p.y + p.radius < 0;
		const outLeft = p.x + p.radius < 0;
		const outRight = p.x - p.radius > window.innerWidth;
		if (p.life <= 0 || outBottom || outTop || outLeft || outRight) {
			particles.splice(i, 1);
		}
	}

	renderGel();

	renderPortals(nowMs);

	renderHeatMapOverlay();

	if (currentMaterial === "brush") {
		ctx.save();
		ctx.beginPath();
		ctx.arc(pointer.x, pointer.y, brushRadius, 0, Math.PI * 2);
		ctx.strokeStyle = brushMode === "attract" ? "rgba(22, 163, 74, 0.45)" : "rgba(220, 38, 38, 0.45)";
		ctx.lineWidth = 2;
		ctx.setLineDash([8, 6]);
		ctx.stroke();
		ctx.restore();
	}

	if (!frozen && spraying && currentMaterial === "brush") {
		applyBrushForce();
	}

	if (!frozen && spraying && currentMaterial === "gel") {
		sprayGelAt(pointer.x, pointer.y);
	}

	if (!frozen && spraying && currentMaterial !== "brush" && currentMaterial !== "gel") {
		sprinkle(pointer.x, pointer.y);
	}

	requestAnimationFrame(updateAndDraw);
}

function setPointerPosition(event) {
	pointer.x = event.clientX;
	pointer.y = event.clientY;
}

canvas.addEventListener("pointerdown", (event) => {
	ensureAudioContext();
	setPointerPosition(event);
	setBrushModeFromEvent(event);
	if (!frozen && portalsEnabled && event.button === 2) {
		placePortalAt(pointer.x, pointer.y);
		spraying = false;
		return;
	}
	spraying = true;
	if (currentMaterial !== "brush") {
		if (currentMaterial === "gel") {
			sprayGelAt(pointer.x, pointer.y);
		} else {
			sprinkle(pointer.x, pointer.y);
		}
	}
});

canvas.addEventListener("pointermove", (event) => {
	setPointerPosition(event);
	setBrushModeFromEvent(event);
});

canvas.addEventListener("contextmenu", (event) => {
	event.preventDefault();
});

window.addEventListener("pointerup", () => {
	spraying = false;
	brushMode = "attract";
});

window.addEventListener("pointercancel", () => {
	spraying = false;
});

window.addEventListener("resize", resizeCanvas);

organizeBtn.addEventListener("click", () => {
	manualOrganize = !manualOrganize;
	if (manualOrganize) {
		apertureTargets = buildApertureTargets(window.innerWidth, window.innerHeight);
		ensureParticlesForLogo(apertureTargets.length);
		normalizeParticlesForAperture();
	}
	syncOrganizeState();
});

windBtn.addEventListener("click", () => {
	windEnabled = !windEnabled;
	windBtn.classList.toggle("active", windEnabled);
});

heatBtn.addEventListener("click", () => {
	heatMapEnabled = !heatMapEnabled;
	heatBtn.classList.toggle("active", heatMapEnabled);
});

freezeBtn.addEventListener("click", () => {
	frozen = !frozen;
	freezeBtn.classList.toggle("active", frozen);
});

screenshotBtn.addEventListener("click", () => {
	const link = document.createElement("a");
	const stamp = new Date().toISOString().replace(/[.:]/g, "-");
	link.download = `particle-shot-${stamp}.png`;
	link.href = canvas.toDataURL("image/png");
	link.click();
});

portalsBtn.addEventListener("click", () => {
	portalsEnabled = !portalsEnabled;
	portalsBtn.classList.toggle("active", portalsEnabled);
	if (portalsEnabled) {
		portalPlacementIndex = 0;
		const now = performance.now();
		portalAnchors.forEach((anchor) => {
			anchor.spawnAt = now;
		});
		buildPortalRects(window.innerWidth, window.innerHeight);
	}
});

materialButtons.forEach((button) => {
	button.addEventListener("click", () => {
		const selected = button.dataset.material || "sand";
		if (selected === "gel" && currentMaterial === "gel") {
			gelCells.clear();
		}
		currentMaterial = selected;
		materialButtons.forEach((btn) => {
			btn.classList.toggle("active", btn === button);
		});
	});
});

resizeCanvas();
runBootSequence();
updateAndDraw();
