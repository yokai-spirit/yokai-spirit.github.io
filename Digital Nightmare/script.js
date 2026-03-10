const canvas = document.getElementById("displayCanvas");
const ctx = canvas.getContext("2d");
const cameraBtn = document.getElementById("cameraBtn");
const photoBtn = document.getElementById("photoBtn");
const themeBtn = document.getElementById("themeBtn");
const mirrorBtn = document.getElementById("mirrorBtn");
const freezeBtn = document.getElementById("freezeBtn");
const asciiBtn = document.getElementById("asciiBtn");
const saveBtn = document.getElementById("saveBtn");
const photoInput = document.getElementById("photoInput");
const video = document.getElementById("cameraFeed");

let stream = null;
let activeSource = null;
let renderLoopId = null;
let rgbOffsetX = 0;
let rgbOffsetY = 0;
let frameHistoryCanvas = null;
let frameHistoryCtx = null;
let pixelSortRect = null;
let selectionStart = null;
let isSelecting = false;
let audioContext = null;
let micAnalyser = null;
let micDataArray = null;
let micStream = null;
let smoothedMicLevel = 0;
let micInitialized = false;
let activeTheme = "neon";
let mirrorSectors = 0;
let freezeMode = "off";
let freezeRect = null;
let freezeSelectionStart = null;
let freezeFrameCanvas = null;
let freezeFrameCtx = null;
let freezeNeedsCapture = false;
let asciiMode = false;

const MAX_SPLIT = 12;
const MAX_AUDIO_SHAKE = 24;

function resizeCanvas() {
	const rect = canvas.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const targetWidth = Math.max(1, Math.floor(rect.width * dpr));
	const targetHeight = Math.max(1, Math.floor(rect.height * dpr));
	let sizeChanged = false;

	if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
		canvas.width = targetWidth;
		canvas.height = targetHeight;
		sizeChanged = true;
	}

	if (sizeChanged) {
		resetFrameHistory();
		pixelSortRect = null;
		clearFreezeRegion();
	}

	renderCurrentFrame();
}

function ensureFrameHistoryBuffer() {
	if (!frameHistoryCanvas) {
		frameHistoryCanvas = document.createElement("canvas");
		frameHistoryCtx = frameHistoryCanvas.getContext("2d");
	}

	if (
		frameHistoryCanvas.width !== canvas.width ||
		frameHistoryCanvas.height !== canvas.height
	) {
		frameHistoryCanvas.width = canvas.width;
		frameHistoryCanvas.height = canvas.height;
		frameHistoryCtx.clearRect(0, 0, frameHistoryCanvas.width, frameHistoryCanvas.height);
	}
}

function resetFrameHistory() {
	if (!frameHistoryCanvas) {
		return;
	}

	frameHistoryCtx.clearRect(0, 0, frameHistoryCanvas.width, frameHistoryCanvas.height);
}

function drawPlaceholder() {
	ctx.fillStyle = "#0a1021";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.strokeStyle = "rgba(0, 240, 255, 0.5)";
	ctx.lineWidth = 4;
	ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
}

function drawCover(source) {
	const srcW = source.videoWidth || source.naturalWidth || source.width;
	const srcH = source.videoHeight || source.naturalHeight || source.height;
	if (!srcW || !srcH) {
		return;
	}

	const dstW = canvas.width;
	const dstH = canvas.height;
	const srcRatio = srcW / srcH;
	const dstRatio = dstW / dstH;

	let sx = 0;
	let sy = 0;
	let sWidth = srcW;
	let sHeight = srcH;

	if (srcRatio > dstRatio) {
		sWidth = srcH * dstRatio;
		sx = (srcW - sWidth) / 2;
	} else {
		sHeight = srcW / dstRatio;
		sy = (srcH - sHeight) / 2;
	}

	ctx.clearRect(0, 0, dstW, dstH);
	ctx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, dstW, dstH);
}

function getMicLevel() {
	if (!micAnalyser || !micDataArray) {
		smoothedMicLevel *= 0.9;
		return smoothedMicLevel;
	}

	micAnalyser.getByteTimeDomainData(micDataArray);
	let sumSquares = 0;
	for (let i = 0; i < micDataArray.length; i += 1) {
		const centered = (micDataArray[i] - 128) / 128;
		sumSquares += centered * centered;
	}

	const rms = Math.sqrt(sumSquares / micDataArray.length);
	const normalized = Math.min(1, rms * 3.2);
	smoothedMicLevel = smoothedMicLevel * 0.82 + normalized * 0.18;
	return smoothedMicLevel;
}

function applyRgbSplit() {
	if (!rgbOffsetX && !rgbOffsetY) {
		return;
	}

	const w = canvas.width;
	const h = canvas.height;
	const imageData = ctx.getImageData(0, 0, w, h);
	const src = imageData.data;
	const output = new Uint8ClampedArray(src);

	const rdx = rgbOffsetX;
	const rdy = rgbOffsetY;
	const gdx = -rgbOffsetX;
	const gdy = 0;
	const bdx = 0;
	const bdy = -rgbOffsetY;

	for (let y = 0; y < h; y += 1) {
		for (let x = 0; x < w; x += 1) {
			const idx = (y * w + x) * 4;

			const rx = Math.min(w - 1, Math.max(0, Math.round(x + rdx)));
			const ry = Math.min(h - 1, Math.max(0, Math.round(y + rdy)));
			const gx = Math.min(w - 1, Math.max(0, Math.round(x + gdx)));
			const gy = Math.min(h - 1, Math.max(0, Math.round(y + gdy)));
			const bx = Math.min(w - 1, Math.max(0, Math.round(x + bdx)));
			const by = Math.min(h - 1, Math.max(0, Math.round(y + bdy)));

			output[idx] = src[(ry * w + rx) * 4];
			output[idx + 1] = src[(gy * w + gx) * 4 + 1];
			output[idx + 2] = src[(by * w + bx) * 4 + 2];
			output[idx + 3] = src[idx + 3];
		}
	}

	imageData.data.set(output);
	ctx.putImageData(imageData, 0, 0);
}

function applyDatamoshLite() {
	if (!frameHistoryCanvas || !frameHistoryCanvas.width || !frameHistoryCanvas.height) {
		return;
	}

	const w = canvas.width;
	const h = canvas.height;
	const stretchX = Math.max(1, Math.round(Math.abs(rgbOffsetX) * 0.6));
	const stretchY = Math.max(1, Math.round(Math.abs(rgbOffsetY) * 0.6));

	ctx.save();
	ctx.globalAlpha = 0.28;
	ctx.globalCompositeOperation = "screen";
	ctx.drawImage(
		frameHistoryCanvas,
		0,
		0,
		w,
		h,
		-stretchX,
		-stretchY,
		w + stretchX * 2,
		h + stretchY * 2
	);

	// Strip-based smear creates a lightweight datamosh feeling without heavy processing.
	ctx.globalAlpha = 0.16;
	ctx.globalCompositeOperation = "source-over";
	const stripHeight = Math.max(8, Math.round(h / 42));
	for (let y = 0; y < h; y += stripHeight) {
		const sourceY = Math.max(0, y - stretchY * 2);
		ctx.drawImage(
			frameHistoryCanvas,
			0,
			sourceY,
			w,
			stripHeight,
			-stretchX,
			y,
			w + stretchX,
			stripHeight
		);
	}
	ctx.restore();
}

function applyPixelSorting() {
	if (!pixelSortRect) {
		return;
	}

	const x = Math.max(0, Math.floor(pixelSortRect.x));
	const y = Math.max(0, Math.floor(pixelSortRect.y));
	const w = Math.min(canvas.width - x, Math.floor(pixelSortRect.width));
	const h = Math.min(canvas.height - y, Math.floor(pixelSortRect.height));

	if (w < 2 || h < 2) {
		return;
	}

	const region = ctx.getImageData(x, y, w, h);
	const data = region.data;

	for (let row = 0; row < h; row += 1) {
		const pixels = [];
		for (let col = 0; col < w; col += 1) {
			const idx = (row * w + col) * 4;
			const r = data[idx];
			const g = data[idx + 1];
			const b = data[idx + 2];
			const a = data[idx + 3];
			const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
			pixels.push({ r, g, b, a, brightness });
		}

		// Sorting each scanline by luminance creates a controllable glitch strip effect.
		pixels.sort((p1, p2) => p1.brightness - p2.brightness);

		for (let col = 0; col < w; col += 1) {
			const idx = (row * w + col) * 4;
			const px = pixels[col];
			data[idx] = px.r;
			data[idx + 1] = px.g;
			data[idx + 2] = px.b;
			data[idx + 3] = px.a;
		}
	}

	ctx.putImageData(region, x, y);
}

function applyAudioReactiveDistortion() {
	const micLevel = getMicLevel();
	if (micLevel < 0.02) {
		return;
	}

	const w = canvas.width;
	const h = canvas.height;
	const shake = Math.max(1, Math.round(MAX_AUDIO_SHAKE * micLevel));
	const now = performance.now() * 0.01;
	const offsetX = Math.round(Math.sin(now * 1.7) * shake);
	const offsetY = Math.round(Math.cos(now * 2.1) * shake * 0.6);

	ctx.save();
	ctx.globalAlpha = Math.min(0.5, 0.1 + micLevel * 0.45);
	ctx.globalCompositeOperation = "lighter";
	ctx.drawImage(canvas, 0, 0, w, h, offsetX, offsetY, w, h);

	// Horizontal slice shifts mimic compression collapse under loud input.
	ctx.globalCompositeOperation = "source-over";
	ctx.globalAlpha = Math.min(0.45, 0.12 + micLevel * 0.35);
	const slices = Math.max(6, Math.round(10 + micLevel * 28));
	const sliceHeight = Math.max(2, Math.floor(h / slices));
	for (let i = 0; i < slices; i += 1) {
		const sy = i * sliceHeight;
		if (sy >= h) {
			break;
		}
		const thisSliceHeight = Math.min(sliceHeight, h - sy);
		const jitter = Math.round((Math.random() * 2 - 1) * shake * 1.2);
		ctx.drawImage(canvas, 0, sy, w, thisSliceHeight, jitter, sy, w, thisSliceHeight);
	}
	ctx.restore();
}

function applyScanlineOverlay() {
	if (activeTheme !== "crt") {
		return;
	}

	const w = canvas.width;
	const h = canvas.height;
	const time = performance.now() * 0.008;
	const micLevel = getMicLevel();
	const spacing = Math.max(2, Math.round(3 + micLevel * 4));

	ctx.save();
	ctx.globalCompositeOperation = "multiply";
	for (let y = 0; y < h; y += spacing) {
		const pulse = 0.08 + (Math.sin(y * 0.05 + time) + 1) * 0.07;
		ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.35, pulse)})`;
		ctx.fillRect(0, y, w, 1);
	}

	// A traveling bright line adds classic CRT refresh movement.
	ctx.globalCompositeOperation = "screen";
	ctx.globalAlpha = 0.1;
	const scanY = Math.floor(((time * 28) % (h + 80)) - 40);
	ctx.fillStyle = "rgba(140, 255, 170, 0.85)";
	ctx.fillRect(0, scanY, w, 2);
	ctx.restore();
}

function applyMirrorDimension() {
	if (mirrorSectors !== 4 && mirrorSectors !== 8) {
		return;
	}

	const w = canvas.width;
	const h = canvas.height;
	if (!w || !h) {
		return;
	}

	const snapshot = document.createElement("canvas");
	snapshot.width = w;
	snapshot.height = h;
	const snapshotCtx = snapshot.getContext("2d");
	snapshotCtx.drawImage(canvas, 0, 0);

	ctx.save();
	ctx.clearRect(0, 0, w, h);
	ctx.translate(w / 2, h / 2);

	const radius = Math.hypot(w, h);
	const step = (Math.PI * 2) / mirrorSectors;
	for (let i = 0; i < mirrorSectors; i += 1) {
		ctx.save();
		ctx.rotate(i * step);
		if (i % 2 === 1) {
			ctx.scale(-1, 1);
		}

		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(radius, -Math.tan(step / 2) * radius);
		ctx.lineTo(radius, Math.tan(step / 2) * radius);
		ctx.closePath();
		ctx.clip();

		ctx.drawImage(snapshot, -w / 2, -h / 2, w, h);
		ctx.restore();
	}

	ctx.restore();
}

function applyAsciiMode() {
	if (!asciiMode) {
		return;
	}

	const w = canvas.width;
	const h = canvas.height;
	if (!w || !h) {
		return;
	}

	const cell = Math.max(6, Math.round(7 * (window.devicePixelRatio || 1)));
	const charset = " .,:;irsXA253hMHGS#9B&@";
	const sourceData = ctx.getImageData(0, 0, w, h).data;

	ctx.save();
	ctx.fillStyle = activeTheme === "crt" ? "rgba(6, 14, 8, 0.96)" : "rgba(4, 8, 18, 0.94)";
	ctx.fillRect(0, 0, w, h);
	ctx.font = `${cell}px monospace`;
	ctx.textBaseline = "top";

	for (let y = 0; y < h; y += cell) {
		for (let x = 0; x < w; x += cell) {
			const sx = Math.min(w - 1, x + Math.floor(cell / 2));
			const sy = Math.min(h - 1, y + Math.floor(cell / 2));
			const idx = (sy * w + sx) * 4;

			const r = sourceData[idx];
			const g = sourceData[idx + 1];
			const b = sourceData[idx + 2];
			const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
			const charIndex = Math.floor((brightness / 255) * (charset.length - 1));
			const char = charset[charIndex];

			if (char === " ") {
				continue;
			}

			if (activeTheme === "crt") {
				const greenBoost = Math.min(255, Math.round(g * 1.15 + 25));
				ctx.fillStyle = `rgba(${Math.round(r * 0.45)}, ${greenBoost}, ${Math.round(b * 0.45)}, 0.95)`;
			} else {
				ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.96)`;
			}

			ctx.fillText(char, x, y);
		}
	}

	ctx.restore();
}

function ensureFreezeBuffer(width, height) {
	if (!freezeFrameCanvas) {
		freezeFrameCanvas = document.createElement("canvas");
		freezeFrameCtx = freezeFrameCanvas.getContext("2d");
	}

	if (freezeFrameCanvas.width !== width || freezeFrameCanvas.height !== height) {
		freezeFrameCanvas.width = width;
		freezeFrameCanvas.height = height;
	}
}

function captureFreezeRegionFromCurrentFrame() {
	if (!freezeRect || !freezeNeedsCapture) {
		return;
	}

	const x = Math.max(0, Math.floor(freezeRect.x));
	const y = Math.max(0, Math.floor(freezeRect.y));
	const width = Math.min(canvas.width - x, Math.floor(freezeRect.width));
	const height = Math.min(canvas.height - y, Math.floor(freezeRect.height));

	if (width < 2 || height < 2) {
		freezeNeedsCapture = false;
		return;
	}

	ensureFreezeBuffer(width, height);
	freezeFrameCtx.clearRect(0, 0, width, height);
	freezeFrameCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
	freezeNeedsCapture = false;
}

function applyFrameFreeze() {
	if (freezeMode !== "on" || !freezeRect || !freezeFrameCanvas) {
		return;
	}

	ctx.drawImage(
		freezeFrameCanvas,
		0,
		0,
		freezeFrameCanvas.width,
		freezeFrameCanvas.height,
		freezeRect.x,
		freezeRect.y,
		freezeRect.width,
		freezeRect.height
	);
}

function drawFreezeOverlay() {
	if (!freezeRect) {
		return;
	}

	ctx.save();
	ctx.lineWidth = Math.max(2, Math.round((window.devicePixelRatio || 1) * 1.2));
	ctx.setLineDash(freezeMode === "select" ? [6, 6] : [14, 8]);
	ctx.strokeStyle = freezeMode === "select" ? "rgba(255, 46, 156, 0.95)" : "rgba(255, 220, 120, 0.95)";
	ctx.strokeRect(freezeRect.x, freezeRect.y, freezeRect.width, freezeRect.height);
	ctx.restore();
}

function clearFreezeRegion() {
	freezeRect = null;
	freezeNeedsCapture = false;
	if (freezeFrameCtx && freezeFrameCanvas) {
		freezeFrameCtx.clearRect(0, 0, freezeFrameCanvas.width, freezeFrameCanvas.height);
	}
}

function drawSelectionOverlay() {
	if (!pixelSortRect) {
		return;
	}

	ctx.save();
	ctx.strokeStyle = "rgba(0, 240, 255, 0.95)";
	ctx.lineWidth = Math.max(2, Math.round((window.devicePixelRatio || 1) * 1.2));
	ctx.setLineDash([12, 8]);
	ctx.strokeRect(pixelSortRect.x, pixelSortRect.y, pixelSortRect.width, pixelSortRect.height);
	ctx.restore();
}

function captureFrameHistory() {
	ensureFrameHistoryBuffer();
	frameHistoryCtx.clearRect(0, 0, frameHistoryCanvas.width, frameHistoryCanvas.height);
	frameHistoryCtx.drawImage(canvas, 0, 0);
}

function renderCurrentFrame() {
	if (!activeSource) {
		drawPlaceholder();
		resetFrameHistory();
		return;
	}

	ensureFrameHistoryBuffer();
	drawCover(activeSource);
	applyDatamoshLite();
	applyRgbSplit();
	applyPixelSorting();
	applyAudioReactiveDistortion();
	applyMirrorDimension();
	applyAsciiMode();
	captureFreezeRegionFromCurrentFrame();
	captureFrameHistory();
	applyFrameFreeze();
	applyScanlineOverlay();
	drawFreezeOverlay();
	drawSelectionOverlay();
}

function startRenderLoop() {
	if (renderLoopId) {
		cancelAnimationFrame(renderLoopId);
	}

	function render() {
		renderCurrentFrame();
		renderLoopId = requestAnimationFrame(render);
	}

	render();
}

async function ensureMicrophone() {
	if (micInitialized) {
		if (audioContext && audioContext.state === "suspended") {
			await audioContext.resume();
		}
		return;
	}

	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		return;
	}

	try {
		micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
		audioContext = new window.AudioContext();
		micAnalyser = audioContext.createAnalyser();
		micAnalyser.fftSize = 1024;
		micAnalyser.smoothingTimeConstant = 0.72;
		micDataArray = new Uint8Array(micAnalyser.fftSize);

		const micSource = audioContext.createMediaStreamSource(micStream);
		micSource.connect(micAnalyser);
		micInitialized = true;
	} catch (error) {
		console.warn("Microphone access unavailable:", error);
	}
}

async function turnOnCamera() {
	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		window.alert("Camera access is not supported in this browser.");
		return;
	}

	try {
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
		}

		stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
		video.srcObject = stream;

		await video.play();
		activeSource = video;
		resetFrameHistory();
		startRenderLoop();
		await ensureMicrophone();
	} catch (error) {
		console.error("Could not start camera:", error);
		window.alert("Unable to access the camera.");
	}
}

function stopVideoRender() {
	if (renderLoopId) {
		cancelAnimationFrame(renderLoopId);
		renderLoopId = null;
	}
}

function handlePhotoSelection(event) {
	const file = event.target.files[0];
	if (!file) {
		return;
	}

	const image = new Image();
	image.onload = () => {
		activeSource = image;
		resetFrameHistory();
		startRenderLoop();
	};
	image.src = URL.createObjectURL(file);
	ensureMicrophone();
}

function updateRgbOffset(event) {
	const rect = canvas.getBoundingClientRect();
	if (!rect.width || !rect.height) {
		return;
	}

	const dpr = window.devicePixelRatio || 1;
	const normX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
	const normY = ((event.clientY - rect.top) / rect.height) * 2 - 1;

	rgbOffsetX = Math.round(normX * MAX_SPLIT * dpr);
	rgbOffsetY = Math.round(normY * MAX_SPLIT * dpr);

	if (activeSource && activeSource !== video) {
		renderCurrentFrame();
	}
}

function resetRgbOffset() {
	rgbOffsetX = 0;
	rgbOffsetY = 0;

	if (activeSource && activeSource !== video) {
		renderCurrentFrame();
	}
}

function normalizeRect(start, end) {
	const x = Math.min(start.x, end.x);
	const y = Math.min(start.y, end.y);
	const width = Math.abs(end.x - start.x);
	const height = Math.abs(end.y - start.y);

	return { x, y, width, height };
}

function clientToCanvasPoint(event) {
	const rect = canvas.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const x = Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * dpr));
	const y = Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * dpr));
	return { x, y };
}

function handleSelectionStart(event) {
	if (freezeMode === "select") {
		freezeSelectionStart = clientToCanvasPoint(event);
		isSelecting = true;
		freezeRect = {
			x: freezeSelectionStart.x,
			y: freezeSelectionStart.y,
			width: 1,
			height: 1
		};

		if (canvas.setPointerCapture) {
			canvas.setPointerCapture(event.pointerId);
		}

		if (activeSource && activeSource !== video) {
			renderCurrentFrame();
		}
		return;
	}

	selectionStart = clientToCanvasPoint(event);
	isSelecting = true;
	pixelSortRect = { x: selectionStart.x, y: selectionStart.y, width: 1, height: 1 };

	if (canvas.setPointerCapture) {
		canvas.setPointerCapture(event.pointerId);
	}

	if (activeSource && activeSource !== video) {
		renderCurrentFrame();
	}
}

function handleSelectionMove(event) {
	if (!isSelecting) {
		return;
	}

	if (freezeMode === "select" && freezeSelectionStart) {
		const freezePoint = clientToCanvasPoint(event);
		freezeRect = normalizeRect(freezeSelectionStart, freezePoint);

		if (activeSource && activeSource !== video) {
			renderCurrentFrame();
		}
		return;
	}

	if (!selectionStart) {
		return;
	}

	const point = clientToCanvasPoint(event);
	pixelSortRect = normalizeRect(selectionStart, point);

	if (activeSource && activeSource !== video) {
		renderCurrentFrame();
	}
}

function handleSelectionEnd(event) {
	if (!isSelecting) {
		return;
	}

	if (freezeMode === "select" && freezeSelectionStart) {
		isSelecting = false;
		freezeSelectionStart = null;

		if (canvas.releasePointerCapture) {
			canvas.releasePointerCapture(event.pointerId);
		}

		if (!freezeRect || freezeRect.width < 4 || freezeRect.height < 4) {
			clearFreezeRegion();
			freezeBtn.textContent = "Freeze: Select";
		} else {
			freezeMode = "on";
			freezeNeedsCapture = true;
			freezeBtn.textContent = "Freeze: On";
		}

		if (activeSource && activeSource !== video) {
			renderCurrentFrame();
		}
		return;
	}

	isSelecting = false;
	selectionStart = null;

	if (canvas.releasePointerCapture) {
		canvas.releasePointerCapture(event.pointerId);
	}

	if (pixelSortRect && (pixelSortRect.width < 4 || pixelSortRect.height < 4)) {
		pixelSortRect = null;
	}

	if (activeSource && activeSource !== video) {
		renderCurrentFrame();
	}
}

function toggleTheme() {
	activeTheme = activeTheme === "neon" ? "crt" : "neon";
	document.body.classList.toggle("theme-crt", activeTheme === "crt");
	themeBtn.textContent = activeTheme === "crt" ? "Theme: CRT" : "Theme: Neon";

	if (activeSource && activeSource !== video) {
		renderCurrentFrame();
	}
}

function toggleMirrorMode() {
	if (mirrorSectors === 0) {
		mirrorSectors = 4;
	} else if (mirrorSectors === 4) {
		mirrorSectors = 8;
	} else {
		mirrorSectors = 0;
	}

	mirrorBtn.textContent = mirrorSectors ? `Mirror: ${mirrorSectors}` : "Mirror: Off";

	if (activeSource && activeSource !== video) {
		renderCurrentFrame();
	}
}

function toggleFreezeMode() {
	if (freezeMode === "off") {
		freezeMode = "select";
		clearFreezeRegion();
		freezeBtn.textContent = "Freeze: Select";
	} else if (freezeMode === "select") {
		freezeMode = "off";
		clearFreezeRegion();
		freezeBtn.textContent = "Freeze: Off";
	} else {
		freezeMode = "off";
		clearFreezeRegion();
		freezeBtn.textContent = "Freeze: Off";
	}

	if (activeSource && activeSource !== video) {
		renderCurrentFrame();
	}
}

function toggleAsciiMode() {
	asciiMode = !asciiMode;
	asciiBtn.textContent = asciiMode ? "ASCII: On" : "ASCII: Off";

	if (activeSource && activeSource !== video) {
		renderCurrentFrame();
	}
}

function applyRandomChaosArtifact(targetCtx, width, height) {
	const variant = Math.floor(Math.random() * 4);

	if (variant === 0) {
		const bars = 8 + Math.floor(Math.random() * 14);
		for (let i = 0; i < bars; i += 1) {
			const y = Math.floor(Math.random() * height);
			const h = 2 + Math.floor(Math.random() * 18);
			const shift = Math.floor((Math.random() * 2 - 1) * (width * 0.08));
			targetCtx.drawImage(canvas, 0, y, width, h, shift, y, width, h);
		}
		return;
	}

	if (variant === 1) {
		const lines = 12 + Math.floor(Math.random() * 20);
		for (let i = 0; i < lines; i += 1) {
			const y = Math.floor(Math.random() * height);
			const alpha = 0.18 + Math.random() * 0.45;
			targetCtx.fillStyle = `rgba(${180 + Math.floor(Math.random() * 75)}, ${Math.floor(
				Math.random() * 90
			)}, ${180 + Math.floor(Math.random() * 75)}, ${alpha.toFixed(3)})`;
			targetCtx.fillRect(0, y, width, 1 + Math.floor(Math.random() * 3));
		}
		return;
	}

	if (variant === 2) {
		const blockCount = 4 + Math.floor(Math.random() * 7);
		for (let i = 0; i < blockCount; i += 1) {
			const bw = Math.max(12, Math.floor(width * (0.06 + Math.random() * 0.12)));
			const bh = Math.max(12, Math.floor(height * (0.06 + Math.random() * 0.18)));
			const sx = Math.floor(Math.random() * Math.max(1, width - bw));
			const sy = Math.floor(Math.random() * Math.max(1, height - bh));
			const dx = Math.max(0, Math.min(width - bw, sx + Math.floor((Math.random() * 2 - 1) * bw * 1.6)));
			const dy = Math.max(0, Math.min(height - bh, sy + Math.floor((Math.random() * 2 - 1) * bh * 1.2)));
			targetCtx.drawImage(canvas, sx, sy, bw, bh, dx, dy, bw, bh);
		}
		return;
	}

	const grain = targetCtx.getImageData(0, 0, width, height);
	const data = grain.data;
	for (let i = 0; i < data.length; i += 4) {
		if (Math.random() < 0.02) {
			const delta = Math.floor((Math.random() * 2 - 1) * 100);
			data[i] = Math.max(0, Math.min(255, data[i] + delta));
			data[i + 1] = Math.max(0, Math.min(255, data[i + 1] - delta));
			data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + Math.floor(delta * 0.5)));
		}
	}
	targetCtx.putImageData(grain, 0, 0);
}

function chaosSaveFrame() {
	if (!activeSource) {
		window.alert("Load a camera feed or photo before saving.");
		return;
	}

	renderCurrentFrame();

	const exportCanvas = document.createElement("canvas");
	exportCanvas.width = canvas.width;
	exportCanvas.height = canvas.height;
	const exportCtx = exportCanvas.getContext("2d");
	exportCtx.drawImage(canvas, 0, 0);
	applyRandomChaosArtifact(exportCtx, exportCanvas.width, exportCanvas.height);

	const link = document.createElement("a");
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	link.download = `digital-nightmare-chaos-${stamp}.png`;
	link.href = exportCanvas.toDataURL("image/png");
	link.click();

	if (activeSource && activeSource !== video) {
		renderCurrentFrame();
	}
}

cameraBtn.addEventListener("click", turnOnCamera);
photoBtn.addEventListener("click", () => photoInput.click());
themeBtn.addEventListener("click", toggleTheme);
mirrorBtn.addEventListener("click", toggleMirrorMode);
freezeBtn.addEventListener("click", toggleFreezeMode);
asciiBtn.addEventListener("click", toggleAsciiMode);
saveBtn.addEventListener("click", chaosSaveFrame);
photoInput.addEventListener("change", handlePhotoSelection);
window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("mousemove", updateRgbOffset);
canvas.addEventListener("mouseleave", resetRgbOffset);
canvas.addEventListener("pointerdown", handleSelectionStart);
canvas.addEventListener("pointermove", handleSelectionMove);
canvas.addEventListener("pointerup", handleSelectionEnd);
canvas.addEventListener("pointercancel", handleSelectionEnd);

resizeCanvas();

