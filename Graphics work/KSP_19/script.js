const frequencies = [
    130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, // Octave 3
    261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, // Octave 4 (Middle C)
    523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77  // Octave 5
];

let audioCtx = null;

function playMinecraftNote() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    
    // Pick a random frequency from the list for variety
    const freq = frequencies[Math.floor(Math.random() * frequencies.length)];

    // 1. THE MAIN BODY (The "Harp/Piano" sound)
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle'; // Triangle gives that hollow, wooden Note Block feel
    osc.frequency.setValueAtTime(freq, now);
    
    // Envelope: Quick attack, fast decay
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.01); 
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // 2. THE "CLICK" (The percussive strike)
    const clickOsc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();

    clickOsc.type = 'square'; // Square adds a bit of "bite"
    clickOsc.frequency.setValueAtTime(freq * 1.5, now); // Higher freq for the hit
    
    clickGain.gain.setValueAtTime(0.1, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    clickOsc.connect(clickGain);
    clickGain.connect(audioCtx.destination);

    // Start and Stop
    osc.start(now);
    osc.stop(now + 0.4);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);
}

document.addEventListener('keydown', (e) => {
    if (e.repeat || ['Shift','Control','Alt','Meta'].includes(e.key)) return;
    playMinecraftNote();
});