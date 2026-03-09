let lastX = 0;
let lastDirection = null;
let moveCount = 0;
let lastTime = Date.now();
const shakeSensitivity = 10; // Minimum pixels moved to count as a "move"
const shakeThreshold = 6;    // Number of direction changes to trigger
const resetTime = 300;       // Reset counter if no shake for 300ms
let isCleared = false;

document.addEventListener("mousemove", (e) => {
    if (isCleared) return;

    const currentTime = Date.now();
    const deltaX = e.clientX - lastX;

    // 1. Reset if the user paused too long
    if (currentTime - lastTime > resetTime) {
        moveCount = 0;
    }

    // 2. Check if the movement is significant enough
    if (Math.abs(deltaX) > shakeSensitivity) {
        const currentDirection = deltaX > 0 ? 'right' : 'left';

        // 3. If the direction changed, increment the count
        if (currentDirection !== lastDirection) {
            moveCount++;
            lastDirection = currentDirection;
            lastTime = currentTime;
        }

        // 4. Trigger the fall
        if (moveCount >= shakeThreshold) {
            shakeClear();
        }
    }

    lastX = e.clientX;
});

function shakeClear() {
    isCleared = true; // Prevent re-triggering
    const buttons = document.querySelectorAll(".falling-btn");
    buttons.forEach((btn, index) => {
        // Adding a slight delay to each button for a more "natural" fall
        setTimeout(() => {
            btn.classList.add("fall");
        }, index * 50); 
    });
}
// Example: Setting it to a deep slate blue
document.body.style.backgroundColor = "rgb(14, 218, 139)";
if (buttonsRemaining === 0) {
  document.body.classList.add('game-over-bg');
}