const { rooms, broadcastRooms, getRoomForUser, resetRoom, emitSymbols } = require('../rooms');
const { users, saveUsers, getScore } = require('../users');
const config = require('../config');

module.exports = function registerGame(io, socket) {
    socket.on('move', (data) => {
        socket.to('room_' + data.roomId).emit('opponentMove', data);
    });

    socket.on('gameOver', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            socket.to('room_' + data.roomId).emit('opponentGameOver', data);
            if (data.winner !== 'black' && data.winner !== 'white') return;
            const winner = data.winner === 'black' ? room.players[0] : room.players[1];
            const loser = data.winner === 'black' ? room.players[1] : room.players[0];
            if (winner && loser && users[winner] && users[loser]) {
                users[winner].score += config.WIN_SCORE;
                users[loser].score = Math.max(0, users[loser].score - config.WIN_SCORE);
                saveUsers();
                io.to('room_' + data.roomId).emit('scoreUpdate', {
                    [winner]: users[winner].score,
                    [loser]: users[loser].score
                });
                io.to('room_' + data.roomId).emit('playerInfo', {
                    black: { username: room.players[0], score: getScore(room.players[0]) },
                    white: { username: room.players[1], score: getScore(room.players[1]) }
                });
                console.log(`积分: ${winner} +${config.WIN_SCORE}, ${loser} -${config.WIN_SCORE}`);
            }
        }
    });

    socket.on('restartRequest', (roomId) => {
        const room = rooms[roomId];
        if (!room) return;
        if (room.pendingRestart) {
            room.pendingRestart = false;
            room.round++;
            const black = room.round % 2 === 1 ? room.players[0] : room.players[1];
            const white = black === room.players[0] ? room.players[1] : room.players[0];
            emitSymbols(io, room, black, white, room.round);
            console.log(`房间 ${roomId} 双方同时请求，第 ${room.round} 局`);
            return;
        }
        room.pendingRestart = true;
        socket.to('room_' + roomId).emit('restartRequested');
        console.log(`${socket.data.username} 请求重新开始`);
    });

    socket.on('restartAccept', (roomId) => {
        const room = rooms[roomId];
        if (!room || !room.pendingRestart) return;
        room.pendingRestart = false;
        room.round++;
        const black = room.round % 2 === 1 ? room.players[0] : room.players[1];
        const white = black === room.players[0] ? room.players[1] : room.players[0];
        emitSymbols(io, room, black, white, room.round);
        console.log(`房间 ${roomId} 第 ${room.round} 局`);
    });

    socket.on('restartReject', (roomId) => {
        const room = rooms[roomId];
        if (!room || !room.pendingRestart) return;
        room.pendingRestart = false;
        socket.to('room_' + roomId).emit('restartDeclined');
        console.log(`${socket.data.username} 拒绝了重新开始`);
    });

    socket.on('disconnect', () => {
        const username = socket.data.username;
        if (username) {
            const room = getRoomForUser(username);
            if (room) {
                room.players = room.players.filter(p => p !== username);
                if (room.players.length === 1) {
                    io.to('room_' + room.id).emit('opponentDisconnected');
                }
                if (room.players.length === 0) {
                    resetRoom(room);
                }
                broadcastRooms(io);
            }
        }
        console.log(`玩家已断开: ${socket.id}`);
    });
};
