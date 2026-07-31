const SIZE = 15;
let ctx, boardState, mySymbol, isMyTurn, gameActive, cells;

function inBoard(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function checkWin(r, c) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
        let count = 1;
        const line = [[r, c]];
        for (const s of [1, -1]) {
            let rr = r + dr * s, cc = c + dc * s;
            while (inBoard(rr, cc) && boardState[rr][cc] === boardState[r][c]) {
                count++;
                line.push([rr, cc]);
                rr += dr * s; cc += dc * s;
            }
        }
        if (count >= 5) return line;
    }
    return null;
}

function highlightWinLine(line) {
    line.forEach(([rr, cc]) => {
        const idx = rr * SIZE + cc;
        if (cells[idx]) cells[idx].classList.add('tt-win');
    });
}

function boardFull() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (!boardState[r][c]) return false;
        }
    }
    return true;
}

function renderBoard() {
    ctx.board.style.setProperty('--n', SIZE);
    ctx.board.style.width = 'min(560px, calc(100vw - 24px))';
    ctx.board.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => handleCellClick(r, c));
            if (boardState[r][c]) {
                const s = document.createElement('div');
                s.className = 'stone ' + boardState[r][c];
                cell.appendChild(s);
            } else {
                cell.classList.add('gomoku-cell');
                if (isMyTurn && gameActive) cell.classList.add('hint');
            }
            ctx.board.appendChild(cell);
        }
    }
    cells = ctx.board.querySelectorAll('.cell');
    ctx.countInfo.textContent = '';
}

function updateUI() {
    if (!gameActive) return;
    if (!isMyTurn) {
        ctx.status.innerHTML = '等待对手行动...';
    } else {
        ctx.status.innerHTML = '你的回合';
    }
}

function handleCellClick(r, c) {
    if (!gameActive || !isMyTurn) return;
    if (boardState[r][c]) return;
    boardState[r][c] = mySymbol;
    const line = checkWin(r, c);
    renderBoard();
    if (line) {
        gameActive = false; isMyTurn = false;
        highlightWinLine(line);
        ctx.socket.emit('gameOver', { roomId: ctx.getRoomId(), boardState, winner: mySymbol });
        ctx.status.innerHTML = '你赢了！';
        ctx.info.textContent = '连成五子，积分 +10';
        return;
    }
    if (boardFull()) {
        gameActive = false; isMyTurn = false;
        ctx.socket.emit('gameOver', { roomId: ctx.getRoomId(), boardState, winner: 'draw' });
        ctx.status.textContent = '平局！';
        ctx.info.textContent = '棋盘已满，积分不变';
        return;
    }
    isMyTurn = false;
    ctx.socket.emit('move', { roomId: ctx.getRoomId(), boardState });
    updateUI();
}

export default {
    key: 'gomoku',
    name: '五子棋',

    init(c, symbol, round) {
        ctx = c;
        mySymbol = symbol;
        isMyTurn = (mySymbol === 'black');
        gameActive = true;
        boardState = Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
        renderBoard();
        updateUI();
        ctx.restartBtn.disabled = false;
    },

    renderWaiting(c) {
        ctx = c;
        boardState = Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
        gameActive = false;
        isMyTurn = false;
        renderBoard();
    },

    onOpponentMove(c, data) {
        ctx = c;
        boardState = data.boardState;
        isMyTurn = true;
        renderBoard();
        updateUI();
    },

    onOpponentGameOver(c, data) {
        ctx = c;
        boardState = data.boardState;
        gameActive = false;
        isMyTurn = false;
        renderBoard();
        if (data.winner === 'draw') {
            ctx.status.textContent = '平局！';
            ctx.info.textContent = '棋盘已满，积分不变';
            return;
        }
        const oppColor = mySymbol === 'black' ? 'white' : 'black';
        for (let r = 0; r < SIZE; r++) {
            for (let cc = 0; cc < SIZE; cc++) {
                if (boardState[r][cc] === oppColor) {
                    const line = checkWin(r, cc);
                    if (line) { highlightWinLine(line); break; }
                }
            }
        }
        ctx.status.innerHTML = '对手赢了！';
        ctx.info.textContent = '对方连成五子，积分 -10';
    },

    updateUI(c) {
        ctx = c;
        updateUI();
    }
};
