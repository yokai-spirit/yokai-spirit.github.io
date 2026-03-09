// 1. Select the button once (use a specific class or tag)
const magneticButton = document.querySelector('.magnetic-button');

// --- Magnetic Hover Logic ---
document.addEventListener('mousemove', (e) => {
  const rect = magneticButton.getBoundingClientRect();
  
  // Find the center of the button
  const buttonX = rect.left + rect.width / 2;
  const buttonY = rect.top + rect.height / 2;

  // Distance between mouse and button center
  const deltaX = e.clientX - buttonX;
  const deltaY = e.clientY - buttonY;

  const distance = Math.sqrt(deltaX**2 + deltaY**2);
  
  // Smooth out the movement with a transition via JS or CSS
  magneticButton.style.transition = 'transform 0.2s ease-out';

  if (distance < 150) {
    const moveX = deltaX * 0.15; 
    const moveY = deltaY * 0.15;
    magneticButton.style.transform = `translate(${moveX}px, ${moveY}px)`;
  } else {
    magneticButton.style.transform = `translate(0px, 0px)`;
  }
});

// --- Background Color Logic ---
const randomValue = () => Math.floor(Math.random() * 256);

magneticButton.addEventListener('click', () => {
  const r = randomValue();
  const g = randomValue();
  const b = randomValue();
  
  const newColor = `rgb(${r}, ${g}, ${b})`;
  document.body.style.backgroundColor = newColor;
  
  console.log(`Background changed to: ${newColor}`);
});