// 1. Generate the useless buttons
const buttonContainer = document.getElementById('button-container');
for (let i = 1; i <= 200; i++) {
    const btn = document.createElement('button');
    btn.innerText = `Button ${i}`;
    buttonContainer.appendChild(btn);
}

// 2. Handle the scaling logic
const scaleUpEl = document.querySelector('.scale-up');
const scaleDownEl = document.querySelector('.scale-down');

window.addEventListener('scroll', () => {
    // Calculate how far we've scrolled (0 to 1)
    const scrollTop = window.scrollY;
    const docHeight = document.body.offsetHeight - window.innerHeight;
    const scrollPercent = scrollTop / docHeight;

    // SCALING UP: Start at 1, grow to 3
    const upScale = 1 + (scrollPercent * 2); 
    
    // SCALING DOWN: Start at 1, shrink to 0.2
    const downScale = 1 - (scrollPercent * 0.8);

    // Apply the transforms
    scaleUpEl.style.transform = `scale(${upScale})`;
    scaleDownEl.style.transform = `scale(${downScale})`;
    
    // Optional: Fade them out as they get smaller/larger
    scaleDownEl.style.opacity = downScale;
});