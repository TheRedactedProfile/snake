const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const gameOverElement = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const startScreen = document.getElementById('startScreen');
const gameArea = document.getElementById('gameArea');
const currentDifficultyElement = document.getElementById('currentDifficulty');
const soundToggle = document.getElementById('soundToggle');

let gridSize = 20;
let tileCount;
let snake = [{ x: 10, y: 10, renderX: 10, renderY: 10 }];
let food = {};
let dx = 0;
let dy = 0;
let score = 0;
let highScore = 0;
let gameRunning = false;
let baseGameSpeed = 150;
let currentGameSpeed = 150;
let selectedSpeed = 150;
let soundEnabled = true;
let animationId;
let lastTime = 0;
let accumulator = 0;
let moveProgress = 0;
let isAccelerating = false;
let accelerationMultiplier = 2.5;

let keysPressed = {
    left: false,
    right: false,
    up: false,
    down: false
};

const speedNames = {
    200: 'Fácil',
    150: 'Medio',
    100: 'Difícil',
    50: 'Insano',
};

let audioContext;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(frequency, duration, type = 'sine', volume = 0.3) {
    if (!soundEnabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playEatSound() {
    if (!soundEnabled) return;
    playSound(523, 0.1, 'square', 0.2); 
    setTimeout(() => playSound(659, 0.1, 'square', 0.2), 50); 
    setTimeout(() => playSound(784, 0.1, 'square', 0.2), 100); 
}

function playGameOverSound() {
    if (!soundEnabled) return;
    playSound(523, 0.2, 'sawtooth', 0.3); 
    setTimeout(() => playSound(466, 0.2, 'sawtooth', 0.3), 150); 
    setTimeout(() => playSound(415, 0.2, 'sawtooth', 0.3), 300); 
    setTimeout(() => playSound(349, 0.4, 'sawtooth', 0.3), 450); 
}

function playButtonSound() {
    if (!soundEnabled) return;
    playSound(800, 0.1, 'square', 0.1);
}

function playMoveSound() {
    if (!soundEnabled) return;
    playSound(200, 0.05, 'triangle', 0.05);
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    soundToggle.classList.toggle('muted', !soundEnabled);

    if (soundEnabled) {
        initAudio();
        playButtonSound();
    }
}

function initCanvas() {
    const isMobile = window.innerWidth <= 768;
    const canvasSize = isMobile ? Math.min(window.innerWidth * 0.9, 350) : 400;

    canvas.width = canvasSize;
    canvas.height = canvasSize;
    gridSize = canvasSize / 20; 
    tileCount = 20;
}

function selectSpeed(speed) {
    selectedSpeed = speed;
    baseGameSpeed = speed;
    currentGameSpeed = speed;
    playButtonSound();

    document.querySelectorAll('.speed-option').forEach((option) => {
        option.classList.remove('selected');
        if (parseInt(option.dataset.speed) === speed) {
            option.classList.add('selected');
        }
    });
}

function loadHighScore() {
    const saved = window.gameData?.highScore || 0;
    highScore = saved;
    highScoreElement.textContent = highScore;
}

function saveHighScore() {
    if (!window.gameData) window.gameData = {};
    window.gameData.highScore = highScore;
}

function startGame() {
    initAudio();
    playButtonSound();
    initCanvas();
    startScreen.style.display = 'none';
    gameArea.style.display = 'block';
    loadHighScore();
    resetGame();
    gameRunning = true;
    currentDifficultyElement.textContent = speedNames[selectedSpeed];
    lastTime = performance.now();
    main();
}

function resetGame() {
    snake = [{ x: 10, y: 10, renderX: 10, renderY: 10 }];
    dx = 0;
    dy = 0;
    score = 0;
    moveProgress = 0;
    accumulator = 0;
    scoreElement.textContent = score;
    generateFood();
    gameOverElement.style.display = 'none';
    
    keysPressed = {
        left: false,
        right: false,
        up: false,
        down: false
    };
    isAccelerating = false;
    currentGameSpeed = baseGameSpeed;
}

function generateFood() {
    food = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
    };

    for (let segment of snake) {
        if (Math.floor(segment.x) === food.x && Math.floor(segment.y) === food.y) {
            generateFood();
            return;
        }
    }
}

function smoothStep(t) {
    return t * t * (3 - 2 * t);
}

function easeInOutQuad(t) {
    return smoothStep(t);
}

function getHeadRotation() {
    if (dx === 1 && dy === 0) return 0;
    if (dx === 0 && dy === 1) return Math.PI / 2;
    if (dx === -1 && dy === 0) return Math.PI;
    if (dx === 0 && dy === -1) return -Math.PI / 2;
    return 0;
}

function getTailRotation(tailSegment, beforeTail) {
    if (!beforeTail) return 0;
    
    const tailDx = beforeTail.renderX - tailSegment.renderX;
    const tailDy = beforeTail.renderY - tailSegment.renderY;
    
    if (tailDx > 0.5) return 0;
    if (tailDy > 0.5) return Math.PI / 2;
    if (tailDx < -0.5) return Math.PI;
    if (tailDy < -0.5) return -Math.PI / 2;
    return 0;
}

function drawSnakeHead(segment) {
    const centerX = segment.renderX * gridSize + gridSize / 2;
    const centerY = segment.renderY * gridSize + gridSize / 2;
    const size = gridSize * 0.8;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(getHeadRotation());
    
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
    gradient.addColorStop(0, '#5dd3f0');
    gradient.addColorStop(0.7, '#45b7d1');
    gradient.addColorStop(1, '#3a9bc1');
    ctx.fillStyle = gradient;
    
    ctx.shadowColor = '#45b7d1';
    ctx.shadowBlur = 15;
    
    ctx.beginPath();
    ctx.ellipse(0, 0, size / 2, size / 2.5, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-size / 6, -size / 6, size / 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size / 6, -size / 6, size / 8, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-size / 6, -size / 6, size / 12, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size / 6, -size / 6, size / 12, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, size / 8);
    ctx.lineTo(-size / 12, size / 4);
    ctx.moveTo(0, size / 8);
    ctx.lineTo(size / 12, size / 4);
    ctx.stroke();
    
    ctx.restore();
}

function drawSnakeTail(segment, beforeTail) {
    const centerX = segment.renderX * gridSize + gridSize / 2;
    const centerY = segment.renderY * gridSize + gridSize / 2;
    const size = gridSize * 0.6;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(getTailRotation(segment, beforeTail));
    
    const hue = 180 - (snake.length - 1) * 5;
    const gradient = ctx.createLinearGradient(-size/2, 0, size/2, 0);
    gradient.addColorStop(0, `hsla(${hue}, 70%, 60%, 0.3)`);
    gradient.addColorStop(0.5, `hsla(${hue}, 70%, 60%, 0.7)`);
    gradient.addColorStop(1, `hsla(${hue}, 70%, 60%, 0.9)`);
    ctx.fillStyle = gradient;
    
    ctx.shadowColor = `hsla(${hue}, 70%, 50%, 0.5)`;
    ctx.shadowBlur = 8;
    
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.bezierCurveTo(size / 3, -size / 4, -size / 3, -size / 6, -size / 2, 0);
    ctx.bezierCurveTo(-size / 3, size / 6, size / 3, size / 4, size / 2, 0);
    ctx.fill();
    
    ctx.restore();
}

function drawSnakeBody(segment, i) {
    const opacity = Math.max(0.7, 1 - (i / snake.length) * 0.3);
    const sizeReduction = Math.min(2, i * 0.5);
    
    const hue = 180 - (i * 5);
    ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${opacity})`;
    ctx.shadowBlur = 6;
    ctx.shadowColor = `hsla(${hue}, 70%, 50%, 0.5)`;

    const x = segment.renderX * gridSize + 1 + sizeReduction/2;
    const y = segment.renderY * gridSize + 1 + sizeReduction/2;
    const size = gridSize - 2 - sizeReduction;
    const radius = Math.max(3, 8 - i);

    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.fill();
}

function drawGame() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        
        if (i === 0) {
            drawSnakeHead(segment);
        } else if (i === snake.length - 1 && snake.length > 1) {
            drawSnakeTail(segment, snake[i - 1]);
        } else {
            drawSnakeBody(segment, i);
        }
    }
    
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    const time = performance.now();
    const pulseScale = 1 + Math.sin(time * 0.006) * 0.15;
    const foodSize = (gridSize / 2 - 1) * pulseScale;
    const glowIntensity = 0.5 + Math.sin(time * 0.004) * 0.3;
    
    ctx.shadowColor = '#ff6b6b';
    ctx.shadowBlur = 20 * glowIntensity;
    
    const foodGradient = ctx.createRadialGradient(
        food.x * gridSize + gridSize / 2,
        food.y * gridSize + gridSize / 2,
        0,
        food.x * gridSize + gridSize / 2,
        food.y * gridSize + gridSize / 2,
        foodSize
    );
    foodGradient.addColorStop(0, '#ff8e8e');
    foodGradient.addColorStop(0.7, '#ff6b6b');
    foodGradient.addColorStop(1, '#e55555');
    
    ctx.fillStyle = foodGradient;
    ctx.beginPath();
    ctx.arc(
        food.x * gridSize + gridSize / 2,
        food.y * gridSize + gridSize / 2,
        foodSize,
        0,
        2 * Math.PI
    );
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
}

function updateSnakePositions() {
    if (dx === 0 && dy === 0) return;

    const easedProgress = easeInOutQuad(moveProgress);
    
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        
        if (i === 0) {
            const nextX = segment.x + dx;
            const nextY = segment.y + dy;
            segment.renderX = segment.x + (nextX - segment.x) * easedProgress;
            segment.renderY = segment.y + (nextY - segment.y) * easedProgress;
        } else {
            const prevSegment = snake[i - 1];
            const targetX = prevSegment.x;
            const targetY = prevSegment.y;
            
            segment.renderX = segment.x + (targetX - segment.x) * easedProgress;
            segment.renderY = segment.y + (targetY - segment.y) * easedProgress;
        }
    }
}

function moveSnake() {
    const head = { 
        x: snake[0].x + dx, 
        y: snake[0].y + dy,
        renderX: snake[0].x + dx,
        renderY: snake[0].y + dy
    };
    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 1;
        scoreElement.textContent = score;
        generateFood();
        playEatSound();

        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            saveHighScore();
        }
    } else {
        snake.pop();
    }
    
    moveProgress = 0;
}

function checkCollision() {
    const head = snake[0];

    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        return true;
    }

    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }

    return false;
}

function gameOver() {
    gameRunning = false;
    finalScoreElement.textContent = score;
    playGameOverSound();
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }

    document.querySelectorAll('#gameOver .speed-option').forEach((option) => {
        option.classList.remove('selected');
        if (parseInt(option.dataset.speed) === selectedSpeed) {
            option.classList.add('selected');
        }
    });

    gameOverElement.style.display = 'block';
}

function restartGame() {
    playButtonSound();
    resetGame();
    gameRunning = true;
    baseGameSpeed = selectedSpeed;
    currentGameSpeed = selectedSpeed;
    currentDifficultyElement.textContent = speedNames[selectedSpeed];
    lastTime = performance.now();
    main();
}

function updateAcceleration() {
    const anyKeyPressed = keysPressed.left || keysPressed.right || keysPressed.up || keysPressed.down;
    
    if (anyKeyPressed && !isAccelerating) {
        isAccelerating = true;
        currentGameSpeed = baseGameSpeed / accelerationMultiplier;
    } else if (!anyKeyPressed && isAccelerating) {
        isAccelerating = false;
        currentGameSpeed = baseGameSpeed;
    }
}

function main(currentTime = performance.now()) {
    if (!gameRunning) return;

    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    accumulator += deltaTime;

    updateAcceleration();

    if (dx !== 0 || dy !== 0) {
        moveProgress = Math.min(1, accumulator / currentGameSpeed);
        updateSnakePositions();
    }

    if (accumulator >= currentGameSpeed) {
        if (dx !== 0 || dy !== 0) {
            moveSnake();

            if (checkCollision()) {
                gameOver();
                return;
            }
        }
        accumulator = 0;
    }

    drawGame();

    if (gameRunning) {
        animationId = requestAnimationFrame(main);
    }
}

document.addEventListener('keydown', function(event) {
    const LEFT_KEY = 37;
    const RIGHT_KEY = 39;
    const UP_KEY = 38;
    const DOWN_KEY = 40;

    if ([LEFT_KEY, RIGHT_KEY, UP_KEY, DOWN_KEY].includes(event.keyCode)) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!gameRunning) return;

    const keyPressed = event.keyCode;
    const goingUp = dy === -1;
    const goingDown = dy === 1;
    const goingRight = dx === 1;
    const goingLeft = dx === -1;

    let moved = false;

    if (keyPressed === LEFT_KEY && !goingRight) {
        dx = -1;
        dy = 0;
        keysPressed.left = true;
        moved = true;
    }

    if (keyPressed === UP_KEY && !goingDown) {
        dx = 0;
        dy = -1;
        keysPressed.up = true;
        moved = true;
    }

    if (keyPressed === RIGHT_KEY && !goingLeft) {
        dx = 1;
        dy = 0;
        keysPressed.right = true;
        moved = true;
    }

    if (keyPressed === DOWN_KEY && !goingUp) {
        dx = 0;
        dy = 1;
        keysPressed.down = true;
        moved = true;
    }

    if (moved) {
        playMoveSound();
    }
});

document.addEventListener('keyup', function(event) {
    const LEFT_KEY = 37;
    const RIGHT_KEY = 39;
    const UP_KEY = 38;
    const DOWN_KEY = 40;

    if ([LEFT_KEY, RIGHT_KEY, UP_KEY, DOWN_KEY].includes(event.keyCode)) {
        event.preventDefault();
        event.stopPropagation();
    }

    const keyPressed = event.keyCode;

    if (keyPressed === LEFT_KEY) {
        keysPressed.left = false;
    }
    if (keyPressed === UP_KEY) {
        keysPressed.up = false;
    }
    if (keyPressed === RIGHT_KEY) {
        keysPressed.right = false;
    }
    if (keyPressed === DOWN_KEY) {
        keysPressed.down = false;
    }
});

function changeDirectionMobile(direction) {
    if (!gameRunning) return;

    const goingUp = dy === -1;
    const goingDown = dy === 1;
    const goingRight = dx === 1;
    const goingLeft = dx === -1;

    let moved = false;

    switch (direction) {
        case 'left':
            if (!goingRight) {
                dx = -1;
                dy = 0;
                moved = true;
            }
            break;
        case 'up':
            if (!goingDown) {
                dx = 0;
                dy = -1;
                moved = true;
            }
            break;
        case 'right':
            if (!goingLeft) {
                dx = 1;
                dy = 0;
                moved = true;
            }
            break;
        case 'down':
            if (!goingUp) {
                dx = 0;
                dy = 1;
                moved = true;
            }
            break;
    }

    if (moved) {
        playMoveSound();
    }
}

let mobileKeyPressed = null;
let mobileAcceleration = false;

function startMobileAcceleration(direction) {
    if (!gameRunning) return;
    
    mobileKeyPressed = direction;
    mobileAcceleration = true;
    currentGameSpeed = baseGameSpeed / accelerationMultiplier;
    changeDirectionMobile(direction);
}

function stopMobileAcceleration() {
    mobileKeyPressed = null;
    mobileAcceleration = false;
    currentGameSpeed = baseGameSpeed;
}

document.querySelectorAll('.mobile-btn').forEach(btn => {
    btn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const direction = this.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
        if (direction) {
            startMobileAcceleration(direction);
        }
    });
    
    btn.addEventListener('touchend', function(e) {
        e.preventDefault();
        stopMobileAcceleration();
    });
    
    btn.addEventListener('mousedown', function(e) {
        e.preventDefault();
        const direction = this.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
        if (direction) {
            startMobileAcceleration(direction);
        }
    });
    
    btn.addEventListener('mouseup', function(e) {
        e.preventDefault();
        stopMobileAcceleration();
    });
});

let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

document.addEventListener('touchend', function (e) {
    if (!gameRunning) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    if (Math.abs(deltaX) < 30 && Math.abs(deltaY) < 30) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
            changeDirectionMobile('right');
        } else {
            changeDirectionMobile('left');
        }
    } else {
        if (deltaY > 0) {
            changeDirectionMobile('down');
        } else {
            changeDirectionMobile('up');
        }
    }
});

loadHighScore();
window.addEventListener('resize', function () {
    if (gameRunning) {
        initCanvas();
        drawGame();
    }
});

document.addEventListener('click', function initAudioOnClick() {
    initAudio();
    document.removeEventListener('click', initAudioOnClick);
});