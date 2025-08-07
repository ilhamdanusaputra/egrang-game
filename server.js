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
  console.log("User connected", socket.id);

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
    const player = players[socket.id];
    if (!player) return;
    if (key === "ArrowRight") player.x += 10;
    if (key === "ArrowLeft") player.x -= 10;
    player.cameraX = player.x - 100;
    io.emit("update", { players });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    playerCount--;
    io.emit("update", { players });
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
