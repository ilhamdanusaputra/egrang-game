const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const socket = io();
let playerId = null;
let players = {};
let assets = {};
let name = "";

const TILE_SIZE = 50;
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 400;

const loadImage = (key, src) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      assets[key] = img;
      resolve();
    };
  });
};

const initAssets = async () => {
  await Promise.all([
    loadImage("marioUp", "assets/marioUp.png"),
    loadImage("marioDown", "assets/marioDown.png"),
    loadImage("coin", "assets/coin.png"),
    loadImage("block", "assets/block.png"),
    loadImage("background", "assets/background.png"),
  ]);
};

document.getElementById("startBtn").onclick = async () => {
  name = document.getElementById("nameInput").value || "Player";
  localStorage.setItem("playerName", name);
  document.getElementById("menu").style.display = "none";
  await initAssets();
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

function drawPlayer(player, yOffset) {
  const img = player.index === 0 ? assets.marioUp : assets.marioDown;
  ctx.drawImage(img, player.x - player.cameraX, yOffset + player.y, 50, 50);
  ctx.fillStyle = "white";
  ctx.fillText(player.name, player.x - player.cameraX, yOffset + player.y - 10);
}

function drawBackground(yOffset, cameraX) {
  const bg = assets.background;
  for (let x = -cameraX % bg.width; x < canvas.width; x += bg.width) {
    ctx.drawImage(bg, x, yOffset, bg.width, 400);
  }
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let id in players) {
    const p = players[id];
    const screenY = p.index === 0 ? 0 : 400;
    drawBackground(screenY, p.cameraX);
    drawPlayer(p, screenY);
  }
  requestAnimationFrame(animate);
}
