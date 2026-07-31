const { rooms } = require('../rooms');
const { users, saveUsers, getScore } = require('../users');
const { newState, resolve, MAX_HP, MAX_ENERGY } = require('../energywar');
const config = require('../config');

const VALID_ACTIONS = ['gather', 'block', 'fire', 'heal'];

function clearRoundTimer(room) {
    if (room.energyTimer) {
        clearTimeout(room.energyTimer);
        room.energyTimer = null;
    }
}

function startRoundTimer(io, room) {
    clearRoundTimer(room);
    if (room.over || room.gameType !== 'energywar') return;
    if (Object.keys(room.disconnected).length > 0) return;
    if (!room.energyState) room.energyState = newState();
    room.energyTimer = setTimeout(() => {
        room.energyTimer = null;
        if (room.over || Object.keys(room.disconnected).length > 0) return;
        const st = room.energyState;
        if (!st) return;
        let changed = false;
        const autoFilled = [];
        for (const c of ['black', 'white']) {
            if (!st.picks[c]) {
                st.picks[c] = 'block';
                autoFilled.push(c);
                changed = true;
            }
        }
        if (changed) resolveRound(io, room, autoFilled);
    }, config.ENERGY_ROUND_TIMEOUT_MS);
}

function resolveRound(io, room, autoFilled) {
    clearRoundTimer(room);
    const st = room.energyState;
    if (!st) return;
    const picksSnapshot = { black: st.picks.black, white: st.picks.white };
    const { winner, events } = resolve(st);
    st.picks = {};
    if (autoFilled && autoFilled.length) {
        events.unshift(...autoFilled.map(c => ({ type: 'timeout', color: c })));
    }

    const payload = {
        roomId: room.id,
        round: room.round,
        picks: picksSnapshot,
        events,
        winner,
        over: !!winner,
        hp: st.hp,
        energy: st.energy
    };
    io.to('room_' + room.id).emit('energyResolve', payload);

    if (!winner) {
        startRoundTimer(io, room);
        return;
    }

    room.over = true;
    console.log(`房间 ${room.id} [能量战] 结束: ${JSON.stringify(picksSnapshot)} -> winner=${winner}`);
    if (winner === 'draw') return;

    const winnerUser = winner === 'black' ? room.players[0] : room.players[1];
    const loserUser = winner === 'black' ? room.players[1] : room.players[0];
    if (winnerUser && loserUser && users[winnerUser] && users[loserUser]) {
        users[winnerUser].score += config.WIN_SCORE;
        users[loserUser].score -= config.WIN_SCORE;
        saveUsers();
        io.to('room_' + room.id).emit('scoreUpdate', {
            [winnerUser]: users[winnerUser].score,
            [loserUser]: users[loserUser].score
        });
        io.to('room_' + room.id).emit('playerInfo', {
            black: { username: room.players[0], score: getScore(room.players[0]) },
            white: { username: room.players[1], score: getScore(room.players[1]) }
        });
        console.log(`积分: ${winnerUser} +${config.WIN_SCORE}, ${loserUser} -${config.WIN_SCORE}`);
    }
}

module.exports = function registerEnergy(io, socket) {
    socket.on('energyPick', (data) => {
        const room = rooms[data.roomId];
        if (!room || room.gameType !== 'energywar') return;
        if (Object.keys(room.disconnected).length > 0) return;
        if (room.over) return;
        const username = socket.data.username;
        if (!username || !room.players.includes(username)) return;
        if (!room.energyState) room.energyState = newState();
        const st = room.energyState;
        const symbol = room.players[0] === username ? 'black' : 'white';
        const action = data.action;
        if (!VALID_ACTIONS.includes(action)) return;
        if (st.picks[symbol]) return;
        if ((action === 'fire') && st.energy[symbol] < 1) return;
        st.picks[symbol] = action;
        if (Object.keys(st.picks).length < 2) return;
        resolveRound(io, room);
    });
};

module.exports.startRoundTimer = startRoundTimer;
module.exports.clearRoundTimer = clearRoundTimer;
