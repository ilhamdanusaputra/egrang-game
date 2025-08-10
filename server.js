// server.js (boost consume-on-hold, recharge-on-release)
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let slots = [null, null]; // slot[0] = player atas, slot[1] = player bawah

// Konstanta permainan
const GRAVITY = 1;       // Tarikan ke bawah
const JUMP_FORCE = -10;  // Kecepatan awal saat lompat
const GROUND_Y = 300;    // Posisi tanah

// BOOST
const BOOST_MAX_MS = 5000;    // 10 detik total (ms)
const BOOST_RECHARGE_MS = 7000; // recharge to full in 1 detik (ms)
const BOOST_SPEED = 6;
const NORMAL_SPEED = 3;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", ({ name }) => {
    // Cari slot kosong
    let index = slots.findIndex(s => s === null);
    if (index === -1) index = 0; // fallback kalau penuh

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

      // Boost state
      boostRemaining: BOOST_MAX_MS, // ms
      boostPercent: 100,            // 0 - 100
      isHoldingSpace: false,        // apakah spasi sedang ditekan (server-side)
      recharging: false,
      rechargeStartTime: 0,
      rechargeStartAmount: 0
    };
    slots[index] = socket.id;

    socket.emit("init", { id: socket.id, players });
    io.emit("update", { players });
  });

  socket.on("keydown", (key) => {
    const p = players[socket.id];
    if (!p) return;

    if (key === "ArrowRight") {
      p.vx = p.isSprinting ? BOOST_SPEED : NORMAL_SPEED;
    }
    if (key === "ArrowLeft") {
      p.vx = p.isSprinting ? -BOOST_SPEED : -NORMAL_SPEED;
    }

    if (key === " ") {
      // Hanya mulai mengkonsumsi boost kalau masih ada sisa
      if (p.boostRemaining > 0 && !p.isHoldingSpace) {
        p.isHoldingSpace = true;
        p.isSprinting = true;
        p.recharging = false; // hentikan recharge kalau ada
        // sesuaikan kecepatan saat sudah bergerak
        if (p.vx > 0) p.vx = BOOST_SPEED;
        if (p.vx < 0) p.vx = -BOOST_SPEED;
      }
      // kalau boostRemaining == 0 -> spasi tidak berpengaruh
    }

    if (key === "ArrowUp" && p.isOnGround) {
      p.vy = JUMP_FORCE;
      p.isOnGround = false;
    }
  });

  socket.on("keyup", (key) => {
    const p = players[socket.id];
    if (!p) return;

    if (key === "ArrowRight" || key === "ArrowLeft") p.vx = 0;

    if (key === " ") {
      // Lepas spasi -> stop holding dan mulai recharge (jika belum penuh)
      if (p.isHoldingSpace) p.isHoldingSpace = false;
      // hentikan sprint visual
      p.isSprinting = false;
      if (p.vx > 0) p.vx = NORMAL_SPEED;
      if (p.vx < 0) p.vx = -NORMAL_SPEED;

      // Mulai recharge hanya jika belum penuh
      if (p.boostRemaining < BOOST_MAX_MS) {
        p.recharging = true;
        p.rechargeStartTime = Date.now();
        p.rechargeStartAmount = p.boostRemaining;
      }
    }
  });

  socket.on("disconnect", () => {
    const p = players[socket.id];
    if (p) {
      slots[p.index] = null; // kosongkan slot
      delete players[socket.id];
    }

    // Remap index pemain yang tersisa biar tidak nyangkut
    let i = 0;
    for (let id in players) {
      players[id].index = i;
      slots[i] = id;
      i++;
    }
    for (; i < slots.length; i++) {
      slots[i] = null;
    }

    io.emit("update", { players });
  });
});

// Game loop 60 FPS
const TICK_MS = 1000 / 60;
setInterval(() => {
  const screenThreshold = 250;
  const now = Date.now();

  for (let id in players) {
    const p = players[id];

    // BOOST consumption while holding space
    if (p.isHoldingSpace && p.boostRemaining > 0) {
      p.boostRemaining -= TICK_MS;
      if (p.boostRemaining <= 0) {
        // Habis: pastikan tidak negatif, stop sprint, tapi **jangan** auto-start recharge
        p.boostRemaining = 0;
        p.isHoldingSpace = false;
        p.isSprinting = false;
        if (p.vx > 0) p.vx = NORMAL_SPEED;
        if (p.vx < 0) p.vx = -NORMAL_SPEED;
        // recharge akan mulai pada keyup (ketika client nanti melepas spasi)
      }
    }

    // Recharge logic (hanya ketika recharging true)
    if (p.recharging) {
      const elapsed = now - p.rechargeStartTime;
      const duration = BOOST_RECHARGE_MS;
      // linear increase dari startAmount -> BOOST_MAX_MS dalam 'duration'
      const targetDelta = BOOST_MAX_MS - p.rechargeStartAmount;
      const added = Math.min(targetDelta, (elapsed / duration) * targetDelta);
      p.boostRemaining = p.rechargeStartAmount + added;

      if (p.boostRemaining >= BOOST_MAX_MS) {
        p.boostRemaining = BOOST_MAX_MS;
        p.recharging = false;
      }
    }

    // Update persen untuk dikirim ke client (integer)
    p.boostPercent = Math.round((p.boostRemaining / BOOST_MAX_MS) * 100);

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
      if (!p.isSprinting) {
        if (p.vx > NORMAL_SPEED) p.vx = NORMAL_SPEED;
        if (p.vx < -NORMAL_SPEED) p.vx = -NORMAL_SPEED;
      }
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
}, TICK_MS);

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
