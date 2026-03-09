const stickerZone = document.getElementById('sticker-zone');

// Your list of images
const stickerImages = [
    'calm.jpg',
    'cat.png',
    'dog.jpg',
    'guy.png'
];

stickerZone.addEventListener('mousedown', (e) => {
    // 1. Pick a random image
    const randomIndex = Math.floor(Math.random() * stickerImages.length);
    const selectedImg = stickerImages[randomIndex];

    // 2. Create the element
    const img = document.createElement('img');
    img.src = selectedImg;
    img.classList.add('sticker');

    // 3. Random Rotation (between -45 and 45 degrees)
    const randomRotation = Math.floor(Math.random() * 90) - 45;
    
    // 4. Position the sticker
    // We subtract half the typical width (75px) to center it on the cursor
    const x = e.clientX - 75; 
    const y = e.clientY - 75;

    img.style.left = `${x}px`;
    img.style.top = `${y}px`;
    img.style.transform = `rotate(${randomRotation}deg)`;

    // 5. Slap it onto the page
    stickerZone.appendChild(img);
});