const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const socket = io();

let playerId = null;
let players = {};
let assets = {};
let name = "";

// Resolusi dasar
const BASE_WIDTH = 800;
const BASE_HEIGHT_HALF = 400; // setengah layar
const TILE_SIZE = 50;
const CAMERA_THRESHOLD = 250;

let CANVAS_WIDTH = window.innerWidth;
let CANVAS_HEIGHT = window.innerHeight;
let SCALE = 1;

function resizeCanvas() {
  CANVAS_WIDTH = window.innerWidth;
  CANVAS_HEIGHT = window.innerHeight;
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Gunakan scale seragam biar asset tidak melar
  const scaleX = CANVAS_WIDTH / BASE_WIDTH;
  const scaleY = (CANVAS_HEIGHT / 2) / BASE_HEIGHT_HALF;
  SCALE = Math.min(scaleX, scaleY);
}

resizeCanvas();

window.addEventListener("resize", resizeCanvas);

function loadImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      assets[key] = img;
      resolve();
    };
  });
}

async function loadAssets() {
  await Promise.all([
    loadImage("marioUp", "assets/marioUp.png"),
    loadImage("marioDown", "assets/marioDown.png"),
    loadImage("coin", "assets/coin.png"),
    loadImage("block", "assets/block.png"),
    loadImage("background", "assets/background.png"),
  ]);
}

document.getElementById("startBtn").onclick = async () => {
  name = document.getElementById("nameInput").value || "Player";
  localStorage.setItem("playerName", name);
  document.getElementById("menu").style.display = "none";

  await loadAssets();
  socket.emit("join", { name });
  animate();
};

socket.on("init", (data) => {
  playerId = data.id;
  players = data.players;
});

socket.on("update", (data) => {
  players = data.players;
});

document.addEventListener("keydown", (e) => {
  socket.emit("keydown", e.key);
});

document.addEventListener("keyup", (e) => {
  socket.emit("keyup", e.key);
});

function drawBackground(cameraX, yOffset) {
  const bg = assets.background;
  const scaledHeight = BASE_HEIGHT_HALF * SCALE;
  const scaledWidth = bg.width * SCALE;
  for (let x = (-cameraX * SCALE) % scaledWidth; x < CANVAS_WIDTH; x += scaledWidth) {
    ctx.drawImage(bg, x, yOffset, scaledWidth, scaledHeight);
  }
}

function drawBackground(cameraX, yOffset) {
  const bg = assets.background;
  const scaledHeight = BASE_HEIGHT_HALF * SCALE;
  const scaledWidth = bg.width * SCALE;
  for (let x = (-cameraX * SCALE) % scaledWidth; x < CANVAS_WIDTH; x += scaledWidth) {
    ctx.drawImage(bg, x, yOffset, scaledWidth, scaledHeight);
  }
}

function drawPlayer(p, yOffset) {
  const img = p.index === 0 ? assets.marioUp : assets.marioDown;
  const screenX = (p.x - p.cameraX) * SCALE;
  const screenY = yOffset + (p.y * SCALE);
  ctx.drawImage(img, screenX, screenY, 50 * SCALE, 50 * SCALE);
}

function drawPlayerName(p, yOffset) {
  const text = p.name;
  ctx.font = `${20 * SCALE}px Arial`;
  ctx.textAlign = "left";

  // Hitung ukuran kotak background
  const paddingX = 8 * SCALE;
  const paddingY = 5 * SCALE;
  const textWidth = ctx.measureText(text).width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = 24 * SCALE;

  // Gambar kotak semi-transparan
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(10, yOffset + 10, boxWidth, boxHeight);

  // Gambar teks di atas kotak
  ctx.fillStyle = "white";
  ctx.fillText(text, 10 + paddingX, yOffset + 28 * SCALE);
}

function animate() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  for (let id in players) {
    const p = players[id];
    const offsetY = p.index === 0 ? 0 : CANVAS_HEIGHT / 2;

    drawBackground(p.cameraX, offsetY);
    drawPlayerName(p, offsetY);
    drawPlayer(p, offsetY);
  }

  // Garis pemisah tengah
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT / 2);
  ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
  ctx.stroke();

  requestAnimationFrame(animate);
}


