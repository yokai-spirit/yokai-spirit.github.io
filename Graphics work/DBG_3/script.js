document.addEventListener('mousemove', (e) => {
    // Get mouse position
    const x = e.clientX;
    const y = e.clientY;

    // Calculate percentage relative to window size
    const xPercent = Math.round((x / window.innerWidth) * 100);
    const yPercent = Math.round((y / window.innerHeight) * 100);

    // Update the CSS variables on the body
    document.body.style.setProperty('--mouse-x', xPercent + '%');
    document.body.style.setProperty('--mouse-y', yPercent + '%');
});