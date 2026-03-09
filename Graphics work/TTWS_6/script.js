const btn = document.getElementById('theme-btn');
const body = document.body;
const waveContainer = document.getElementById('wave-container');

// 1. Function to play a synthetic "click" sound
function playClickSound() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine'; // Smooth sound
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // High pitch start
    oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1); // Quick drop

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

// 2. Function to trigger the visual RGB wave
function triggerWave() {
    const wave = document.createElement('div');
    wave.classList.add('wave');
    waveContainer.appendChild(wave);

    // Remove the element after animation ends to keep DOM clean
    setTimeout(() => {
        wave.remove();
    }, 800);
}

// 3. Event Listener
btn.addEventListener('click', () => {
    // Toggle the theme class
    body.classList.toggle('dark-theme');
    
    // Play sound and visual effect
    playClickSound();
    triggerWave();
});