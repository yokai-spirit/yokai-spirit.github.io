const box = document.getElementById('draggable');
const portalBlue = document.getElementById('portalBlue');
const portalOrange = document.getElementById('portalOrange');

let offsetX, offsetY;
let isDragging = false;
let vx = 0;
let vy = 0;

let lastX = 0;
let lastY = 0;
let lastTime = 0;

const friction = 0.9;

// Wrap object around screen edges
function wrapPosition(x, y) {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    if (x > screenWidth) x = -box.offsetWidth;
    if (x < -box.offsetWidth) x = screenWidth;
    if (y > screenHeight) y = -box.offsetHeight;
    if (y < -box.offsetHeight) y = screenHeight;

    return { x, y };
}

// Portal collision
function checkPortalCollision(obj, portal) {
    const objRect = obj.getBoundingClientRect();
    const portalRect = portal.getBoundingClientRect();
    return !(
        objRect.right < portalRect.left ||
        objRect.left > portalRect.right ||
        objRect.bottom < portalRect.top ||
        objRect.top > portalRect.bottom
    );
}

let canTeleport = true;

function teleportIfNeeded() {
    const inBlue = checkPortalCollision(box, portalBlue);
    const inOrange = checkPortalCollision(box, portalOrange);

    if (canTeleport) {
        if (inBlue) {
            teleportTo(portalOrange);
            canTeleport = false;
        } else if (inOrange) {
            teleportTo(portalBlue);
            canTeleport = false;
        }
    }

    if (!inBlue && !inOrange) canTeleport = true;
}

function teleportTo(targetPortal) {
    const exitOffset = 20; 
    const targetY = targetPortal.offsetTop + (targetPortal.offsetHeight / 2) - (box.offsetHeight / 2);
    let targetX = targetPortal.offsetLeft;

    // Teleport to right of portal
    targetX += (targetPortal.offsetWidth + exitOffset);

    box.style.left = targetX + 'px';
    box.style.top = targetY + 'px';
}

// Dragging
box.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - box.offsetLeft;
    offsetY = e.clientY - box.offsetTop;
    lastX = e.clientX;
    lastY = e.clientY;
    lastTime = performance.now();
    box.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) {
        vx = (e.clientX - lastX) / dt * 16;
        vy = (e.clientY - lastY) / dt * 16;
    }

    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;

    const wrapped = wrapPosition(x, y);
    if (wrapped.x !== x) offsetX = e.clientX - wrapped.x;
    if (wrapped.y !== y) offsetY = e.clientY - wrapped.y;

    box.style.left = wrapped.x + 'px';
    box.style.top = wrapped.y + 'px';

    lastX = e.clientX;
    lastY = e.clientY;
    lastTime = now;

    teleportIfNeeded();
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    box.style.cursor = 'grab';
});

// Animation
function animate() {
    if (!isDragging) {
        let x = box.offsetLeft + vx;
        let y = box.offsetTop + vy;

        const wrapped = wrapPosition(x, y);
        box.style.left = wrapped.x + 'px';
        box.style.top = wrapped.y + 'px';

        vx *= friction;
        vy *= friction;

        if (Math.abs(vx) < 0.05) vx = 0;
        if (Math.abs(vy) < 0.05) vy = 0;

        teleportIfNeeded();
    }

    requestAnimationFrame(animate);
}

animate();