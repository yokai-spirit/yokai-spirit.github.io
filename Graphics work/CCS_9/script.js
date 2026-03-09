const maxTrails = 50; // max number of particles
const trails = [];

const shapes = ['circle', 'square', 'triangle'];
const colors = ['#ff3', '#3ff', '#f3f', '#0f0', '#0ff', '#f00'];

document.addEventListener('mousemove', (e) => {
  createTrail(e.clientX, e.clientY);
});

function createTrail(x, y) {
  const trail = document.createElement('div');
  const shape = shapes[Math.floor(Math.random() * shapes.length)];
  const color = colors[Math.floor(Math.random() * colors.length)];

  trail.classList.add('trail', shape);

  if (shape === 'triangle') {
    trail.style.borderBottomColor = color;
  } else {
    trail.style.backgroundColor = color;
    trail.style.width = '10px';
    trail.style.height = '10px';
  }

  trail.style.left = x + 'px';
  trail.style.top = y + 'px';
  document.body.appendChild(trail);
  trails.push(trail);

  // Random movement offset
  const offsetX = (Math.random() - 0.5) * 30;
  const offsetY = (Math.random() - 0.5) * 30;

  setTimeout(() => {
    trail.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(0)`;
    trail.style.opacity = 0;
  }, 0);

  setTimeout(() => {
    trail.remove();
    trails.shift();
  }, 800);

  // Limit DOM elements
  if (trails.length > maxTrails) {
    const oldTrail = trails.shift();
    oldTrail.remove();
  }
}