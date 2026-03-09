const img = document.querySelector('.glitch-img');

img.addEventListener('mouseenter', () => {
  img.classList.add('shake');
});

img.addEventListener('mouseleave', () => {
  img.classList.remove('shake');
});