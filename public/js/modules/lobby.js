const GAME_NAMES = { erdayi: '二打一', gomoku: '五子棋', tictactoe: '井字棋' };

let pendingJoin = null;
let enterGame = null;

export function init(app, deps) {
    const socket = app.socket;
    enterGame = deps.enterGame;

    document.getElementById('gameSelect').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-game]');
        if (!btn) return;
        document.querySelectorAll('#gameSelect button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });

    document.getElementById('createRoomBtn').addEventListener('click', () => {
        const id = Number(document.getElementById('newRoomId').value);
        const pwd = document.getElementById('newRoomPwd').value;
        const gameTypeBtn = document.querySelector('#gameSelect button.active');
        const selectedGame = gameTypeBtn ? gameTypeBtn.dataset.game : 'erdayi';
        if (!id || id < 1 || id > 10) {
            document.getElementById('lobbyError').textContent = '请输入 1-10 的房间号';
            return;
        }
        socket.emit('createRoom', { roomId: id, password: pwd, gameType: selectedGame }, (res) => {
            if (res.ok) {
                document.getElementById('lobbyError').textContent = '';
                enterGame(res.roomId, res.gameType, true);
            } else {
                document.getElementById('lobbyError').textContent = res.msg;
            }
        });
    });

    document.getElementById('pwdOkBtn').addEventListener('click', () => {
        const pwd = document.getElementById('pwdInput').value;
        if (pendingJoin) {
            document.getElementById('pwdPanel').style.display = 'none';
            joinRoom(socket, pendingJoin.id, pwd, enterGame);
            pendingJoin = null;
        }
    });

    document.getElementById('pwdCancelBtn').addEventListener('click', () => {
        document.getElementById('pwdPanel').style.display = 'none';
        pendingJoin = null;
    });

    document.getElementById('pwdInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('pwdOkBtn').click();
    });
}

function joinRoom(socket, rid, pwd, enterGame) {
    socket.emit('joinRoom', { roomId: rid, password: pwd }, (res) => {
        if (res.ok) {
            document.getElementById('lobbyError').textContent = '';
            enterGame(res.roomId, res.gameType, false);
        } else {
            document.getElementById('lobbyError').textContent = res.msg;
        }
    });
}

export function renderRooms(app, rooms) {
    const grid = document.getElementById('roomGrid');
    const socket = app.socket;
    grid.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
        const room = rooms.find(r => r.id === i) || { id: i, hasPassword: false, playerCount: 0, players: [] };
        const roomEmpty = room.playerCount === 0;
        const card = document.createElement('div');
        card.className = 'room-card' + (room.hasPassword ? ' locked' : '');
        card.innerHTML = `
            <div class="room-id">房间 ${room.id}<span class="game-badge">${roomEmpty ? '空闲' : (GAME_NAMES[room.gameType] || GAME_NAMES.erdayi)}</span></div>
            <div class="room-state">${room.playerCount}/2 ${room.playerCount === 2 ? '对局中' : (room.hasPassword ? '需密码' : '空闲')}</div>
        `;
        card.addEventListener('click', () => {
            if (room.playerCount >= 2) {
                document.getElementById('lobbyError').textContent = '该房间已满';
                return;
            }
            document.getElementById('lobbyError').textContent = '';
            if (room.hasPassword) {
                document.getElementById('pwdRoomId').textContent = room.id;
                document.getElementById('pwdInput').value = '';
                document.getElementById('pwdPanel').style.display = 'block';
                document.getElementById('pwdInput').focus();
                pendingJoin = { id: room.id };
            } else {
                joinRoom(socket, room.id, '', enterGame);
            }
        });
        grid.appendChild(card);
    }
}
