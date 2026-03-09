const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let particles = [];
const colors = ['#ff3c3c', '#ffb13c', '#3cff98', '#3ccfff', '#d33cff', '#ffffff'];

// Resize canvas to fit window
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        // Random size between 2 and 5
        this.size = Math.random() * 3 + 2;
        // Random velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 2;
        this.velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        this.gravity = 0.15;
        this.friction = 0.97; // Slows down over time
        this.opacity = 1;
        this.life = 1; // 100% life
        this.decay = Math.random() * 0.02 + 0.01; // Random fade speed
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        // Add a slight glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.velocity.y += this.gravity;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.opacity -= this.decay;
        this.life -= this.decay;
    }
}

function createExplosion(x, y) {
    const particleCount = 40; 
    for (let i = 0; i < particleCount; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new Particle(x, y, color));
    }
}

function animate() {
    // Semi-transparent clear creates a slight "trail" effect
    ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach((particle, index) => {
        if (particle.opacity > 0) {
            particle.update();
            particle.draw();
        } else {
            // Remove dead particles to save memory
            particles.splice(index, 1);
        }
    });

    requestAnimationFrame(animate);
}

window.addEventListener('click', (e) => {
    createExplosion(e.clientX, e.clientY);
});

// Start animation
animate();