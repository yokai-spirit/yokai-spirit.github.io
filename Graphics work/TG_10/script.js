const text = "Ghost typing effect...";
const speed = 60;
const element = document.getElementById("typing");

let i = 0;

function typeWriter() {
  if (i < text.length) {
    const span = document.createElement("span");
    span.textContent = text[i];
    span.style.opacity = 0;
    span.style.transition = "opacity 0.3s";
    element.appendChild(span);

    setTimeout(() => span.style.opacity = 1, 10);

    i++;
    setTimeout(typeWriter, speed);
  }
}

typeWriter();