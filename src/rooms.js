const config = require('./config');

const rooms = {};
for (let i = 1; i <= config.ROOM_COUNT; i++) {
    rooms[i] = { id: i, password: '', players: [], round: 1, pendingRestart: false, gameType: 'erdayi', turn: null, boardState: null, over: false, disconnected: {}, disconnectTimers: {}, energyState: null };
}

function roomSummary() {
    const list = [];
    for (let i = 1; i <= config.ROOM_COUNT; i++) {
        const r = rooms[i];
        list.push({
            id: r.id,
            gameType: r.gameType,
            hasPassword: !!r.password,
            playerCount: r.players.length,
            players: r.players.slice()
        });
    }
    return list;
}

function broadcastRooms(io) {
    io.emit('roomsUpdate', roomSummary());
}

function getRoomForUser(username) {
    for (let i = 1; i <= config.ROOM_COUNT; i++) {
        if (rooms[i].players.includes(username)) return rooms[i];
    }
    return null;
}

function resetRoom(room) {
    room.password = '';
    room.round = 1;
    room.pendingRestart = false;
    room.turn = null;
    room.boardState = null;
    room.over = false;
    room.disconnected = {};
    for (const k in room.disconnectTimers) clearTimeout(room.disconnectTimers[k]);
    room.disconnectTimers = {};
    room.energyState = null;
    if (room.energyTimer) {
        clearTimeout(room.energyTimer);
        room.energyTimer = null;
    }
}

function emitSymbols(io, room, black, white, round) {
    io.to('room_' + room.id).emit('symbolUpdate', { symbol: 'black', round, for: black, gameType: room.gameType });
    io.to('room_' + room.id).emit('symbolUpdate', { symbol: 'white', round, for: white, gameType: room.gameType });
}

function blackPlayer(room) {
    return room.round % 2 === 1 ? room.players[0] : room.players[1];
}

function startGame(io, room, getScore) {
    room.round = 1;
    room.pendingRestart = false;
    room.turn = 'black';
    room.boardState = null;
    room.over = false;
    room.energyState = null;
    if (room.energyTimer) {
        clearTimeout(room.energyTimer);
        room.energyTimer = null;
    }
    const black = room.players[0];
    const white = room.players[1];
    io.to('room_' + room.id).emit('matched', { roomId: room.id, black, white, round: 1, gameType: room.gameType });
    io.to('room_' + room.id).emit('playerInfo', {
        black: { username: black, score: getScore(black) },
        white: { username: white, score: getScore(white) }
    });
    emitSymbols(io, room, black, white, 1);
    console.log(`房间 ${room.id} [${room.gameType}]: ${black} vs ${white}`);
}

module.exports = {
    rooms,
    roomSummary,
    broadcastRooms,
    getRoomForUser,
    resetRoom,
    startGame,
    emitSymbols,
    blackPlayer
};
