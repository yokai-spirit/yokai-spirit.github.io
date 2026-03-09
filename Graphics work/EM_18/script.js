const canvas = document.getElementById('eraserCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Fill the canvas with a solid color or overlay
ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // semi-transparent overlay
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Function to erase parts of the canvas
function erase(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

// Event listener for mouse movement
canvas.addEventListener('mousemove', erase);

// Optional: Handle window resize
window.addEventListener('resize', () => {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.putImageData(imageData, 0, 0);
});