const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let playerCount = 0;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", ({ name }) => {
    const index = playerCount % 2;
    players[socket.id] = {
      id: socket.id,
      name,
      x: 100,
      y: 300,
      vx: 0,
      index,
      cameraX: 0,
    };
    playerCount++;
    socket.emit("init", { id: socket.id, players });
    io.emit("update", { players });
  });

  socket.on("keydown", (key) => {
    const p = players[socket.id];
    if (!p) return;

    const speed = 10;
    const screenThreshold = 250;

    if (key === "ArrowRight") {
      p.x += speed;
    }
    if (key === "ArrowLeft") {
      p.x -= speed;
      if (p.x < 0) p.x = 0;
    }

    const screenX = p.x - p.cameraX;

    if (screenX > screenThreshold) {
      p.cameraX = p.x - screenThreshold;
    } else if (screenX < 100) {
      p.cameraX = p.x - 100;
    }

    if (p.cameraX < 0) p.cameraX = 0;

    io.emit("update", { players });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    playerCount--;
    io.emit("update", { players });
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
