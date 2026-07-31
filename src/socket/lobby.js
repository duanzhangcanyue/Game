const { rooms, roomSummary, broadcastRooms, getRoomForUser, startGame, resetRoom } = require('../rooms');
const { getScore } = require('../users');
const { startGrace, resumeIntoRoom } = require('../grace');
const config = require('../config');

module.exports = function registerLobby(io, socket) {
    socket.on('getRooms', () => {
        socket.emit('roomsUpdate', roomSummary());
    });

    socket.on('createRoom', ({ roomId, password, gameType }, cb) => {
        const username = socket.data.username;
        if (!username) return cb && cb({ ok: false, msg: '请先登录' });
        const id = Number(roomId);
        if (id < 1 || id > config.ROOM_COUNT) return cb && cb({ ok: false, msg: '房间号需在 1-10 之间' });
        const type = config.GAME_TYPES.includes(gameType) ? gameType : 'erdayi';
        const room = rooms[id];
        if (room.players.length > 0) return cb && cb({ ok: false, msg: '房间已被占用' });
        const myRoom = getRoomForUser(username);
        if (myRoom) {
            if (myRoom.disconnected[username]) return cb && cb({ ok: false, msg: '你刚退出房间，请等待 10 秒倒计时结束' });
            return cb && cb({ ok: false, msg: `你已在房间 ${myRoom.id} 中` });
        }
        room.password = password || '';
        room.gameType = type;
        room.players = [username];
        socket.join('room_' + id);
        cb && cb({ ok: true, roomId: id, gameType: type });
        broadcastRooms(io);
        socket.emit('inRoom', { roomId: id, gameType: type });
        console.log(`${username} 创建房间 ${id} [${type}]`);
    });

    socket.on('joinRoom', ({ roomId, password, gameType }, cb) => {
        const username = socket.data.username;
        if (!username) return cb && cb({ ok: false, msg: '请先登录' });
        const id = Number(roomId);
        if (id < 1 || id > config.ROOM_COUNT) return cb && cb({ ok: false, msg: '房间号无效' });
        const room = rooms[id];
        if (room.disconnected[username] && room.players.includes(username)) {
            resumeIntoRoom(io, socket, room, username);
            cb && cb({ ok: true, roomId: id, gameType: room.gameType });
            console.log(`${username} 回归房间 ${id}`);
            return;
        }
        if (room.players.length >= 2) return cb && cb({ ok: false, msg: '房间已满' });
        if (room.password && room.password !== (password || '')) return cb && cb({ ok: false, msg: '房间密码错误' });
        const myRoom = getRoomForUser(username);
        if (myRoom) {
            if (myRoom.disconnected[username]) return cb && cb({ ok: false, msg: '你刚退出房间，请等待 10 秒倒计时结束' });
            return cb && cb({ ok: false, msg: `你已在房间 ${myRoom.id} 中` });
        }
        if (room.players.includes(username)) return cb && cb({ ok: false, msg: '你已在房间中' });
        if (room.players.length === 0 && config.GAME_TYPES.includes(gameType)) {
            room.gameType = gameType;
        }
        room.players.push(username);
        socket.join('room_' + id);
        cb && cb({ ok: true, roomId: id, gameType: room.gameType });
        broadcastRooms(io);
        if (room.players.length === 2) {
            startGame(io, room, getScore);
        }
        console.log(`${username} 加入房间 ${id}`);
    });

    socket.on('leaveRoom', (roomId, cb) => {
        const username = socket.data.username;
        const id = Number(roomId);
        const room = rooms[id];
        if (!room || !room.players.includes(username)) return cb && cb({ ok: false });
        socket.leave('room_' + id);
        if (room.players.length === 2 && !room.disconnected[username]) {
            startGrace(io, room, username, socket);
            cb && cb({ ok: true });
            console.log(`${username} 退出房间 ${id}，进入 10 秒倒计时`);
            return;
        }
        room.players = room.players.filter(p => p !== username);
        if (room.players.length === 0) {
            resetRoom(room);
        }
        cb && cb({ ok: true });
        broadcastRooms(io);
        socket.emit('leftRoom');
        console.log(`${username} 离开房间 ${id}`);
    });
};
