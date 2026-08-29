/**
 * ============================================================================
 * SNAKE LEADER 🐍 - GEOMETRIC BALANCE GAME ENGINE
 * High-performance HTML5 Canvas & Web Audio API Game Engine
 * ============================================================================
 */

// --- Global Constants & Configuration ---
const GRID_SIZE = 20; // 20x20 grid cells
const BASE_SPEEDS = {
  easy: 140,   // ms per tick
  normal: 110,
  hard: 75
};

// --- Game State Variables ---
let canvas, ctx;
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = { x: 5, y: 5, type: 'normal' };
let score = 0;
let highScore = 0;
let currentLevel = 1;
let foodsEatenInLevel = 0;
let gameSpeed = 110;
let gameInterval = null;
let isGameRunning = false;
let isPaused = false;
let isGameOverState = false;
let particles = [];
let floatingTexts = [];
let currentScreen = 'game';

// Settings State
let settings = {
  sound: true,
  music: false,
  theme: 'dark',
  difficulty: 'normal'
};

// Leaderboard Array
let leaderboard = [];

// ============================================================================
// WEB AUDIO API PROCEDURAL SYNTHESIZER
// ============================================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.bgmInterval = null;
    this.bgmStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.2, pitchSlide = null) {
    if (!settings.sound || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (pitchSlide) {
        osc.frequency.exponentialRampToValueAtTime(pitchSlide, this.ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio synthesis note error:', e);
    }
  }

  playFoodSound() {
    if (!settings.sound) return;
    this.init();
    this.playTone(520, 'triangle', 0.07, 0.25, 840);
    setTimeout(() => {
      this.playTone(1040, 'sine', 0.09, 0.2);
    }, 50);
  }

  playLevelUpSound() {
    if (!settings.sound) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.12, 0.25);
      }, i * 65);
    });
  }

  playGameOverSound() {
    if (!settings.sound) return;
    this.init();
    this.playTone(320, 'sawtooth', 0.25, 0.3, 90);
    setTimeout(() => {
      this.playTone(130, 'square', 0.35, 0.25, 45);
    }, 140);
  }

  playHighScoreSound() {
    if (!settings.sound) return;
    this.init();
    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.18, 0.3);
      }, idx * 75);
    });
  }

  playButtonClick() {
    if (!settings.sound) return;
    this.init();
    this.playTone(580, 'triangle', 0.04, 0.12, 420);
  }

  startBGM() {
    this.stopBGM();
    if (!settings.music) return;
    this.init();
    if (!this.ctx) return;

    const bassScale = [130.81, 146.83, 164.81, 174.61, 196.00, 220.00];
    this.bgmStep = 0;

    this.bgmInterval = setInterval(() => {
      if (!settings.music || isPaused || !isGameRunning) return;
      try {
        const note = bassScale[this.bgmStep % bassScale.length];
        this.playTone(note, 'sine', 0.12, 0.04);
        if (this.bgmStep % 4 === 0) {
          this.playTone(note * 2, 'triangle', 0.08, 0.03);
        }
        this.bgmStep++;
      } catch (err) {
        // ignore
      }
    }, 220);
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

const sounds = new SoundEngine();

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load LocalStorage State
  loadSettings();
  loadLeaderboard();
  loadHighScore();

  // 2. Setup Canvas
  canvas = document.getElementById('game-canvas');
  if (canvas) {
    ctx = canvas.getContext('2d');
    setupCanvasResolution();
    window.addEventListener('resize', setupCanvasResolution);
  }

  // 3. Register Event Listeners
  setupEventListeners();

  // 4. Initial Game State & Pre-draw
  resetSnakePosition();
  generateFood();
  updateHUD();
  updateMiniLeaderboard();

  // 5. Start Render Animation Loop
  requestAnimationFrame(renderLoop);
});

/**
 * Configure canvas for sharp rendering across high-DPI (Retina) screens
 */
function setupCanvasResolution() {
  if (!canvas) return;
  const container = canvas.parentElement;
  const size = Math.min(container.clientWidth, 520);
  
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  ctx.scale(dpr, dpr);
  drawGame();
}

// ============================================================================
// SCREEN & VIEW NAVIGATION
// ============================================================================
function showScreen(screenId) {
  currentScreen = screenId;
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('active'));

  const target = document.getElementById(`screen-${screenId}`);
  if (target) {
    target.classList.add('active');
  }

  hideAllModals();

  if (screenId === 'leaderboard') {
    displayLeaderboard();
    sounds.stopBGM();
  } else if (screenId === 'game') {
    updateHUD();
    updateMiniLeaderboard();
  }
}

function showModal(modalId) {
  const modal = document.getElementById(`modal-${modalId}`);
  if (modal) {
    modal.classList.add('active');
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(`modal-${modalId}`);
  if (modal) {
    modal.classList.remove('active');
  }
}

function hideAllModals() {
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(m => m.classList.remove('active'));
}

// ============================================================================
// GAME CORE LOGIC
// ============================================================================

function resetSnakePosition() {
  const startX = 6;
  const startY = 10;
  snake = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY }
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
}

/**
 * Initialize and start a new game session
 */
function startGame() {
  sounds.playButtonClick();
  showScreen('game');

  // Reset Game Variables
  score = 0;
  currentLevel = 1;
  foodsEatenInLevel = 0;
  isPaused = false;
  isGameOverState = false;
  isGameRunning = true;
  particles = [];
  floatingTexts = [];

  gameSpeed = BASE_SPEEDS[settings.difficulty] || 110;
  resetSnakePosition();
  generateFood();
  updateHUD();

  const startLabel = document.getElementById('start-btn-label');
  if (startLabel) startLabel.textContent = 'Restart';

  const pauseIcon = document.getElementById('pause-icon');
  if (pauseIcon) pauseIcon.textContent = '⏸️';

  // Start continuous loop
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(updateGame, gameSpeed);

  if (settings.music) {
    sounds.startBGM();
  }

  showToast('Game Started! Good Luck 🐍');
}

/**
 * Main game tick update loop
 */
function updateGame() {
  if (isPaused || !isGameRunning || isGameOverState) return;

  // 1. Move Snake
  moveSnake();

  // 2. Check Collisions
  if (checkCollision()) {
    gameOver();
    return;
  }

  // 3. Check Food Consumption
  if (snake[0].x === food.x && snake[0].y === food.y) {
    eatFood();
  }
}

function moveSnake() {
  direction = { ...nextDirection };

  const newHead = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };

  snake.unshift(newHead);
  snake.pop();
}

function checkCollision() {
  const head = snake[0];

  // Wall Collision
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    return true;
  }

  // Self Collision
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      return true;
    }
  }

  return false;
}

function generateFood() {
  let valid = false;
  let newFood = { x: 0, y: 0, type: 'normal' };

  while (!valid) {
    newFood.x = Math.floor(Math.random() * GRID_SIZE);
    newFood.y = Math.floor(Math.random() * GRID_SIZE);

    valid = true;
    for (let segment of snake) {
      if (segment.x === newFood.x && segment.y === newFood.y) {
        valid = false;
        break;
      }
    }
  }

  if (currentLevel > 1 && Math.random() < 0.25) {
    newFood.type = 'golden';
  } else {
    newFood.type = 'normal';
  }

  food = newFood;
}

function eatFood() {
  const tail = snake[snake.length - 1];
  snake.push({ ...tail });

  const basePoints = currentLevel * 10;
  const pointsEarned = food.type === 'golden' ? basePoints * 2 : basePoints;
  score += pointsEarned;

  addFloatingText(`+${pointsEarned}`, food.x, food.y, food.type === 'golden' ? '#f59e0b' : '#34d399');
  spawnFoodParticles(food.x, food.y, food.type === 'golden' ? '#f59e0b' : '#10b981');
  sounds.playFoodSound();

  foodsEatenInLevel++;
  if (foodsEatenInLevel >= 4) {
    foodsEatenInLevel = 0;
    currentLevel++;
    sounds.playLevelUpSound();
    showToast(`🌟 LEVEL ${currentLevel}! Speed Increased!`);
    addFloatingText(`LEVEL ${currentLevel}!`, snake[0].x, snake[0].y, '#06b6d4');

    const speedReduction = 6;
    gameSpeed = Math.max(45, gameSpeed - speedReduction);
    clearInterval(gameInterval);
    gameInterval = setInterval(updateGame, gameSpeed);
  }

  if (score > highScore) {
    highScore = score;
    saveHighScore(highScore);
  }

  generateFood();
  updateHUD();
}

function gameOver() {
  isGameOverState = true;
  isGameRunning = false;
  clearInterval(gameInterval);
  sounds.stopBGM();
  sounds.playGameOverSound();

  if (snake.length > 0) {
    spawnDeathParticles(snake[0].x, snake[0].y);
  }

  const isNewHighScore = score > 0 && score >= highScore;
  if (isNewHighScore) {
    sounds.playHighScoreSound();
  }

  const scoreFormatted = String(score).padStart(5, '0');
  const levelFormatted = String(currentLevel).padStart(2, '0');
  const highFormatted = String(highScore).padStart(5, '0');

  const goScore = document.getElementById('gameover-score');
  const goLevel = document.getElementById('gameover-level');
  const goHigh = document.getElementById('gameover-high');

  if (goScore) goScore.textContent = scoreFormatted;
  if (goLevel) goLevel.textContent = levelFormatted;
  if (goHigh) goHigh.textContent = highFormatted;

  const newHighBadge = document.getElementById('new-highscore-badge');
  if (newHighBadge) {
    if (isNewHighScore) newHighBadge.classList.add('visible');
    else newHighBadge.classList.remove('visible');
  }

  const nameInput = document.getElementById('player-name-input');
  if (nameInput) {
    nameInput.value = localStorage.getItem('snakeLastPlayer') || '';
  }

  const startLabel = document.getElementById('start-btn-label');
  if (startLabel) startLabel.textContent = 'Play Again';

  setTimeout(() => {
    showModal('game-over');
  }, 450);
}

function restartGame() {
  sounds.playButtonClick();
  hideAllModals();
  startGame();
}

function pauseGame() {
  if (!isGameRunning || isGameOverState || isPaused) return;
  sounds.playButtonClick();
  isPaused = true;
  sounds.stopBGM();
  const pauseIcon = document.getElementById('pause-icon');
  if (pauseIcon) pauseIcon.textContent = '▶️';
  showModal('pause');
}

function resumeGame() {
  if (!isGameRunning || !isPaused) return;
  sounds.playButtonClick();
  isPaused = false;
  const pauseIcon = document.getElementById('pause-icon');
  if (pauseIcon) pauseIcon.textContent = '⏸️';
  hideModal('pause');
  if (settings.music) {
    sounds.startBGM();
  }
}

// ============================================================================
// CANVAS RENDERING ENGINE (GEOMETRIC AESTHETICS)
// ============================================================================

function renderLoop() {
  if (currentScreen === 'game') {
    drawGame();
  }
  requestAnimationFrame(renderLoop);
}

function drawGame() {
  if (!canvas || !ctx) return;

  const size = canvas.width / (window.devicePixelRatio || 1);
  const cellSize = size / GRID_SIZE;
  const isDark = settings.theme === 'dark';

  // Crisp Geometric Background
  ctx.fillStyle = isDark ? '#090d16' : '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Subtle Geometric Grid Lines
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.04)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * cellSize;
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
  }
  ctx.stroke();

  drawFood(cellSize);
  drawSnake(cellSize, isDark);
  updateAndDrawParticles(ctx);
  updateAndDrawFloatingTexts(ctx, cellSize);
}

function drawFood(cellSize) {
  if (!food) return;

  const centerX = (food.x + 0.5) * cellSize;
  const centerY = (food.y + 0.5) * cellSize;
  const time = Date.now() * 0.006;
  const pulse = Math.sin(time) * 1.5;
  const radius = (cellSize / 2.4) + pulse;

  ctx.save();

  if (food.type === 'golden') {
    ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
    ctx.shadowBlur = 12;

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.shadowColor = 'rgba(244, 63, 94, 0.7)';
    ctx.shadowBlur = 10;

    const grad = ctx.createRadialGradient(centerX - 2, centerY - 2, 2, centerX, centerY, radius);
    grad.addColorStop(0, '#fb7185');
    grad.addColorStop(1, '#f43f5e');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.ellipse(centerX + radius * 0.35, centerY - radius * 0.75, radius * 0.3, radius * 0.16, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSnake(cellSize, isDark) {
  if (!snake || snake.length === 0) return;

  const segmentRadius = cellSize * 0.42;

  // Body Segments
  for (let i = snake.length - 1; i > 0; i--) {
    const seg = snake[i];
    const prevSeg = snake[i - 1];
    const centerX = (seg.x + 0.5) * cellSize;
    const centerY = (seg.y + 0.5) * cellSize;

    const progress = i / snake.length;
    const gVal = Math.floor(185 - progress * 35);
    const bVal = Math.floor(129 + progress * 75);

    ctx.save();
    ctx.fillStyle = `rgb(16, ${gVal}, ${bVal})`;

    if (isDark) {
      ctx.shadowColor = 'rgba(16, 185, 129, 0.3)';
      ctx.shadowBlur = 6;
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, segmentRadius * (1 - progress * 0.12), 0, Math.PI * 2);
    ctx.fill();

    if (prevSeg) {
      const prevX = (prevSeg.x + 0.5) * cellSize;
      const prevY = (prevSeg.y + 0.5) * cellSize;
      ctx.lineWidth = (segmentRadius * 2) * (1 - progress * 0.12);
      ctx.strokeStyle = `rgb(16, ${gVal}, ${bVal})`;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(prevX, prevY);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Head
  const head = snake[0];
  const headX = (head.x + 0.5) * cellSize;
  const headY = (head.y + 0.5) * cellSize;

  ctx.save();

  if (isDark) {
    ctx.shadowColor = 'rgba(16, 185, 129, 0.85)';
    ctx.shadowBlur = 14;
  }

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(headX, headY, cellSize * 0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  let angle = 0;
  if (direction.x === 1) angle = 0;
  else if (direction.x === -1) angle = Math.PI;
  else if (direction.y === 1) angle = Math.PI / 2;
  else if (direction.y === -1) angle = -Math.PI / 2;

  // Flickering Tongue
  const time = Date.now() * 0.008;
  const tongueLength = (cellSize * 0.4) + Math.sin(time * 2) * (cellSize * 0.15);
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const tx = headX + Math.cos(angle) * (cellSize * 0.45);
  const ty = headY + Math.sin(angle) * (cellSize * 0.45);
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + Math.cos(angle) * tongueLength, ty + Math.sin(angle) * tongueLength);
  ctx.stroke();

  // Expressive Eyes
  const eyeOffset = cellSize * 0.22;
  const eyeForward = cellSize * 0.18;
  const eyeRadius = cellSize * 0.13;
  const pupilRadius = cellSize * 0.07;

  const leftEyeX = headX + Math.cos(angle) * eyeForward - Math.sin(angle) * eyeOffset;
  const leftEyeY = headY + Math.sin(angle) * eyeForward + Math.cos(angle) * eyeOffset;

  const rightEyeX = headX + Math.cos(angle) * eyeForward + Math.sin(angle) * eyeOffset;
  const rightEyeY = headY + Math.sin(angle) * eyeForward - Math.cos(angle) * eyeOffset;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2);
  ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  const pupilXOffset = Math.cos(angle) * (eyeRadius * 0.4);
  const pupilYOffset = Math.sin(angle) * (eyeRadius * 0.4);

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(leftEyeX + pupilXOffset, leftEyeY + pupilYOffset, pupilRadius, 0, Math.PI * 2);
  ctx.arc(rightEyeX + pupilXOffset, rightEyeY + pupilYOffset, pupilRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// PARTICLE & FLOATING EFFECTS
// ============================================================================

function spawnFoodParticles(gridX, gridY, color) {
  const cellSize = canvas.width / (window.devicePixelRatio || 1) / GRID_SIZE;
  const px = (gridX + 0.5) * cellSize;
  const py = (gridY + 0.5) * cellSize;

  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    particles.push({
      x: px,
      y: py,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2.5 + Math.random() * 3,
      alpha: 1,
      decay: 0.03 + Math.random() * 0.03,
      color: color
    });
  }
}

function spawnDeathParticles(gridX, gridY) {
  const cellSize = canvas.width / (window.devicePixelRatio || 1) / GRID_SIZE;
  const px = (gridX + 0.5) * cellSize;
  const py = (gridY + 0.5) * cellSize;

  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x: px,
      y: py,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 4,
      alpha: 1,
      decay: 0.02 + Math.random() * 0.02,
      color: Math.random() > 0.5 ? '#f43f5e' : '#10b981'
    });
  }
}

function updateAndDrawParticles(ctx) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.decay;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function addFloatingText(text, gridX, gridY, color = '#10b981') {
  const cellSize = canvas.width / (window.devicePixelRatio || 1) / GRID_SIZE;
  floatingTexts.push({
    text: text,
    x: (gridX + 0.5) * cellSize,
    y: (gridY + 0.5) * cellSize,
    vy: -1.2,
    alpha: 1,
    color: color
  });
}

function updateAndDrawFloatingTexts(ctx) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.alpha -= 0.025;

    if (ft.alpha <= 0) {
      floatingTexts.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = ft.alpha;
    ctx.font = 'bold 14px Outfit, Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

function showToast(msg) {
  const toast = document.getElementById('canvas-toast');
  if (toast) {
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2000);
  }
}

// ============================================================================
// HUD & SCOREBOARD FORMATTING
// ============================================================================

function updateHUD() {
  const scoreElem = document.getElementById('hud-score');
  const levelElem = document.getElementById('hud-level');
  const highElem = document.getElementById('hud-high');
  const speedElem = document.getElementById('hud-speed');

  const formattedScore = String(score).padStart(5, '0');
  const formattedHigh = String(highScore).padStart(5, '0');
  const formattedLevel = String(currentLevel).padStart(2, '0');

  if (scoreElem) scoreElem.textContent = formattedScore;
  if (levelElem) levelElem.textContent = formattedLevel;
  if (highElem) highElem.textContent = formattedHigh;
  if (speedElem) speedElem.textContent = `${Math.round(1000 / gameSpeed)} FPS`;
}

function updateMiniLeaderboard() {
  const container = document.getElementById('mini-leaderboard-list');
  if (!container) return;

  container.innerHTML = '';
  const topList = leaderboard.slice(0, 5);

  if (topList.length === 0) {
    container.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-dim); text-align: center; padding: 1rem 0;">No scores yet</div>';
    return;
  }

  topList.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = `mini-lead-row ${idx === 0 ? 'top-rank' : ''}`;
    const rankStr = String(idx + 1).padStart(2, '0');
    const scoreStr = String(entry.score).padStart(4, '0');
    row.innerHTML = `
      <span class="mini-rank-name">${rankStr} ${escapeHTML(entry.name)}</span>
      <span class="mini-rank-score">${scoreStr}</span>
    `;
    container.appendChild(row);
  });
}

// ============================================================================
// CONTROLS & INPUT HANDLERS
// ============================================================================

function setupEventListeners() {
  window.addEventListener('keydown', handleKeyDown);

  // D-Pad handlers
  const dpadUp = document.getElementById('dpad-up');
  const dpadDown = document.getElementById('dpad-down');
  const dpadLeft = document.getElementById('dpad-left');
  const dpadRight = document.getElementById('dpad-right');

  const addDpadListener = (btn, x, y, keyHintId) => {
    if (!btn) return;
    const triggerDir = (e) => {
      e.preventDefault();
      sounds.init();
      changeDirection(x, y);
      btn.classList.add('pressed');
      highlightKeyHint(keyHintId);
      if (navigator.vibrate) navigator.vibrate(12);
      setTimeout(() => btn.classList.remove('pressed'), 120);
    };
    btn.addEventListener('pointerdown', triggerDir);
  };

  addDpadListener(dpadUp, 0, -1, 'key-hint-w');
  addDpadListener(dpadDown, 0, 1, 'key-hint-s');
  addDpadListener(dpadLeft, -1, 0, 'key-hint-a');
  addDpadListener(dpadRight, 1, 0, 'key-hint-d');

  setupSwipeControls();

  // Header & Brand Navigation
  bindButton('brand-home-btn', () => {
    sounds.playButtonClick();
    showScreen('game');
  });

  bindButton('btn-header-menu', () => {
    sounds.playButtonClick();
    if (isGameRunning && !isPaused) {
      pauseGame();
    } else {
      showScreen('how-to-play');
    }
  });

  bindButton('btn-theme-toggle', () => toggleTheme());

  // Game Arena Controls
  bindButton('btn-start-game', () => {
    if (isGameRunning) {
      restartGame();
    } else {
      startGame();
    }
  });

  bindButton('btn-hud-pause', () => {
    if (!isGameRunning) {
      startGame();
    } else {
      isPaused ? resumeGame() : pauseGame();
    }
  });

  bindButton('btn-hud-restart', () => restartGame());

  // Sidebars
  bindButton('btn-sidebar-view-leaderboard', () => {
    sounds.playButtonClick();
    showScreen('leaderboard');
  });

  bindButton('btn-toggle-mobile-dpad', () => {
    sounds.playButtonClick();
    const dpad = document.getElementById('mobile-controls');
    if (dpad) {
      dpad.style.display = dpad.style.display === 'flex' ? 'none' : 'flex';
    }
  });

  // Modal actions
  bindButton('btn-pause-resume', () => resumeGame());
  bindButton('btn-pause-restart', () => restartGame());
  bindButton('btn-pause-exit', () => {
    sounds.playButtonClick();
    hideAllModals();
    isPaused = false;
  });

  bindButton('btn-save-score', () => saveScore());
  bindButton('btn-gameover-restart', () => restartGame());
  bindButton('btn-gameover-leaderboard', () => {
    sounds.playButtonClick();
    hideAllModals();
    showScreen('leaderboard');
  });

  bindButton('btn-leaderboard-play', () => startGame());
  bindButton('btn-leaderboard-home', () => {
    sounds.playButtonClick();
    showScreen('game');
  });

  bindButton('btn-clear-leaderboard', () => {
    sounds.playButtonClick();
    showModal('confirm-clear');
  });
  bindButton('btn-confirm-clear-yes', () => clearLeaderboard());
  bindButton('btn-confirm-clear-cancel', () => {
    sounds.playButtonClick();
    hideModal('confirm-clear');
  });

  bindButton('btn-howtoplay-start', () => startGame());
  bindButton('btn-howtoplay-home', () => {
    sounds.playButtonClick();
    showScreen('game');
  });

  bindButton('btn-settings-home', () => {
    sounds.playButtonClick();
    showScreen('game');
  });

  bindButton('btn-settings-reset', () => resetSettings());

  // Quick Toggles
  const soundToggle = document.getElementById('setting-sound-toggle');
  if (soundToggle) {
    soundToggle.addEventListener('change', (e) => {
      settings.sound = e.target.checked;
      saveSettings();
    });
  }

  const musicToggle = document.getElementById('setting-music-toggle');
  if (musicToggle) {
    musicToggle.addEventListener('change', (e) => {
      settings.music = e.target.checked;
      saveSettings();
      if (settings.music && isGameRunning && !isPaused) {
        sounds.startBGM();
      } else {
        sounds.stopBGM();
      }
    });
  }

  const speedButtons = document.querySelectorAll('.segment-btn');
  speedButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      sounds.playButtonClick();
      const speed = e.target.dataset.speed;
      settings.difficulty = speed;
      saveSettings();
      updateSettingsUI();
    });
  });
}

function bindButton(id, handler) {
  const elem = document.getElementById(id);
  if (elem) {
    elem.addEventListener('click', (e) => {
      e.preventDefault();
      sounds.init();
      handler();
    });
  }
}

function highlightKeyHint(keyId) {
  const keyElem = document.getElementById(keyId);
  if (keyElem) {
    keyElem.classList.add('active');
    setTimeout(() => keyElem.classList.remove('active'), 120);
  }
}

function handleKeyDown(e) {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') {
    if (e.key === 'Enter') saveScore();
    return;
  }

  sounds.init();

  switch (e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      e.preventDefault();
      changeDirection(0, -1);
      highlightKeyHint('key-hint-w');
      break;

    case 'ArrowDown':
    case 's':
    case 'S':
      e.preventDefault();
      changeDirection(0, 1);
      highlightKeyHint('key-hint-s');
      break;

    case 'ArrowLeft':
    case 'a':
    case 'A':
      e.preventDefault();
      changeDirection(-1, 0);
      highlightKeyHint('key-hint-a');
      break;

    case 'ArrowRight':
    case 'd':
    case 'D':
      e.preventDefault();
      changeDirection(1, 0);
      highlightKeyHint('key-hint-d');
      break;

    case 'p':
    case 'P':
    case ' ':
      e.preventDefault();
      if (isGameRunning) {
        isPaused ? resumeGame() : pauseGame();
      } else {
        startGame();
      }
      break;

    case 'Escape':
      if (isPaused) resumeGame();
      break;
  }
}

function changeDirection(x, y) {
  if (!isGameRunning || isPaused) return;

  const isOpposite = (x !== 0 && x === -direction.x) || (y !== 0 && y === -direction.y);
  if (isOpposite) return;

  nextDirection = { x, y };
}

function setupSwipeControls() {
  const target = document.getElementById('canvas-wrapper') || canvas;
  if (!target) return;

  let touchStartX = 0;
  let touchStartY = 0;

  target.addEventListener('touchstart', (e) => {
    const touch = e.changedTouches[0];
    touchStartX = touch.pageX;
    touchStartY = touch.pageY;
  }, { passive: true });

  target.addEventListener('touchend', (e) => {
    const touch = e.changedTouches[0];
    const dx = touch.pageX - touchStartX;
    const dy = touch.pageY - touchStartY;
    const minSwipeDist = 25;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > minSwipeDist) {
        if (dx > 0) { changeDirection(1, 0); highlightKeyHint('key-hint-d'); }
        else { changeDirection(-1, 0); highlightKeyHint('key-hint-a'); }
      }
    } else {
      if (Math.abs(dy) > minSwipeDist) {
        if (dy > 0) { changeDirection(0, 1); highlightKeyHint('key-hint-s'); }
        else { changeDirection(0, -1); highlightKeyHint('key-hint-w'); }
      }
    }
  }, { passive: true });
}

// ============================================================================
// LEADERBOARD & STORAGE
// ============================================================================

function loadLeaderboard() {
  try {
    const saved = localStorage.getItem('snakeLeaderboard');
    if (saved) {
      leaderboard = JSON.parse(saved);
      if (!Array.isArray(leaderboard)) leaderboard = [];
    } else {
      leaderboard = [
        { name: 'PRANETH', score: 850, level: 8, date: '2026-08-20' },
        { name: 'PLAYER_X', score: 720, level: 7, date: '2026-08-22' },
        { name: 'SNAKE_KING', score: 650, level: 6, date: '2026-08-25' },
        { name: 'GAMER_1', score: 520, level: 5, date: '2026-08-26' },
        { name: 'NEON_PULSE', score: 430, level: 4, date: '2026-08-27' }
      ];
      localStorage.setItem('snakeLeaderboard', JSON.stringify(leaderboard));
    }
  } catch (e) {
    leaderboard = [];
  }
}

function saveScore() {
  sounds.playButtonClick();
  const input = document.getElementById('player-name-input');
  let name = input ? input.value.trim().toUpperCase() : 'PLAYER';
  if (!name) name = 'ANONYMOUS';

  localStorage.setItem('snakeLastPlayer', name);

  const newEntry = {
    name: name.substring(0, 14),
    score: score,
    level: currentLevel,
    date: new Date().toISOString().split('T')[0]
  };

  leaderboard.push(newEntry);
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 10);

  try {
    localStorage.setItem('snakeLeaderboard', JSON.stringify(leaderboard));
  } catch (e) {
    console.error('Failed to save leaderboard:', e);
  }

  updateMiniLeaderboard();
  hideAllModals();
  showScreen('leaderboard');
}

function displayLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  container.innerHTML = '';

  if (!leaderboard || leaderboard.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem; opacity: 0.7;">🏆</div>
        <p style="font-weight: 700;">No scores recorded yet.</p>
        <p style="font-size: 0.8rem; margin-top: 0.25rem;">Play a game and claim the #1 rank!</p>
      </div>
    `;
    return;
  }

  leaderboard.forEach((entry, idx) => {
    const rank = idx + 1;
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank).padStart(2, '0');

    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    item.innerHTML = `
      <div class="item-left">
        <div class="rank-badge ${rankClass}">${rankIcon}</div>
        <div class="player-details">
          <span class="player-name">${escapeHTML(entry.name)}</span>
          <span class="player-meta">Level ${entry.level || 1} • ${entry.date || 'Recent'}</span>
        </div>
      </div>
      <div class="item-right" style="text-align: right;">
        <div class="player-score">${String(entry.score).padStart(4, '0')}</div>
        <div class="player-level-badge">PTS</div>
      </div>
    `;
    container.appendChild(item);
  });
}

function clearLeaderboard() {
  sounds.playButtonClick();
  leaderboard = [];
  try {
    localStorage.removeItem('snakeLeaderboard');
  } catch (e) {
    console.error(e);
  }
  hideModal('confirm-clear');
  displayLeaderboard();
  updateMiniLeaderboard();
  showToast('Leaderboard Cleared');
}

function loadHighScore() {
  try {
    const saved = localStorage.getItem('snakeHighScore');
    highScore = saved ? parseInt(saved, 10) || 0 : 0;
    if (leaderboard.length > 0 && leaderboard[0].score > highScore) {
      highScore = leaderboard[0].score;
    }
  } catch (e) {
    highScore = 0;
  }
  updateHUD();
}

function saveHighScore(val) {
  try {
    localStorage.setItem('snakeHighScore', val.toString());
  } catch (e) {
    console.error(e);
  }
  updateHUD();
}

// ============================================================================
// SETTINGS & THEMES
// ============================================================================

function loadSettings() {
  try {
    const saved = localStorage.getItem('snakeSettings');
    if (saved) {
      settings = { ...settings, ...JSON.parse(saved) };
    }
    const savedTheme = localStorage.getItem('snakeTheme');
    if (savedTheme) {
      settings.theme = savedTheme;
    }
  } catch (e) {
    console.warn('Settings load error:', e);
  }

  applyTheme(settings.theme);
}

function saveSettings() {
  try {
    localStorage.setItem('snakeSettings', JSON.stringify(settings));
    localStorage.setItem('snakeTheme', settings.theme);
  } catch (e) {
    console.error(e);
  }
}

function resetSettings() {
  sounds.playButtonClick();
  settings = {
    sound: true,
    music: false,
    theme: 'dark',
    difficulty: 'normal'
  };
  saveSettings();
  applyTheme(settings.theme);
  updateSettingsUI();
  showToast('Settings Reset to Default');
}

function updateSettingsUI() {
  const soundToggle = document.getElementById('setting-sound-toggle');
  const musicToggle = document.getElementById('setting-music-toggle');

  if (soundToggle) soundToggle.checked = settings.sound;
  if (musicToggle) musicToggle.checked = settings.music;

  const speedButtons = document.querySelectorAll('.segment-btn');
  speedButtons.forEach(btn => {
    if (btn.dataset.speed === settings.difficulty) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function applyTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    themeIcon.textContent = themeName === 'dark' ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  sounds.playButtonClick();
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme(settings.theme);
  saveSettings();
}

function escapeHTML(str) {
  const p = document.createElement('p');
  p.appendChild(document.createTextNode(str || ''));
  return p.innerHTML;
}
