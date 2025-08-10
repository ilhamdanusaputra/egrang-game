const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let playerCount = 0;

const GRAVITY = 1;       // Tarikan ke bawah
const JUMP_FORCE = -10;  // Kecepatan awal saat lompat
const GROUND_Y = 300;    // Posisi tanah

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", ({ name }) => {
    const index = playerCount % 2;
    players[socket.id] = {
      id: socket.id,
      name,
      x: 100,
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      index,
      cameraX: 0,
      isOnGround: true,
      isSprinting: false,
    };
    playerCount++;
    socket.emit("init", { id: socket.id, players });
    io.emit("update", { players });
  });

  socket.on("keydown", (key) => {
    const p = players[socket.id];
    if (!p) return;

    // Jalan normal
    if (key === "ArrowRight") p.vx = p.isSprinting ? 6 : 3;
    if (key === "ArrowLeft") p.vx = p.isSprinting ? -6 : -3;

    // Sprint aktif
    if (key === " ") {
      p.isSprinting = true;
      // Update kecepatan kalau sedang bergerak
      if (p.vx > 0) p.vx = 6;
      if (p.vx < 0) p.vx = -6;
    }

    // Lompat (ArrowUp)
    if (key === "ArrowUp" && p.isOnGround) {
      p.vy = JUMP_FORCE;
      p.isOnGround = false;
    }
  });

  socket.on("keyup", (key) => {
    const p = players[socket.id];
    if (!p) return;

    if (key === "ArrowRight") p.vx = 0;
    if (key === "ArrowLeft") p.vx = 0;

    if (key === " ") {
      p.isSprinting = false;
      // Kembalikan kecepatan normal jika tetap menekan arah
      if (p.vx > 0) p.vx = 3;
      if (p.vx < 0) p.vx = -3;
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    playerCount--;
    if (Object.keys(players).length === 0) {
      console.log("Tidak ada player, memutus semua socket...");
      io.sockets.sockets.forEach((s) => s.disconnect(true));
    } else {
      io.emit("update", { players });
    }
  });
});

// Game loop 60 FPS
setInterval(() => {
  const screenThreshold = 250;

  for (let id in players) {
    const p = players[id];

    // Update posisi horizontal
    p.x += p.vx;
    if (p.x < 0) p.x = 0;

    // Update gravitasi
    p.y += p.vy;
    p.vy += GRAVITY;

    // Cek apakah di tanah
    if (p.y >= GROUND_Y) {
      p.y = GROUND_Y;
      p.vy = 0;
      p.isOnGround = true;
      // Kembalikan kecepatan normal jika tidak menekan arah
      if (p.vx > 3) p.vx = 3;
      if (p.vx < -3) p.vx = -3;
    }

    // Kamera
    const screenX = p.x - p.cameraX;
    if (screenX > screenThreshold) {
      p.cameraX = p.x - screenThreshold;
    } else if (screenX < 100) {
      p.cameraX = p.x - 100;
    }
    if (p.cameraX < 0) p.cameraX = 0;
  }

  io.emit("update", { players });
}, 1000 / 60);
server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
