const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./src/config');
const registerAuth = require('./src/socket/auth');
const registerLobby = require('./src/socket/lobby');
const registerGame = require('./src/socket/game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(config.PUBLIC_DIR));

io.on('connection', (socket) => {
    console.log(`玩家已连接: ${socket.id}`);
    registerAuth(io, socket);
    registerLobby(io, socket);
    registerGame(io, socket);
});

server.listen(config.PORT, () => {
    console.log(`服务器运行在 http://localhost:${config.PORT}`);
});
