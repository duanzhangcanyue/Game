import * as auth from './modules/auth.js';
import * as lobby from './modules/lobby.js';

const GM_USERNAME = '咪路';
const APP_TITLE = '咪路游戏大厅';
const socket = io();
document.title = APP_TITLE;

const els = {
    authView: document.getElementById('authView'),
    lobbyView: document.getElementById('lobbyView'),
    gameView: document.getElementById('gameView'),
    adminView: document.getElementById('adminView'),
    adminBtn: document.getElementById('adminBtn'),
    adminBackBtn: document.getElementById('adminBackBtn'),
    adminInfo: document.getElementById('adminInfo'),
    adminTbody: document.getElementById('adminTbody'),
    adminError: document.getElementById('adminError'),
    adminModal: document.getElementById('adminModal'),
    adminModalTitle: document.getElementById('adminModalTitle'),
    adminModalInput: document.getElementById('adminModalInput'),
    adminModalOk: document.getElementById('adminModalOk'),
    adminModalCancel: document.getElementById('adminModalCancel'),
    board: document.getElementById('board'),
    status: document.getElementById('status'),
    info: document.getElementById('info'),
    countInfo: document.getElementById('countInfo'),
    restartBtn: document.getElementById('restart'),
    restartConfirm: document.getElementById('restartConfirm'),
    acceptBtn: document.getElementById('acceptBtn'),
    rejectBtn: document.getElementById('rejectBtn'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    playerBlack: document.getElementById('playerBlack'),
    playerWhite: document.getElementById('playerWhite'),
    lobbyUser: document.getElementById('lobbyUser'),
    lobbyScore: document.getElementById('lobbyScore'),
    appTitle: document.getElementById('appTitle')
};

function getSession() {
    try { return JSON.parse(localStorage.getItem('ml_session') || 'null'); } catch (e) { return null; }
}

function saveRoom(roomId) {
    const session = getSession();
    if (!session) return;
    session.roomId = roomId;
    localStorage.setItem('ml_session', JSON.stringify(session));
}

function clearSavedRoom() {
    const session = getSession();
    if (!session) return;
    delete session.roomId;
    localStorage.setItem('ml_session', JSON.stringify(session));
}

const savedSession = getSession();

const state = {
    myUsername: null,
    myScore: 0,
    roomId: (savedSession && savedSession.roomId) || null,
    gameType: null,
    activeGame: null,
    started: false
};

const app = { socket, els, state };

const views = { auth: els.authView, lobby: els.lobbyView, game: els.gameView, admin: els.adminView };
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
    state.started = false;
    saveRoom(roomId);
    setPlayerSyms();
    showView('game');
    els.restartConfirm.style.display = 'none';
    loadGame(gameType).then((game) => {
        if (state.started) return;
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
    const other = card === els.playerBlack ? els.playerWhite : els.playerBlack;
    card.querySelector('.player-name').textContent = name;
    card.querySelector('.player-score').textContent = '积分 ' + score;
    card.classList.toggle('me', name === state.myUsername);
    other.classList.remove('me');
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
    els.playerBlack.classList.remove('me');
    els.playerWhite.classList.remove('me');
}

/* ---------- 认证成功回调 ---------- */
function onAuthSuccess(username, score) {
    state.myUsername = username;
    state.myScore = score;
    els.lobbyUser.textContent = username;
    els.lobbyScore.textContent = score;
    els.adminBtn.style.display = (username === GM_USERNAME) ? 'inline-block' : 'none';
    if (!state.roomId) {
        showView('lobby');
        socket.emit('getRooms');
    }
}

auth.init(app, { showView, onAuthSuccess });
lobby.init(app, { showView, enterGame });

/* ---------- 对局按钮 ---------- */
els.leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', state.roomId, () => {
        state.activeGame = null;
        state.roomId = null;
        clearSavedRoom();
        resetPlayersBar();
        showView('lobby');
        socket.emit('getRooms');
    });
});

els.logoutBtn.addEventListener('click', () => {
    socket.emit('logout');
    socket.__authed = false;
    localStorage.removeItem('ml_session');
    state.myUsername = null;
    state.myScore = 0;
    state.roomId = null;
    state.gameType = null;
    state.activeGame = null;
    state.started = false;
    resetPlayersBar();
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('authError').textContent = '';
    showView('auth');
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
socket.on('disconnect', () => {
    socket.__authed = false;
});

socket.on('connect', () => {
    const session = getSession();
    if (!session || !session.username || !session.password || socket.__authed) return;
    socket.emit('login', { username: session.username, password: session.password }, (res) => {
        if (!res || !res.ok) {
            localStorage.removeItem('ml_session');
            return;
        }
        socket.__authed = true;
        if (!state.myUsername) {
            onAuthSuccess(res.username, res.score);
        } else {
            state.myScore = res.score;
            els.lobbyScore.textContent = res.score;
        }
        if (state.roomId) {
            socket.emit('resumeRoom', state.roomId, (rres) => {
                if (!rres || !rres.ok) {
                    state.roomId = null;
                    state.activeGame = null;
                    clearSavedRoom();
                    resetPlayersBar();
                    showView('lobby');
                    socket.emit('getRooms');
                }
            });
        }
    });
});

socket.on('roomsUpdate', (rooms) => {
    lobby.renderRooms(app, rooms);
});

socket.on('symbolUpdate', (data) => {
    if (data.for && data.for !== state.myUsername) return;
    els.restartConfirm.style.display = 'none';
    const startGame = (game) => {
        state.started = true;
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

let graceCountdown = null;

function stopGraceCountdown() {
    if (graceCountdown) { clearInterval(graceCountdown); graceCountdown = null; }
}

function startGraceCountdown(timeout) {
    stopGraceCountdown();
    let left = Math.ceil(timeout / 1000);
    els.status.textContent = '对方已退出，正在等待重连...';
    els.info.textContent = `对方 ${left} 秒内未返回，你将自动获胜`;
    graceCountdown = setInterval(() => {
        left--;
        if (left <= 0) {
            stopGraceCountdown();
            return;
        }
        els.info.textContent = `对方 ${left} 秒内未返回，你将自动获胜`;
    }, 1000);
}

socket.on('opponentDisconnected', (data) => {
    els.restartBtn.disabled = true;
    els.restartConfirm.style.display = 'none';
    if (state.activeGame) state.activeGame.setPaused(true);
    startGraceCountdown((data && data.timeout) || 10000);
});

socket.on('opponentReconnected', () => {
    stopGraceCountdown();
    els.status.textContent = '';
    els.info.textContent = '对方已重连，继续对局';
    els.restartBtn.disabled = false;
    if (state.activeGame) state.activeGame.setPaused(false);
});

socket.on('opponentDisconnectTimeout', () => {
    stopGraceCountdown();
    els.status.textContent = '你获胜了！';
    els.info.textContent = '对方未在 10 秒内返回，积分 +10';
    els.restartBtn.disabled = true;
    els.restartConfirm.style.display = 'none';
    const mine = els.playerBlack.classList.contains('me') ? els.playerBlack : els.playerWhite;
    const other = mine === els.playerBlack ? els.playerWhite : els.playerBlack;
    other.querySelector('.player-name').textContent = '';
    other.querySelector('.player-score').textContent = '';
    const sym = other.querySelector('.player-sym');
    sym.className = 'player-sym';
    sym.textContent = '';
    state.started = false;
    if (state.activeGame) state.activeGame.renderWaiting(ctx);
});

socket.on('resumeGame', (data) => {
    state.roomId = data.roomId;
    state.gameType = data.gameType;
    saveRoom(data.roomId);
    setPlayerSyms();
    showView('game');
    els.restartConfirm.style.display = 'none';
    loadGame(data.gameType).then((game) => {
        if (data.boardState) {
            game.resume(ctx, {
                symbol: data.symbol,
                boardState: data.boardState,
                isMyTurn: data.isMyTurn,
                round: data.round,
                over: data.over
            });
        } else {
            state.started = false;
            els.status.textContent = '';
            els.info.textContent = '已回到房间，等待对手...';
            els.restartBtn.disabled = true;
            game.renderWaiting(ctx);
            setWaitingPlayer(data.symbol === 'black' ? 'black' : 'white', state.myUsername, state.myScore);
        }
    });
});

socket.on('opponentLeft', () => {
    els.status.textContent = '对手离开了房间';
    els.info.textContent = '等待新对手加入...';
    els.restartBtn.disabled = true;
    els.restartConfirm.style.display = 'none';
    const mine = els.playerBlack.classList.contains('me') ? els.playerBlack : els.playerWhite;
    const other = mine === els.playerBlack ? els.playerWhite : els.playerBlack;
    other.querySelector('.player-name').textContent = '';
    other.querySelector('.player-score').textContent = '';
    const sym = other.querySelector('.player-sym');
    sym.className = 'player-sym';
    sym.textContent = '';
});

socket.on('leftRoom', () => {
    state.activeGame = null;
    state.roomId = null;
    clearSavedRoom();
    resetPlayersBar();
    showView('lobby');
    socket.emit('getRooms');
});

/* ---------- 用户管理(GM) ---------- */
let adminUsers = [];

function loadAdminUsers() {
    socket.emit('adminListUsers', (res) => {
        if (res.ok) {
            adminUsers = res.users;
            renderAdminTable();
        } else {
            els.adminError.textContent = res.msg;
        }
    });
}

function renderAdminTable() {
    els.adminTbody.innerHTML = '';
    if (!adminUsers.length) {
        els.adminTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#a9d3ff;">暂无用户</td></tr>';
        return;
    }
    adminUsers.forEach((u) => {
        const tr = document.createElement('tr');
        const actions = u.gm
            ? '<span style="color:#a9d3ff;">不可操作</span>'
            : `<button class="small" data-action="pwd" data-user="${escapeHtml(u.username)}">改密</button>
               <button class="small" data-action="score" data-user="${escapeHtml(u.username)}">改分</button>
               <button class="small danger" data-action="del" data-user="${escapeHtml(u.username)}">删除</button>`;
        tr.innerHTML = `
            <td>${escapeHtml(u.username)}${u.gm ? ' <span class="game-badge">GM</span>' : ''}</td>
            <td class="admin-pwd">${u.gm ? '••••••' : escapeHtml(u.password)}</td>
            <td>${u.score}</td>
            <td class="admin-actions">${actions}</td>
        `;
        els.adminTbody.appendChild(tr);
    });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

els.adminBtn.addEventListener('click', () => {
    showView('admin');
    els.adminInfo.textContent = '共 ' + adminUsers.length + ' 位用户';
    els.adminError.textContent = '';
    loadAdminUsers();
});

els.adminBackBtn.addEventListener('click', () => {
    showView('lobby');
});

let adminModalAction = null;
let adminModalUser = null;

function openAdminModal(title) {
    els.adminModalTitle.textContent = title;
    els.adminModalInput.value = '';
    const isConfirm = adminModalAction === 'del';
    els.adminModalInput.style.display = isConfirm ? 'none' : '';
    els.adminModal.style.display = 'block';
    if (!isConfirm) els.adminModalInput.focus();
}

function closeAdminModal() {
    els.adminModal.style.display = 'none';
    adminModalAction = null;
    adminModalUser = null;
}

els.adminModalOk.addEventListener('click', () => {
    if (!adminModalAction) return;
    const user = adminModalUser;
    const val = els.adminModalInput.value.trim();
    const action = adminModalAction;
    closeAdminModal();
    if (action === 'pwd') {
        if (!val) { els.adminError.textContent = '密码不能为空'; return; }
        socket.emit('adminSetPassword', { username: user, password: val }, (res) => {
            els.adminError.textContent = res.ok ? '' : res.msg;
            if (res.ok) loadAdminUsers();
        });
    } else if (action === 'score') {
        if (!/^-?\d+$/.test(val)) { els.adminError.textContent = '积分须为整数'; return; }
        socket.emit('adminSetScore', { username: user, score: val }, (res) => {
            els.adminError.textContent = res.ok ? '' : res.msg;
            if (res.ok) loadAdminUsers();
        });
    } else if (action === 'del') {
        socket.emit('adminDeleteUser', { username: user }, (res) => {
            els.adminError.textContent = res.ok ? '' : res.msg;
            if (res.ok) loadAdminUsers();
        });
    }
});

els.adminModalCancel.addEventListener('click', closeAdminModal);

els.adminModalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.adminModalOk.click();
});

els.adminTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const user = btn.dataset.user;
    const action = btn.dataset.action;
    if (action === 'pwd') {
        adminModalAction = 'pwd';
        adminModalUser = user;
        openAdminModal('为用户 ' + user + ' 设置新密码');
    } else if (action === 'score') {
        adminModalAction = 'score';
        adminModalUser = user;
        openAdminModal('为用户 ' + user + ' 设置新积分');
    } else if (action === 'del') {
        adminModalAction = 'del';
        adminModalUser = user;
        openAdminModal('确定删除用户 ' + user + ' 吗？');
    }
});

showView('auth');
