const grid = document.querySelector('#grid');
const scoreDisplay = document.querySelector('#score-val');
const messageDisplay = document.querySelector('#game-message');
const width = 20;

const layout = [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1,
    1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,1,
    1,0,1,1,0,1,0,1,2,2,2,2,1,0,1,0,1,1,0,1,
    1,0,0,0,0,0,0,1,2,1,1,2,1,0,0,0,0,0,0,1,
    1,1,1,1,1,1,0,1,2,1,1,2,1,0,1,1,1,1,1,1,
    1,0,0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0,0,1,
    1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,1,
    1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,
    1,1,0,1,1,1,0,1,1,1,1,1,0,1,1,1,0,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,1,
    1,0,1,1,0,1,0,0,0,0,0,0,0,0,1,0,1,1,0,1,
    1,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,1,
    1,1,1,1,1,1,0,1,2,2,2,2,1,0,1,1,1,1,1,1,
    1,0,0,0,0,0,0,1,2,1,1,2,1,0,0,0,0,0,0,1,
    1,0,1,1,0,1,0,1,2,2,2,2,1,0,1,0,1,1,0,1,
    1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
];

const squares = [];
let score = 0;

function createBoard() {
    layout.forEach((value, i) => {
        const square = document.createElement('div');
        square.classList.add('cell');
        grid.appendChild(square);
        squares.push(square);

        if (value === 1) square.classList.add('wall');
        else if (value === 0) square.classList.add('dot');
        else if (value === 2) square.classList.add('ghost-lair');
    });
}
createBoard();

let pacmanCurrentIndex = 21; 
let currentDirection = 1; 
let nextDirection = 1; 
let animationFrame = 0; 

function movePacman() {
    squares[pacmanCurrentIndex].classList.remove('pacman');
    squares[pacmanCurrentIndex].style.backgroundImage = '';

    if (!squares[pacmanCurrentIndex + nextDirection].classList.contains('wall') &&
        !squares[pacmanCurrentIndex + nextDirection].classList.contains('ghost-lair')) {
        currentDirection = nextDirection;
    }

    if (!squares[pacmanCurrentIndex + currentDirection].classList.contains('wall') &&
        !squares[pacmanCurrentIndex + currentDirection].classList.contains('ghost-lair')) {
        pacmanCurrentIndex += currentDirection;
    }

    // Update Score UI
    if (squares[pacmanCurrentIndex].classList.contains('dot')) {
        squares[pacmanCurrentIndex].classList.remove('dot');
        score++;
        scoreDisplay.innerText = score; // Update UI instead of just variable
        checkWin();
    }

    animationFrame = (animationFrame + 1) % 4; 
    let mouthState = animationFrame === 0 ? 'full' : (animationFrame === 1 || animationFrame === 3 ? 'half' : 'none');

    let dirName = 'right';
    if (currentDirection === -1) dirName = 'left';
    if (currentDirection === width) dirName = 'down';
    if (currentDirection === -width) dirName = 'up';

    let imgPath = mouthState === 'none' ? 'none.png' : `${dirName}_${mouthState}.png`;

    squares[pacmanCurrentIndex].classList.add('pacman');
    squares[pacmanCurrentIndex].style.backgroundImage = `url('${imgPath}')`;

    checkGameOver();
}

document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp':    nextDirection = -width; break;
        case 'ArrowDown':  nextDirection = width; break;
        case 'ArrowLeft':  nextDirection = -1; break;
        case 'ArrowRight': nextDirection = 1; break;
    }
});

const ghosts = [
    { color: 'blue', current: 170, direction: 1 },
    { color: 'red', current: 189, direction: -1 },
    { color: 'orange', current: 210, direction: 1 },
    { color: 'pink', current: 229, direction: -1 },
];

function moveGhosts() {
    const directions = [-1, 1, width, -width];
    ghosts.forEach(g => {
        squares[g.current].classList.remove('ghost');
        squares[g.current].style.backgroundImage = '';

        const isBlocked = squares[g.current + g.direction].classList.contains('wall') || 
                          squares[g.current + g.direction].classList.contains('ghost-lair');

        if (isBlocked) {
            const availableMoves = directions.filter(dir => 
                !squares[g.current + dir].classList.contains('wall') &&
                !squares[g.current + dir].classList.contains('ghost-lair')
            );
            g.direction = availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }

        g.current += g.direction;
        squares[g.current].classList.add('ghost');
        squares[g.current].style.backgroundImage = `url('${g.color}.png')`;
    });
    checkGameOver();
}

function endGame(msg, color) {
    clearInterval(pacmanTimer);
    clearInterval(ghostTimer);
    messageDisplay.innerText = msg;
    messageDisplay.style.color = color;
    // Reload after 3 seconds so they can see the message
    setTimeout(() => location.reload(), 3000);
}

function checkWin() {
    if (!squares.some(square => square.classList.contains('dot'))) {
        endGame("YOU WIN!", "#00FF00");
    }
}

function checkGameOver() {
    if (squares[pacmanCurrentIndex].classList.contains('ghost')) {
        endGame("GAME OVER", "#FF0000");
    }
}

let pacmanTimer = setInterval(movePacman, 200);
let ghostTimer = setInterval(moveGhosts, 300);