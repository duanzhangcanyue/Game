const path = require('path');

module.exports = {
    ROOM_COUNT: 10,
    START_SCORE: 100,
    WIN_SCORE: 10,
    DISCONNECT_GRACE_MS: 10000,
    ENERGY_ROUND_TIMEOUT_MS: 20000,
    GAME_TYPES: ['erdayi', 'gomoku', 'tictactoe', 'energywar'],
    GAME_NAMES: { erdayi: '二打一', gomoku: '五子棋', tictactoe: '井字棋', energywar: '能量战' },
    PORT: process.env.PORT || 3000,
    USERS_FILE: path.join(__dirname, '..', 'users.json'),
    PUBLIC_DIR: path.join(__dirname, '..', 'public'),
    GM_USERNAME: '咪路',
    GM_PASSWORD: 'Wasd123654789!'
};
