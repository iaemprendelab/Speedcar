(function () {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  const ROAD_MARGIN = 40;
  const ROAD_LEFT = ROAD_MARGIN;
  const ROAD_RIGHT = W - ROAD_MARGIN;
  const LANE_COUNT = 3;
  const LANE_WIDTH = (ROAD_RIGHT - ROAD_LEFT) / LANE_COUNT;

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const speedEl = document.getElementById("speed");
  const levelEl = document.getElementById("level");
  const startScreen = document.getElementById("start-screen");
  const gameOverScreen = document.getElementById("game-over-screen");
  const finalScoreEl = document.getElementById("finalScore");
  const newBestMsg = document.getElementById("newBestMsg");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const touchLeft = document.getElementById("touch-left");
  const touchRight = document.getElementById("touch-right");

  const BEST_KEY = "speedcar_best_score";

  const LEVELS = [
    { score: 0, speed: 4.2, spawnInterval: 75 },
    { score: 8, speed: 5.4, spawnInterval: 64 },
    { score: 18, speed: 6.6, spawnInterval: 55 },
    { score: 32, speed: 8.0, spawnInterval: 47 },
    { score: 50, speed: 9.4, spawnInterval: 40 },
    { score: 72, speed: 10.8, spawnInterval: 34 },
    { score: 98, speed: 12.2, spawnInterval: 29 },
    { score: 130, speed: 13.6, spawnInterval: 25 },
    { score: 168, speed: 15.0, spawnInterval: 22 },
    { score: 212, speed: 16.4, spawnInterval: 19 },
  ];
  const MAX_SPEED = 18;

  function levelIndexForScore(currentScore) {
    let index = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      if (currentScore >= LEVELS[i].score) index = i;
      else break;
    }
    return index;
  }

  function laneX(lane) {
    return ROAD_LEFT + LANE_WIDTH * lane + LANE_WIDTH / 2;
  }

  function createCar(color) {
    return { width: 42, height: 72, color };
  }

  const player = {
    ...createCar("#ff3b3b"),
    lane: 1,
    x: laneX(1),
    y: H - 110,
    targetX: laneX(1),
  };

  let obstacles = [];
  let particles = [];

  let running = false;
  let gameOver = false;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY)) || 0;
  let speed = LEVELS[0].speed;
  let spawnTimer = 0;
  let spawnInterval = LEVELS[0].spawnInterval;
  let elapsedFrames = 0;
  let shakeTime = 0;
  let levelIndex = 0;
  let levelFlashTime = 0;

  bestEl.textContent = "Mejor: " + best;

  function resetGame() {
    obstacles = [];
    particles = [];
    player.lane = 1;
    player.x = laneX(1);
    player.targetX = laneX(1);
    score = 0;
    speed = LEVELS[0].speed;
    spawnTimer = 0;
    spawnInterval = LEVELS[0].spawnInterval;
    elapsedFrames = 0;
    shakeTime = 0;
    levelIndex = 0;
    levelFlashTime = 0;
    gameOver = false;
  }

  function moveLane(dir) {
    if (!running || gameOver) return;
    const newLane = player.lane + dir;
    if (newLane < 0 || newLane >= LANE_COUNT) return;
    player.lane = newLane;
    player.targetX = laneX(newLane);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      moveLane(-1);
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      moveLane(1);
    } else if (e.key === " " || e.key === "Enter") {
      if (!running) startGame();
      else if (gameOver) startGame();
    }
  });

  function bindTouchZone(el, dir) {
    el.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        moveLane(dir);
      },
      { passive: false }
    );
    el.addEventListener("mousedown", () => moveLane(dir));
  }
  bindTouchZone(touchLeft, -1);
  bindTouchZone(touchRight, 1);

  function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const colors = ["#3ba0ff", "#ffd23f", "#3fff7a", "#c93fff", "#ff9d3f"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    obstacles.push({
      lane,
      x: laneX(lane),
      y: -100,
      width: 42,
      height: 72,
      color,
      passed: false,
    });
  }

  function rectsOverlap(a, b) {
    return (
      Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 6 &&
      Math.abs(a.y - b.y) < (a.height + b.height) / 2 - 6
    );
  }

  function spawnCrashParticles(x, y) {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speedP = 2 + Math.random() * 4;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speedP,
        vy: Math.sin(angle) * speedP,
        life: 30 + Math.random() * 20,
        color: Math.random() > 0.5 ? "#ff3b3b" : "#ffae3b",
      });
    }
    shakeTime = 18;
  }

  function update() {
    if (!running) return;

    elapsedFrames++;

    if (!gameOver) {
      // smooth lane movement
      player.x += (player.targetX - player.x) * 0.22;

      // difficulty ramps in discrete levels based on score
      const newLevelIndex = levelIndexForScore(score);
      if (newLevelIndex > levelIndex) {
        levelIndex = newLevelIndex;
        levelFlashTime = 90;
      }
      const level = LEVELS[levelIndex];
      const beyondLastLevel = levelIndex === LEVELS.length - 1;
      speed = beyondLastLevel
        ? Math.min(level.speed + (score - level.score) * 0.03, MAX_SPEED)
        : level.speed;
      spawnInterval = beyondLastLevel
        ? Math.max(14, level.spawnInterval - (score - level.score) * 0.05)
        : level.spawnInterval;

      // spawn obstacles
      spawnTimer++;
      if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        spawnObstacle();
      }

      // move obstacles
      for (const ob of obstacles) {
        ob.y += speed;
        if (!ob.passed && ob.y > player.y) {
          ob.passed = true;
          score += 1;
        }
      }
      obstacles = obstacles.filter((ob) => ob.y < H + 100);

      // collision check
      const playerBox = { x: player.x, y: player.y, width: player.width, height: player.height };
      for (const ob of obstacles) {
        if (rectsOverlap(playerBox, ob)) {
          triggerGameOver();
          break;
        }
      }
    }

    // particles always update
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 1;
    });
    particles = particles.filter((p) => p.life > 0);

    if (shakeTime > 0) shakeTime--;
    if (levelFlashTime > 0) levelFlashTime--;

    scoreEl.textContent = "Puntos: " + score;
    levelEl.textContent = "Nivel: " + (levelIndex + 1);
    speedEl.textContent = "Velocidad: " + (speed / LEVELS[0].speed).toFixed(1) + "x";
  }

  function triggerGameOver() {
    if (gameOver) return;
    gameOver = true;
    spawnCrashParticles(player.x, player.y);

    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      newBestMsg.classList.remove("hidden");
    } else {
      newBestMsg.classList.add("hidden");
    }

    bestEl.textContent = "Mejor: " + best;

    setTimeout(() => {
      finalScoreEl.textContent = "Puntos: " + score;
      gameOverScreen.classList.remove("hidden");
      running = false;
    }, 550);
  }

  function drawRoad() {
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(0, 0, W, H);

    // grass sides
    ctx.fillStyle = "#1c5e2a";
    ctx.fillRect(0, 0, ROAD_LEFT, H);
    ctx.fillRect(ROAD_RIGHT, 0, W - ROAD_RIGHT, H);

    // road edge lines
    ctx.strokeStyle = "#f5f5f5";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ROAD_LEFT, 0);
    ctx.lineTo(ROAD_LEFT, H);
    ctx.moveTo(ROAD_RIGHT, 0);
    ctx.lineTo(ROAD_RIGHT, H);
    ctx.stroke();

    // lane dashed lines
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 3;
    ctx.setLineDash([28, 24]);
    for (let lane = 1; lane < LANE_COUNT; lane++) {
      const x = ROAD_LEFT + LANE_WIDTH * lane;
      ctx.beginPath();
      const offset = (elapsedFrames * speed) % 52;
      ctx.moveTo(x, -52 + offset);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, car.height / 2 + 4, car.width / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = car.color;
    roundRect(-car.width / 2, -car.height / 2, car.width, car.height, 10);
    ctx.fill();

    // windshield
    ctx.fillStyle = "rgba(200,230,255,0.85)";
    roundRect(-car.width / 2 + 6, -car.height / 2 + 10, car.width - 12, 18, 4);
    ctx.fill();

    // rear window
    ctx.fillStyle = "rgba(200,230,255,0.65)";
    roundRect(-car.width / 2 + 6, car.height / 2 - 22, car.width - 12, 14, 4);
    ctx.fill();

    // headlights / taillights
    ctx.fillStyle = isPlayer ? "#fff9c4" : "#ffdede";
    ctx.fillRect(-car.width / 2 + 3, -car.height / 2 + 2, 6, 5);
    ctx.fillRect(car.width / 2 - 9, -car.height / 2 + 2, 6, 5);

    ctx.fillStyle = "#8b0000";
    ctx.fillRect(-car.width / 2 + 3, car.height / 2 - 7, 6, 5);
    ctx.fillRect(car.width / 2 - 9, car.height / 2 - 7, 6, 5);

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life / 40, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.save();
    if (shakeTime > 0) {
      const dx = (Math.random() - 0.5) * shakeTime;
      const dy = (Math.random() - 0.5) * shakeTime;
      ctx.translate(dx, dy);
    }

    drawRoad();

    for (const ob of obstacles) {
      drawCar(ob, false);
    }

    if (!gameOver || shakeTime > 0) {
      drawCar(player, true);
    }

    drawParticles();

    if (levelFlashTime > 0 && !gameOver) {
      const alpha = Math.min(levelFlashTime / 30, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffd23f";
      ctx.textAlign = "center";
      ctx.font = "bold 36px 'Segoe UI', Arial, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 6;
      ctx.fillText("¡Nivel " + (levelIndex + 1) + "!", W / 2, H / 2 - 200);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  function startGame() {
    resetGame();
    running = true;
    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    newBestMsg.classList.add("hidden");
  }

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  // initial static draw behind start screen
  resetGame();
  draw();
  requestAnimationFrame(loop);
})();
