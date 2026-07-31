import * as auth from './modules/auth.js';
import * as lobby from './modules/lobby.js';

const socket = io();

const els = {
    authView: document.getElementById('authView'),
    lobbyView: document.getElementById('lobbyView'),
    gameView: document.getElementById('gameView'),
    board: document.getElementById('board'),
    status: document.getElementById('status'),
    info: document.getElementById('info'),
    countInfo: document.getElementById('countInfo'),
    restartBtn: document.getElementById('restart'),
    restartConfirm: document.getElementById('restartConfirm'),
    acceptBtn: document.getElementById('acceptBtn'),
    rejectBtn: document.getElementById('rejectBtn'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),
    playerBlack: document.getElementById('playerBlack'),
    playerWhite: document.getElementById('playerWhite'),
    lobbyUser: document.getElementById('lobbyUser'),
    lobbyScore: document.getElementById('lobbyScore'),
    appTitle: document.getElementById('appTitle')
};

const state = {
    myUsername: null,
    myScore: 0,
    roomId: null,
    gameType: null,
    activeGame: null
};

const app = { socket, els, state };

const views = { auth: els.authView, lobby: els.lobbyView, game: els.gameView };
function showView(name) {
    for (const k in views) views[k].classList.toggle('active', k === name);
}

/* ---------- 游戏上下文，传给游戏模块 ---------- */
const ctx = {
    socket,
    board: els.board,
    status: els.status,
    info: els.info,
    countInfo: els.countInfo,
    restartBtn: els.restartBtn,
    getRoomId: () => state.roomId,
    getMyUsername: () => state.myUsername
};

async function loadGame(gameType) {
    const mod = await import(`./games/${gameType}.js`);
    state.activeGame = mod.default;
    return state.activeGame;
}

function enterGame(roomId, gameType, isCreator) {
    state.roomId = roomId;
    state.gameType = gameType;
    setPlayerSyms();
    showView('game');
    els.restartConfirm.style.display = 'none';
    loadGame(gameType).then((game) => {
        els.status.textContent = '';
        els.info.textContent = isCreator ? '房间已创建，等待对手加入...' : '已加入房间，等待对方就位...';
        els.restartBtn.disabled = true;
        game.renderWaiting(ctx);
        setWaitingPlayer(isCreator ? 'black' : 'white', state.myUsername, state.myScore);
    });
}

/* ---------- 玩家栏 ---------- */
function setPlayerSyms() {
    const g = state.gameType || 'erdayi';
    const b = els.playerBlack.querySelector('.player-sym');
    const w = els.playerWhite.querySelector('.player-sym');
    b.className = 'player-sym';
    w.className = 'player-sym';
    b.textContent = '';
    w.textContent = '';
    if (g === 'tictactoe') {
        b.textContent = 'X'; b.classList.add('sym-x');
        w.textContent = 'O'; w.classList.add('sym-o');
    } else if (g === 'gomoku') {
        b.classList.add('sym-black');
        w.classList.add('sym-white');
    } else {
        b.classList.add('black-sym');
        w.classList.add('white-sym');
    }
}

function setWaitingPlayer(color, name, score) {
    const card = color === 'black' ? els.playerBlack : els.playerWhite;
    card.querySelector('.player-name').textContent = name;
    card.querySelector('.player-score').textContent = '积分 ' + score;
    card.classList.toggle('me', name === state.myUsername);
}

function updatePlayersBar(info) {
    setPlayerSyms();
    const black = els.playerBlack;
    const white = els.playerWhite;
    black.querySelector('.player-name').textContent = info.black.username;
    black.querySelector('.player-score').textContent = '积分 ' + info.black.score;
    white.querySelector('.player-name').textContent = info.white.username;
    white.querySelector('.player-score').textContent = '积分 ' + info.white.score;
    black.classList.toggle('me', info.black.username === state.myUsername);
    white.classList.toggle('me', info.white.username === state.myUsername);
}

function resetPlayersBar() {
    els.playerBlack.querySelector('.player-name').textContent = '等待中';
    els.playerBlack.querySelector('.player-score').textContent = '--';
    els.playerWhite.querySelector('.player-name').textContent = '等待中';
    els.playerWhite.querySelector('.player-score').textContent = '--';
}

/* ---------- 认证成功回调 ---------- */
function onAuthSuccess(username, score) {
    state.myUsername = username;
    state.myScore = score;
    els.lobbyUser.textContent = username;
    els.lobbyScore.textContent = score;
    showView('lobby');
    socket.emit('getRooms');
}

auth.init(app, { showView, onAuthSuccess });
lobby.init(app, { showView, enterGame });

/* ---------- 对局按钮 ---------- */
els.leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', state.roomId, () => {
        state.activeGame = null;
        state.roomId = null;
        resetPlayersBar();
        showView('lobby');
        socket.emit('getRooms');
    });
});

els.restartBtn.addEventListener('click', () => {
    els.restartBtn.disabled = true;
    els.status.textContent = '等待对方同意重新开始...';
    socket.emit('restartRequest', state.roomId);
});

els.acceptBtn.addEventListener('click', () => {
    els.restartConfirm.style.display = 'none';
    socket.emit('restartAccept', state.roomId);
});

els.rejectBtn.addEventListener('click', () => {
    els.restartConfirm.style.display = 'none';
    els.restartBtn.disabled = false;
    socket.emit('restartReject', state.roomId);
});

/* ---------- socket 事件 ---------- */
socket.on('roomsUpdate', (rooms) => {
    lobby.renderRooms(app, rooms);
});

socket.on('symbolUpdate', (data) => {
    if (data.for && data.for !== state.myUsername) return;
    els.restartConfirm.style.display = 'none';
    const startGame = (game) => {
        game.init(ctx, data.symbol, data.round);
        const name = data.gameType === 'tictactoe'
            ? (data.symbol === 'black' ? 'X' : 'O')
            : (data.symbol === 'black' ? '黑棋' : '白棋');
        els.info.textContent = `第 ${data.round} 局，你是 ${name} 方`;
    };
    if (state.activeGame && state.activeGame.key === data.gameType) {
        startGame(state.activeGame);
    } else {
        loadGame(data.gameType).then(startGame);
    }
});

socket.on('opponentMove', (data) => {
    if (state.activeGame) state.activeGame.onOpponentMove(ctx, data);
});

socket.on('opponentGameOver', (data) => {
    if (state.activeGame) state.activeGame.onOpponentGameOver(ctx, data);
});

socket.on('playerInfo', (info) => {
    updatePlayersBar(info);
});

socket.on('scoreUpdate', (scores) => {
    if (scores[state.myUsername] !== undefined) {
        state.myScore = scores[state.myUsername];
        els.lobbyScore.textContent = state.myScore;
    }
});

socket.on('restartRequested', () => {
    els.status.textContent = '对方请求重新开始';
    els.restartConfirm.style.display = 'block';
    els.restartBtn.disabled = true;
});

socket.on('restartDeclined', () => {
    els.status.textContent = '';
    els.info.textContent = '对方拒绝了重新开始';
    els.restartBtn.disabled = false;
    if (state.activeGame) state.activeGame.updateUI(ctx);
});

socket.on('opponentDisconnected', () => {
    els.status.textContent = '对手已离开';
    els.info.textContent = '连接断开，可返回大厅';
    els.restartBtn.disabled = true;
    els.restartConfirm.style.display = 'none';
});

socket.on('opponentLeft', () => {
    els.status.textContent = '对手离开了房间';
    els.info.textContent = '等待新对手加入...';
    els.restartBtn.disabled = true;
    els.restartConfirm.style.display = 'none';
});

socket.on('leftRoom', () => {
    state.activeGame = null;
    state.roomId = null;
    resetPlayersBar();
    showView('lobby');
    socket.emit('getRooms');
});

showView('auth');
