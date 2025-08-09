const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const socket = io();

let playerId = null;
let players = {};
let assets = {};
let name = "";

const TILE_SIZE = 50;
const CAMERA_THRESHOLD = 250;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 800;

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

function drawBackground(cameraX, yOffset) {
  const bg = assets.background;
  for (let x = -cameraX % bg.width; x < CANVAS_WIDTH; x += bg.width) {
    ctx.drawImage(bg, x, yOffset, bg.width, 400);
  }
}

function drawPlayer(p, yOffset) {
  const img = p.index === 0 ? assets.marioUp : assets.marioDown;
  const screenX = p.x - p.cameraX;
  ctx.drawImage(img, screenX, yOffset + p.y, 50, 50);
  ctx.fillStyle = "white";
  ctx.fillText(p.name, screenX, yOffset + p.y - 10);
}

function animate() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  for (let id in players) {
    const p = players[id];
    const offsetY = p.index === 0 ? 0 : 400;
    drawBackground(p.cameraX, offsetY);
    drawPlayer(p, offsetY);
  }

  requestAnimationFrame(animate);
}
