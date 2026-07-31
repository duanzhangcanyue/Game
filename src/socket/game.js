const { rooms, broadcastRooms, getRoomForUser, resetRoom, emitSymbols } = require('../rooms');
const { users, saveUsers, getScore } = require('../users');
const config = require('../config');

module.exports = function registerGame(io, socket) {
    socket.on('move', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            if (Object.keys(room.disconnected).length > 0) return;
            room.boardState = data.boardState;
            room.turn = room.turn === 'black' ? 'white' : 'black';
        }
        socket.to('room_' + data.roomId).emit('opponentMove', data);
    });

    socket.on('gameOver', (data) => {
        const room = rooms[data.roomId];
        if (room) {
            socket.to('room_' + data.roomId).emit('opponentGameOver', data);
            room.turn = null;
            room.boardState = data.boardState;
            room.over = true;
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
            room.turn = 'black';
            room.boardState = null;
            room.over = false;
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
        room.turn = 'black';
        room.boardState = null;
        room.over = false;
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

    socket.on('resumeRoom', (roomId, cb) => {
        const username = socket.data.username;
        const room = rooms[roomId];
        if (!username || !room) return cb && cb({ ok: false, msg: '房间不存在' });
        if (!room.players.includes(username)) return cb && cb({ ok: false, msg: '你已不在房间中' });
        if (!room.disconnected[username]) return cb && cb({ ok: false, msg: '当前无需恢复连接' });
        clearTimeout(room.disconnectTimers[username]);
        delete room.disconnectTimers[username];
        delete room.disconnected[username];
        socket.join('room_' + roomId);
        const symbol = room.players[0] === username ? 'black' : 'white';
        io.to('room_' + roomId).emit('playerInfo', {
            black: { username: room.players[0], score: getScore(room.players[0]) },
            white: { username: room.players[1], score: getScore(room.players[1]) }
        });
        socket.emit('resumeGame', {
            roomId: room.id,
            gameType: room.gameType,
            symbol,
            round: room.round,
            boardState: room.boardState,
            isMyTurn: room.turn ? room.turn === symbol : false,
            over: room.over
        });
        if (room.turn) {
            socket.to('room_' + roomId).emit('opponentReconnected', { username });
        }
        cb && cb({ ok: true, roomId: room.id, gameType: room.gameType, symbol });
        console.log(`玩家重连成功: ${username} -> 房间 ${roomId}`);
    });

    socket.on('disconnect', () => {
        const username = socket.data.username;
        if (username) {
            const room = getRoomForUser(username);
            if (room && room.players.includes(username)) {
                room.disconnected[username] = true;
                room.disconnectTimers[username] = setTimeout(() => {
                    const r = getRoomForUser(username);
                    if (!r || !r.disconnected[username]) return;
                    delete r.disconnected[username];
                    r.players = r.players.filter(p => p !== username);
                    if (users[username]) {
                        users[username].score = Math.max(0, users[username].score - config.DISCONNECT_PENALTY);
                        saveUsers();
                    }
                    if (r.players.length === 1) {
                        io.to('room_' + r.id).emit('opponentDisconnectTimeout', { username });
                        io.to('room_' + r.id).emit('scoreUpdate', {
                            [username]: getScore(username)
                        });
                        io.to('room_' + r.id).emit('playerInfo', {
                            black: { username: r.players[0], score: getScore(r.players[0]) },
                            white: { username: r.players[1], score: getScore(r.players[1]) }
                        });
                        console.log(`房间 ${r.id} 对手未重连，${username} 扣 ${config.DISCONNECT_PENALTY} 分`);
                    }
                    if (r.players.length === 0) {
                        resetRoom(r);
                    }
                    broadcastRooms(io);
                }, config.DISCONNECT_GRACE_MS);
                socket.to('room_' + room.id).emit('opponentDisconnected', { username });
                console.log(`玩家断开，10 秒内可重连: ${username} (房间 ${room.id})`);
            }
        }
        console.log(`连接已断开: ${socket.id}`);
    });
};
