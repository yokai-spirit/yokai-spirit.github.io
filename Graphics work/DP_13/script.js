const box = document.getElementById('drag-element');

let targetX = window.innerWidth / 2;
let targetY = window.innerHeight / 2;
let currentX = targetX;
let currentY = targetY;
let isDragging = false;

// Friction: Lower = Heavier/More lag (0.01 to 0.1)
const friction = 0.07; 

// Update target coordinates
window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    targetX = e.clientX;
    targetY = e.clientY;
  }
});

box.addEventListener('mousedown', () => {
  isDragging = true;
  box.style.cursor = 'grabbing';
  // Optional: Add a visual "lift" effect
  box.style.scale = "1.05";
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  box.style.cursor = 'grab';
  box.style.scale = "1";
});

function animate() {
  // The LERP Physics: 
  // We move a fraction of the distance to the target every frame
  currentX += (targetX - currentX) * friction;
  currentY += (targetY - currentY) * friction;

  // We subtract half the width (75px) and height (30px) 
  // so the mouse stays in the center of the box
  box.style.left = `0px`;
  box.style.top = `0px`;
  box.style.transform = `translate(${currentX - 75}px, ${currentY - 30}px)`;

  requestAnimationFrame(animate);
}

animate();