const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const socket = io();
const boostBtn = document.getElementById("boostBtn");

// ================== Kontrol Kiri ==================
leftBtn.addEventListener("mousedown", () => {
  leftPressed = true;
  socket.emit("keydown", "ArrowLeft");
});
leftBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  leftPressed = true;
  socket.emit("keydown", "ArrowLeft");
});

leftBtn.addEventListener("mouseup", () => {
  leftPressed = false;
  socket.emit("keyup", "ArrowLeft");
});
leftBtn.addEventListener("touchend", (e) => {
  e.preventDefault();
  leftPressed = false;
  socket.emit("keyup", "ArrowLeft");
});

// ================== Kontrol Kanan ==================

rightBtn.addEventListener("mousedown", () => {
  rightPressed = true;
  socket.emit("keydown", "ArrowRight");
});
rightBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  rightPressed = true;
  socket.emit("keydown", "ArrowRight");
});

rightBtn.addEventListener("mouseup", () => {
  rightPressed = false;
  socket.emit("keyup", "ArrowRight");
});
rightBtn.addEventListener("touchend", (e) => {
  e.preventDefault();
  rightPressed = false;
  socket.emit("keyup", "ArrowRight");
});


// ================== Lompat ==================
const jumpBtn = document.getElementById("jumpBtn");
jumpBtn.addEventListener("mousedown", () => socket.emit("keydown", "ArrowUp"));
jumpBtn.addEventListener("touchstart", e => { e.preventDefault(); socket.emit("keydown", "ArrowUp"); });
jumpBtn.addEventListener("mouseup", () => socket.emit("keyup", "ArrowUp"));
jumpBtn.addEventListener("touchend", e => { e.preventDefault(); socket.emit("keyup", "ArrowUp"); });

// Tekan / tahan
boostBtn.addEventListener("mousedown", () => {
  socket.emit("keydown", " ");
});
boostBtn.addEventListener("touchstart", (e) => {
  e.preventDefault(); // cegah scroll di HP
  socket.emit("keydown", " ");
});

// Lepas
boostBtn.addEventListener("mouseup", () => {
  socket.emit("keyup", " ");
});
boostBtn.addEventListener("touchend", (e) => {
  e.preventDefault();
  socket.emit("keyup", " ");
});

let playerId = null;
let players = {};
let assets = {};
let name = "";

// Resolusi dasar
const BASE_WIDTH = 800;
const BASE_HEIGHT_HALF = 400; // setengah layar
const TILE_SIZE = 50;

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
    loadImage("c1", "assets/c1.png"),
    loadImage("c2", "assets/c2.png"),
    loadImage("c3", "assets/c3.png"),
    loadImage("c4", "assets/c4.png"),
    loadImage("coin", "assets/coin.png"),
    loadImage("bata", "assets/bata.png"),
    loadImage("background", "assets/background.png"),
    loadImage("nyawa", "assets/nyawa.png"),
    loadImage("stage1", "assets/stage1.png"),
    loadImage("stage2", "assets/stage2.png"),
    loadImage("stage3", "assets/stage3.png"),
    loadImage("boost0", "assets/boost0.png"),
    loadImage("boost25", "assets/boost25.png"),
    loadImage("boost50", "assets/boost50.png"),
    loadImage("boost75", "assets/boost75.png"),
    loadImage("boost100", "assets/boost100.png"),
    loadImage("menang", "assets/menang.png"),
    loadImage("kalah", "assets/kalah.png"),
  ]);
}

const controls = ["boostBtn", "jumpBtn", "leftBtn", "rightBtn", "boostImg"];

controls.forEach(id => {
  document.getElementById(id).style.display = "none";
});

document.getElementById("startBtn").onclick = async () => {
  name = document.getElementById("nameInput").value || "Player";
  localStorage.setItem("playerName", name);
  document.getElementById("menu").style.display = "none";

  // Tampilkan semua tombol kontrol
  controls.forEach(id => {
    document.getElementById(id).style.display = "block";
  });

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

// contoh simple lerp buat smooth camera
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

function drawBackground(cameraX, yOffset) {
  const bg = assets.background;
  const scaledHeight = BASE_HEIGHT_HALF * SCALE;
  const scaledWidth = bg.width * SCALE;

  // buat smoothCameraX agar gak langsung loncat
  if (!drawBackground.smoothCameraX) drawBackground.smoothCameraX = cameraX;

  drawBackground.smoothCameraX = lerp(drawBackground.smoothCameraX, cameraX, 0.1);

  for (let x = (-drawBackground.smoothCameraX * SCALE) % scaledWidth; x < CANVAS_WIDTH; x += scaledWidth) {
    ctx.drawImage(bg, x, yOffset, scaledWidth, scaledHeight);
  }
}

let animCounter = 0; // hitungan frame global

let leftPressed = false;
let rightPressed = false;

// Deteksi input
document.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft") leftPressed = true;
  if (e.code === "ArrowRight") rightPressed = true;
});
document.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft") leftPressed = false;
  if (e.code === "ArrowRight") rightPressed = false;
});

// Animasi player
function drawPlayer(p, yOffset) {
  let img;
  const moving = (p.id === playerId) ? (leftPressed || rightPressed) : p.isMoving;
  const facingLeft = (p.id === playerId) ? leftPressed : p.isFacingLeft; // kalau server kirim facingLeft bisa dipakai juga

  if (moving) {
    const frame = Math.floor(animCounter / 8) % 4;
    img = assets[`c${frame + 1}`];
  } else {
    img = assets.c1;
  }

  const width = 50 * SCALE;
  const height = width * (2 / 1);

  const screenX = (p.x - p.cameraX) * SCALE;
  const screenY = yOffset + (p.y * SCALE);

  ctx.save();

  if (facingLeft) {
    // Mirror horizontal
    ctx.translate(screenX + width / 2, screenY + height / 2);
    ctx.scale(-1, 1);
    ctx.translate(-width / 2, -height / 2);
    ctx.drawImage(img, 0, 0, width, height);
  } else {
    ctx.drawImage(img, screenX, screenY, width, height);
  }

  ctx.restore();
}


function drawLives(p, yOffset) {
  const nyawaImg = assets.nyawa;
  const lifeCount = p.lives || 5; // default 5 kalau belum ada data
  const lifeSize = 20 * SCALE;
  const padding = 8 * SCALE;

  for (let i = 0; i < lifeCount; i++) {
    const x = CANVAS_WIDTH - (lifeSize + padding) * (i + 1);
    const y = yOffset + 10;
    ctx.drawImage(nyawaImg, x, y, lifeSize, lifeSize);
  }
}

function drawStage(p, yOffset) {
  const stageImg = assets[`stage${p.stage || 1}`]; // default stage 1
  const height = 20 * SCALE; // tinggi stage
  const width = height * 6;  // lebar sesuai rasio 6:1
  const padding = 8 * SCALE;
  const x = CANVAS_WIDTH - width - padding;
  const y = yOffset + (5 * SCALE) + (25 * SCALE) + padding; // di bawah nyawa
  ctx.drawImage(stageImg, x, y, width, height);
}

// function drawBoost(p) {
//   const percent = p.boostPercent || 0;
//   let imgKey = "boost0";
//   if (percent > 75) imgKey = "boost100";
//   else if (percent > 50) imgKey = "boost75";
//   else if (percent > 25) imgKey = "boost50";
//   else if (percent > 0) imgKey = "boost25";

//   const img = assets[imgKey];
//   const height = 60 * SCALE;
//   const width = height * (9 / 10);
//   const padding = 18 * SCALE;

//   // 📌 Posisikan di pojok kanan bawah layar
//   const x = CANVAS_WIDTH - width - padding;
//   const y = CANVAS_HEIGHT - height - padding;

//   ctx.drawImage(img, x, y, width, height);
// }

function updateBoostImage(p) {
  if (!p) return;
  const percent = p.boostPercent || 0;
  let imgKey = "boost0";
  if (percent > 75) imgKey = "boost100";
  else if (percent > 50) imgKey = "boost75";
  else if (percent > 25) imgKey = "boost50";
  else if (percent > 0) imgKey = "boost25";

  const boostImg = document.getElementById("boostImg");
  boostImg.src = `assets/${imgKey}.png`;
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

function drawCenteredImage(img) {
  const w = img.width * SCALE;
  const h = img.height * SCALE;
  const x = (CANVAS_WIDTH - w) / 2;
  const y = (CANVAS_HEIGHT - h) / 2;
  ctx.drawImage(img, x, y, w, h);
}

function animate() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const currentPlayer = players[playerId];

  if (currentPlayer) {
    if (currentPlayer.hasWon) {
      if (assets.menang) {
        drawCenteredImage(assets.menang);
        controls.forEach(id => {
          document.getElementById(id).style.display = "none";
        });

      }
      return; // berhenti animasi lain
    }
    if (currentPlayer.hasLost) {
      if (assets.kalah) {
        drawCenteredImage(assets.kalah);
        controls.forEach(id => {
          document.getElementById(id).style.display = "none";
        });
      }
      return; // berhenti animasi lain
    }
  }

  // Kalau belum menang/kalah, cek kondisi global (optional)
  let someoneWon = false;
  let someoneLost = false;

  for (const id in players) {
    if (players[id].hasWon) {
      someoneWon = true;
      break;
    }
  }
  if (!someoneWon) {
    for (const id in players) {
      if (players[id].hasLost) {
        someoneLost = true;
        break;
      }
    }
  }

  if (someoneWon) {
    if (assets.menang) drawCenteredImage(assets.menang);
    return;
  }
  if (someoneLost) {
    if (assets.kalah) drawCenteredImage(assets.kalah);
    return;
  }

  // Render game normal
  for (let id in players) {
    const p = players[id];

    // Jika player ini adalah kita, maka offsetY = 0 (atas)
    // Jika player ini lawan, offsetY = setengah layar (bawah)
    const offsetY = (id === playerId) ? 0 : CANVAS_HEIGHT / 2;

    drawBackground(p.cameraX, offsetY);
    drawPlayerName(p, offsetY);
    drawLives(p, offsetY);
    drawStage(p, offsetY);
    drawPlayer(p, offsetY);
  }

  // Garis pembatas tengah
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT / 2);
  ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
  ctx.stroke();

  // Boost bar khusus pemain sendiri
  if (players[playerId]) {
    updateBoostImage(players[playerId]);
  }

  animCounter++;
  requestAnimationFrame(animate);
}