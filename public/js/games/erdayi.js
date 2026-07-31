const SIZE = 4;
let ctx, boardState, mySymbol, isMyTurn, gameActive, paused, selected, cells;

function inBoard(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function countOnRow(r) {
    let n = 0;
    for (let c = 0; c < SIZE; c++) if (boardState[r][c]) n++;
    return n;
}

function countOnCol(c) {
    let n = 0;
    for (let r = 0; r < SIZE; r++) if (boardState[r][c]) n++;
    return n;
}

function countPieces(color) {
    let n = 0;
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (boardState[r][c] === color) n++;
        }
    }
    return n;
}

function checkCaptures(me, mr, mc) {
    const opp = me === 'black' ? 'white' : 'black';
    const captures = [];
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    for (const [dr, dc] of dirs) {
        const qr = mr + dr, qc = mc + dc;
        if (!inBoard(qr, qc) || boardState[qr][qc] !== me) continue;
        const lineCount = (dr === 0) ? countOnRow(mr) : countOnCol(mc);
        if (lineCount !== 3) continue;
        const e1r = qr + dr, e1c = qc + dc;
        if (inBoard(e1r, e1c) && boardState[e1r][e1c] === opp) {
            captures.push({ target: [e1r, e1c], attackers: [[mr, mc], [qr, qc]] });
        }
        const e2r = mr - dr, e2c = mc - dc;
        if (inBoard(e2r, e2c) && boardState[e2r][e2c] === opp) {
            captures.push({ target: [e2r, e2c], attackers: [[mr, mc], [qr, qc]] });
        }
    }
    return captures;
}

function updateCounts() {
    let black = 0, white = 0;
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (boardState[r][c] === 'black') black++;
            if (boardState[r][c] === 'white') white++;
        }
    }
    ctx.countInfo.textContent = `黑棋 ×${black}    白棋 ×${white}`;
}

function isValidMoveTarget(r, c) {
    if (!gameActive || paused || !isMyTurn || !selected) return false;
    if (boardState[r][c]) return false;
    return Math.abs(r - selected[0]) + Math.abs(c - selected[1]) === 1;
}

function cellCenter(r, c) {
    const cell = cells[r * SIZE + c];
    const boardRect = ctx.board.getBoundingClientRect();
    const rect = cell.getBoundingClientRect();
    return {
        x: rect.left - boardRect.left + rect.width / 2,
        y: rect.top - boardRect.top + rect.height / 2
    };
}

function addCaptureLine(cap) {
    const boardRect = ctx.board.getBoundingClientRect();
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'capture-line');
    svg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);

    const [tr, tc] = cap.target;
    const target = cellCenter(tr, tc);
    const a1 = cellCenter(cap.attackers[0][0], cap.attackers[0][1]);
    const a2 = cellCenter(cap.attackers[1][0], cap.attackers[1][1]);

    const midX = (a1.x + a2.x) / 2;
    const midY = (a1.y + a2.y) / 2;
    const dx = target.x - midX;
    const dy = target.y - midY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;

    const beam = document.createElementNS(svgNS, 'line');
    beam.setAttribute('class', 'beam');
    beam.setAttribute('x1', midX);
    beam.setAttribute('y1', midY);
    beam.setAttribute('x2', target.x - nx * 20);
    beam.setAttribute('y2', target.y - ny * 20);
    svg.appendChild(beam);

    const arrow = document.createElementNS(svgNS, 'path');
    const as = 16;
    const baseX = target.x - nx * 18;
    const baseY = target.y - ny * 18;
    arrow.setAttribute('class', 'arrow-head');
    arrow.setAttribute('d',
        `M${baseX},${baseY} L${baseX - nx * as + ny * as * 0.6},${baseY - ny * as - nx * as * 0.6} ` +
        `L${baseX - nx * as - ny * as * 0.6},${baseY - ny * as + nx * as * 0.6} Z`);
    svg.appendChild(arrow);

    ctx.board.appendChild(svg);
    setTimeout(() => {
        if (svg.parentNode) svg.parentNode.removeChild(svg);
    }, 1300);
}

function addCaptureEffect(cap, color) {
    const [r, c] = cap.target;
    const cell = cells[r * SIZE + c];
    cell.classList.add('captured');
    addCaptureLine(cap);
    const fx = document.createElement('div');
    fx.className = 'capture-fx';
    const stone = document.createElement('div');
    stone.className = 'stone ' + color;
    const dir = Math.random() < 0.5 ? 1 : -1;
    stone.style.setProperty('--fly-x', (dir * (160 + Math.random() * 120)) + 'px');
    stone.style.setProperty('--fly-y', (-(240 + Math.random() * 100)) + 'px');
    fx.appendChild(stone);
    cell.appendChild(fx);
    setTimeout(() => {
        cell.classList.remove('captured');
        if (fx.parentNode) fx.parentNode.removeChild(fx);
    }, 1150);
}

function renderBoard() {
    ctx.board.classList.remove('board-gomoku', 'board-tictactoe');
    ctx.board.classList.add('board-erdayi');
    ctx.board.style.setProperty('--n', SIZE);
    ctx.board.style.width = 'min(540px, 100%)';
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
            }
            if (selected && selected[0] === r && selected[1] === c) {
                cell.classList.add('selected');
            }
            if (isValidMoveTarget(r, c)) {
                cell.classList.add('valid-move');
            }
            ctx.board.appendChild(cell);
        }
    }
    cells = ctx.board.querySelectorAll('.cell');
    updateCounts();
}

function updateUI() {
    if (!gameActive) return;
    if (paused) {
        ctx.status.innerHTML = '等待对方重连（10 秒）...';
        return;
    }
    if (!isMyTurn) {
        ctx.status.innerHTML = '等待对手行动...';
    } else {
        ctx.status.innerHTML = '你的回合';
    }
}

function handleCellClick(r, c) {
    if (!gameActive || paused || !isMyTurn) return;
    if (boardState[r][c] === mySymbol) {
        selected = [r, c];
        renderBoard();
        return;
    }
    if (isValidMoveTarget(r, c)) {
        const [sr, sc] = selected;
        boardState[r][c] = mySymbol;
        boardState[sr][sc] = '';
        selected = null;
        const captured = checkCaptures(mySymbol, r, c);
        const oppColor = mySymbol === 'black' ? 'white' : 'black';
        captured.forEach((cap) => {
            boardState[cap.target[0]][cap.target[1]] = '';
        });
        renderBoard();
        captured.forEach((cap) => addCaptureEffect(cap, oppColor));

        if (countPieces(mySymbol === 'black' ? 'white' : 'black') <= 1) {
            gameActive = false; isMyTurn = false;
            ctx.socket.emit('gameOver', { roomId: ctx.getRoomId(), boardState, winner: mySymbol, captured });
            ctx.status.innerHTML = '你赢了！';
            ctx.info.textContent = '对手只剩一枚棋子，积分 +10';
            renderBoard();
            return;
        }
        isMyTurn = false;
        ctx.socket.emit('move', { roomId: ctx.getRoomId(), boardState, captured });
        updateUI();
        return;
    }
    selected = null;
    renderBoard();
}

export default {
    key: 'erdayi',
    name: '二打一',

    init(c, symbol, round) {
        ctx = c;
        mySymbol = symbol;
        isMyTurn = (mySymbol === 'black');
        gameActive = true;
        paused = false;
        selected = null;
        boardState = Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
        for (let col = 0; col < SIZE; col++) {
            boardState[0][col] = 'black';
            boardState[SIZE - 1][col] = 'white';
        }
        renderBoard();
        updateUI();
        ctx.restartBtn.disabled = false;
    },

    renderWaiting(c) {
        ctx = c;
        boardState = Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
        gameActive = false;
        isMyTurn = false;
        paused = false;
        selected = null;
        renderBoard();
    },

    resume(c, data) {
        ctx = c;
        mySymbol = data.symbol;
        isMyTurn = data.over ? false : data.isMyTurn;
        gameActive = !data.over;
        paused = false;
        selected = null;
        boardState = data.boardState;
        renderBoard();
        updateUI();
        ctx.restartBtn.disabled = false;
    },

    setPaused(p) {
        paused = p;
        updateUI();
    },

    onOpponentMove(c, data) {
        ctx = c;
        boardState = data.boardState;
        selected = null;
        isMyTurn = true;
        renderBoard();
        if (data.captured) data.captured.forEach((cap) => addCaptureEffect(cap, mySymbol));
        updateUI();
    },

    onOpponentGameOver(c, data) {
        ctx = c;
        boardState = data.boardState;
        selected = null;
        gameActive = false;
        isMyTurn = false;
        renderBoard();
        if (data.captured) data.captured.forEach((cap) => addCaptureEffect(cap, mySymbol));
        ctx.status.innerHTML = '对手赢了！';
        ctx.info.textContent = '你只剩一枚棋子，积分 -10';
    },

    updateUI(c) {
        ctx = c;
        updateUI();
    }
};
