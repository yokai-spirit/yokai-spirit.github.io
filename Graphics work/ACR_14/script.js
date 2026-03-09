const buttons = document.querySelectorAll(".chaos-btn");

buttons.forEach(btn => {

    function randomize() {

        // random speed (5–15 seconds)
        let duration = Math.random() * 10 + 5;

        // random direction
        let direction = Math.random() > 0.5 ? "normal" : "reverse";

        // random RGB color
        let r = Math.floor(Math.random() * 256);
        let g = Math.floor(Math.random() * 256);
        let b = Math.floor(Math.random() * 256);

        btn.style.animation = `chaosRotate ${duration}s linear infinite`;
        btn.style.animationDirection = direction;
        btn.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    }

    // run once at start
    randomize();

    // run again when clicked
    btn.addEventListener("click", randomize);

});