import { startGame } from './game.js';

const socket = new WebSocket(`ws://${location.host}`);
let playerId = null;
let otherPlayerState = null;

document.getElementById('startBtn').onclick = () => {
  const name = document.getElementById('nameInput').value;
  if (!name) return alert("Enter your name!");

  // 💾 Save name locally
  localStorage.setItem('playerName', name);
  document.getElementById('menu').style.display = 'none';

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'init') {
      playerId = msg.id;

      // 👇 Create dummy player if alone
      if (playerId === 0) {
        startGame(playerId, socket, () => ({
          x: 200 + Math.sin(Date.now() / 500) * 50,
          y: 220
        }));
      } else {
        startGame(playerId, socket, () => otherPlayerState);
      }
    } else if (msg.type === 'update') {
      if (msg.id !== playerId) {
        otherPlayerState = msg.data;
      }
    }
  };
};
