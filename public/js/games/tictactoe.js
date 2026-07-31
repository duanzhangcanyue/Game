const SIZE = 3;
let ctx, boardState, mySymbol, myMark, isMyTurn, gameActive, cells;

const WIN_PATTERNS = [
    [[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]],
    [[0,0],[1,0],[2,0]], [[0,1],[1,1],[2,1]], [[0,2],[1,2],[2,2]],
    [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]]
];

function checkWin() {
    for (const w of WIN_PATTERNS) {
        const [a, b, c] = w;
        if (boardState[a[0]][a[1]] && boardState[a[0]][a[1]] === boardState[b[0]][b[1]] && boardState[a[0]][a[1]] === boardState[c[0]][c[1]]) {
            return w;
        }
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
    ctx.board.classList.remove('board-erdayi', 'board-gomoku');
    ctx.board.classList.add('board-tictactoe');
    ctx.board.style.setProperty('--n', SIZE);
    ctx.board.style.width = 'min(420px, calc(100vw - 44px))';
    ctx.board.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => handleCellClick(r, c));
            if (boardState[r][c]) {
                cell.classList.add('tt-mark', 'tt-disabled', boardState[r][c] === 'X' ? 'tt-x' : 'tt-o');
                cell.textContent = boardState[r][c];
            } else if (isMyTurn && gameActive) {
                cell.classList.add('hint');
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
        ctx.status.innerHTML = '等待对手下棋...';
    } else {
        ctx.status.innerHTML = `你的回合（<span class="${myMark === 'X' ? 'tt-x' : 'tt-o'}">${myMark}</span>）`;
    }
}

function handleCellClick(r, c) {
    if (!gameActive || !isMyTurn) return;
    if (boardState[r][c]) return;
    boardState[r][c] = myMark;
    const line = checkWin();
    renderBoard();
    if (line) {
        gameActive = false; isMyTurn = false;
        highlightWinLine(line);
        ctx.socket.emit('gameOver', { roomId: ctx.getRoomId(), boardState, winner: mySymbol });
        ctx.status.innerHTML = '你赢了！';
        ctx.info.textContent = '三子连线，积分 +10';
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
    key: 'tictactoe',
    name: '井字棋',

    init(c, symbol, round) {
        ctx = c;
        mySymbol = symbol;
        myMark = symbol === 'black' ? 'X' : 'O';
        isMyTurn = (myMark === 'X');
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
        const line = checkWin();
        if (line) highlightWinLine(line);
        ctx.status.innerHTML = '对手赢了！';
        ctx.info.textContent = '对方三子连线，积分 -10';
    },

    updateUI(c) {
        ctx = c;
        updateUI();
    }
};
