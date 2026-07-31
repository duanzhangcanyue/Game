const config = require('./config');
const { resetRoom, broadcastRooms } = require('./rooms');
const { users, saveUsers, getScore } = require('./users');
const { startRoundTimer, clearRoundTimer } = require('./socket/energy');

function startGrace(io, room, username, socket) {
    if (room.disconnected[username]) return;
    room.disconnected[username] = true;
    if (!room.graceSockets) room.graceSockets = {};
    room.graceSockets[username] = socket || null;
    room.disconnectTimers[username] = setTimeout(() => {
        finishGrace(io, room, username);
    }, config.DISCONNECT_GRACE_MS);
    io.to('room_' + room.id).emit('opponentDisconnected', {
        username,
        timeout: config.DISCONNECT_GRACE_MS
    });
    console.log(`玩家 ${username} 断开/退出，房间 ${room.id} 进入 ${config.DISCONNECT_GRACE_MS / 1000} 秒倒计时`);
}

function cancelGrace(room, username) {
    clearTimeout(room.disconnectTimers[username]);
    delete room.disconnectTimers[username];
    delete room.disconnected[username];
    if (room.graceSockets) delete room.graceSockets[username];
}

function finishGrace(io, room, username) {
    if (!room.disconnected[username]) return;
    const leaverSocket = room.graceSockets ? room.graceSockets[username] : null;
    delete room.disconnected[username];
    delete room.disconnectTimers[username];
    if (room.graceSockets) delete room.graceSockets[username];
    room.players = room.players.filter(p => p !== username);
    room.turn = null;
    room.boardState = null;
    room.over = false;
    if (room.players.length === 1) {
        const winner = room.players[0];
        if (!room.disconnected[winner] && users[winner] && users[username]) {
            users[winner].score += config.WIN_SCORE;
            users[username].score -= config.WIN_SCORE;
            saveUsers();
            io.to('room_' + room.id).emit('scoreUpdate', {
                [winner]: users[winner].score,
                [username]: users[username].score
            });
            io.to('room_' + room.id).emit('opponentDisconnectTimeout', { username });
            console.log(`房间 ${room.id} 对手未重连，${winner} 自动获胜 +${config.WIN_SCORE}, ${username} -${config.WIN_SCORE}`);
        }
    }
    if (room.players.length === 0) {
        resetRoom(room);
    }
    broadcastRooms(io);
    if (leaverSocket && leaverSocket.connected) {
        leaverSocket.emit('leftRoom');
    }
}

function resumeIntoRoom(io, socket, room, username) {
    cancelGrace(room, username);
    socket.join('room_' + room.id);
    const symbol = room.players[0] === username ? 'black' : 'white';
    io.to('room_' + room.id).emit('playerInfo', {
        black: { username: room.players[0], score: getScore(room.players[0]) },
        white: { username: room.players[1], score: getScore(room.players[1]) }
    });
    socket.emit('resumeGame', {
        roomId: room.id,
        gameType: room.gameType,
        symbol,
        round: room.round,
        boardState: room.boardState,
        energyState: room.energyState,
        isMyTurn: room.turn ? room.turn === symbol : false,
        over: room.over
    });
    socket.to('room_' + room.id).emit('opponentReconnected', { username });
    if (room.gameType === 'energywar' && room.energyState) {
        room.energyState.picks = {};
        io.to('room_' + room.id).emit('energyReset');
        startRoundTimer(io, room);
    }
    return symbol;
}

module.exports = { startGrace, cancelGrace, resumeIntoRoom };
