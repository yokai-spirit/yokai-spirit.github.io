const canvas = document.getElementById('splashCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let isPressing = false;
let currentCircle = null;

// Resize canvas to fill window
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// Circle Object Logic
class Splash {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = 2;
        this.growing = true;
    }

    update() {
        if (this.growing) {
            this.radius += 4; // Speed of growth
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// Interaction Listeners
window.addEventListener('mousedown', (e) => {
    isPressing = true;
    const randomColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
    currentCircle = new Splash(e.clientX, e.clientY, randomColor);
});

window.addEventListener('mouseup', () => {
    isPressing = false;
    if (currentCircle) currentCircle.growing = false;
});

// Animation Loop
function animate() {
    // Semi-transparent clear creates a slight "trail" or fade effect
    // Change to ctx.clearRect(0, 0, width, height) for no trails
    ctx.fillStyle = 'rgba(26, 26, 26, 0.15)'; 
    ctx.fillRect(0, 0, width, height);

    if (currentCircle) {
        currentCircle.update();
        currentCircle.draw();
    }

    requestAnimationFrame(animate);
}

animate();