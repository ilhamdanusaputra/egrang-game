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
const GRAVITY = 0.5;       // Tarikan ke bawah
const JUMP_FORCE = -10;  // Kecepatan awal saat lompat
const GROUND_Y = 300;    // Posisi tanah

// BOOST
const BOOST_MAX_MS = 5000;    // 10 detik total (ms)
const BOOST_RECHARGE_MS = 7000; // recharge to full in 1 detik (ms)
const BOOST_SPEED = 6;
const NORMAL_SPEED = 3;

const STAGE_DISTANCE = 5000;
const MAX_STAGE = 3;

const OBSTACLE_WIDTH = 20;
const OBSTACLE_HEIGHT = 20;
const OBSTACLE_AREA_LENGTH = 15000;

let obstacles = [];

// Buat obstacle acak sepanjang 15000 px
function generateObstacles() {
  obstacles = [];
  // Misal buat 30 obstacle acak sepanjang 15000 px
  const count = 30;

  for (let i = 0; i < count; i++) {
    const x = Math.random() * (OBSTACLE_AREA_LENGTH - OBSTACLE_WIDTH);
    const y = GROUND_Y; // posisi kaki obstacle
    obstacles.push({ x, y, width: OBSTACLE_WIDTH, height: OBSTACLE_HEIGHT });
  }
}


io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", ({ name }) => {
    generateObstacles();

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
      lives: 5,         // misal default 5 nyawa
      hasLost: false,
      hasWon: false,
      stage: 1,
      // Boost state
      boostRemaining: BOOST_MAX_MS, // ms
      boostPercent: 100,            // 0 - 100
      isHoldingSpace: false,        // apakah spasi sedang ditekan (server-side)
      recharging: false,
      rechargeStartTime: 0,
      rechargeStartAmount: 0
    };
    slots[index] = socket.id;

    // Kirim data awal termasuk obstacle ke client
    socket.emit("init", { id: socket.id, players, obstacles });
    io.emit("update", { players, obstacles });
  });

  socket.on("keydown", (key) => {
    const p = players[socket.id];
    if (!p) return;

    if (key === "ArrowRight") {
      p.vx = p.isSprinting ? BOOST_SPEED : NORMAL_SPEED;
      p.isMoving = true;
      p.isFacingLeft = false;
    }
    if (key === "ArrowLeft") {
      p.vx = p.isSprinting ? -BOOST_SPEED : -NORMAL_SPEED;
      p.isMoving = true;
      p.isFacingLeft = true;
    }

    if (key === " ") {
      if (p.boostRemaining > 0 && !p.isHoldingSpace) {
        p.isHoldingSpace = true;
        p.isSprinting = true;
        p.recharging = false;
        if (p.vx > 0) p.vx = BOOST_SPEED;
        if (p.vx < 0) p.vx = -BOOST_SPEED;
        // juga update isMoving supaya animasi tetap jalan saat sprint
        if (p.vx !== 0) p.isMoving = true;
      }
    }

    if (key === "ArrowUp" && p.isOnGround) {
      p.vy = JUMP_FORCE;
      p.isOnGround = false;
    }
  });

  socket.on("keyup", (key) => {
    const p = players[socket.id];
    if (!p) return;

    if (key === "ArrowRight" || key === "ArrowLeft") {
      p.vx = 0;
      p.isMoving = false;
    }

    if (key === " ") {
      if (p.isHoldingSpace) p.isHoldingSpace = false;
      p.isSprinting = false;
      if (p.vx > 0) p.vx = NORMAL_SPEED;
      if (p.vx < 0) p.vx = -NORMAL_SPEED;

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
  const screenThreshold = 800;  // threshold fixed 800 px
  const screenLowerBound = 200; // optional, batas bawah supaya kamera gak maju mundur terlalu jauh

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

    // Cek stage berdasarkan jarak
    const currentStage = Math.floor(p.x / STAGE_DISTANCE) + 1;
    if (!p.stage) p.stage = 1;

    if (currentStage > p.stage) {
      p.stage = currentStage;
    }

    // Cek menang (stage melewati MAX_STAGE)
    for (let id in players) {
      const p = players[id];

      if (p.stage > MAX_STAGE && !p.hasWon) {
        p.hasWon = true;
        console.log(`${p.name} menang!`);
        io.emit("playerWon", { id: p.id, name: p.name });

        // Tandai pemain lain kalah
        for (let otherId in players) {
          if (otherId !== id && !players[otherId].hasWon && !players[otherId].hasLost) {
            players[otherId].hasLost = true;
            console.log(`${players[otherId].name} kalah karena pemain lain menang`);
            io.emit("playerLost", { id: otherId, name: players[otherId].name });
          }
        }

        // Reset game state setelah 3 detik (contoh delay biar pemain lihat hasil)
        setTimeout(() => {
          resetGame();
          io.emit("update", { players });
        }, 3000);

        break; // jangan lanjut looping pemain lain
      }
    }

    // Cek kalah (lives <= 1)
    if (p.lives <= 1 && !p.hasLost) {
      p.hasLost = true;
      console.log(`${p.name} kalah!`);
      io.emit("playerLost", { id: p.id, name: p.name });

      // Tandai pemain lain menang
      for (let otherId in players) {
        if (otherId !== p.id && !players[otherId].hasLost && !players[otherId].hasWon) {
          players[otherId].hasWon = true;
          console.log(`${players[otherId].name} menang karena pemain lain kalah`);
          io.emit("playerWon", { id: otherId, name: players[otherId].name });
        }
      }

      // Reset game state setelah delay
      setTimeout(() => {
        resetGame();
        io.emit("update", { players });
      }, 3000);
    }

    // Cek collision pemain dengan obstacle
    const playerWidth = 50;
    const playerHeight = 100;

    obstacles.forEach((obs, idx) => {
      if (!p.hasLost && !p.hasWon) {
        const collision =
          p.x < obs.x + obs.width &&
          p.x + playerWidth > obs.x &&
          p.y - playerHeight < obs.y &&
          p.y > obs.y - obs.height;

        if (collision) {
          p.lives = Math.max(0, p.lives - 1);
          console.log(`${p.name} kena obstacle, sisa nyawa: ${p.lives}`);

          // Hapus obstacle supaya tidak kena berulang kali
          obstacles.splice(idx, 1);
        }
      }
    });

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
    } else if (screenX < screenLowerBound) {
      p.cameraX = p.x - screenLowerBound;
    }
    if (p.cameraX < 0) p.cameraX = 0;
  }

  io.emit("update", { players, obstacles });
}, TICK_MS);

// Tambahkan fungsi reset game
function resetGame() {
  // Kosongkan semua slot dan players
  players = {};
  slots = [null, null];
  console.log("Game state sudah di-reset.");
}

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
