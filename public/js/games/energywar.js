const MAX_HP = 3;
const MAX_ENERGY = 3;
const ROUND_SECONDS = 20;
const ACTION_NAMES = { gather: '聚气', block: '格挡', fire: '发射', heal: '治疗' };

let ctx, mySymbol, oppSymbol, hp, energy, picks, gameActive, paused, selected, log;
let timeLeft, countdown; 
function startCountdown() {
    clearInterval(countdown);
    timeLeft = ROUND_SECONDS;
    countdown = setInterval(() => {
        timeLeft--;
        if (timeLeft < 0) timeLeft = 0;
        updateUI();
    }, 1000);
}
function stopCountdown() {
    clearInterval(countdown);
    countdown = null;
}

function colorName(color) {
    if (!mySymbol) return color === 'black' ? '黑方' : '白方';
    return color === mySymbol ? '你' : (color === 'black' ? '黑方' : '白方');
}

function persp(color) {
    if (!mySymbol) return color === 'black' ? '黑方' : '白方';
    return color === mySymbol ? '你' : '对方';
}

function eventText(ev) {
    const who = persp(ev.color);
    switch (ev.type) {
        case 'gather': return `${who} 聚气 +1能量`;
        case 'gatherInterrupted': return `${who} 聚气被打断`;
        case 'burst': return `${who} 能量爆发！${persp(ev.target)} -${ev.dmg}`;
        case 'fire': return `${who} 发射，${persp(ev.target)} -${ev.dmg}`;
        case 'fireBlocked': return `${who} 发射被格挡`;
        case 'heal': return `${who} 治疗 +1血`;
        case 'healInterrupted': return `${who} 治疗被打断`;
        case 'noEnergy': return `${who} 能量不足`;
        case 'timeout': return `${who} 超时，自动格挡`;
        default: return '';
    }
}

function render() {
    ctx.board.classList.remove('board-gomoku', 'board-tictactoe', 'board-erdayi');
    ctx.board.classList.add('ew-board');
    const panel = (color) => {
        const mine = color === mySymbol;
        let hearts = '';
        for (let i = 0; i < MAX_HP; i++) hearts += `<span class="ew-heart${i < hp[color] ? ' on' : ''}"></span>`;
        let segs = '';
        for (let i = 0; i < MAX_ENERGY; i++) segs += `<span class="ew-seg${i < energy[color] ? ' on' : ''}"></span>`;
        return `<div class="ew-panel${mine ? ' me' : ''}" data-color="${color}">
            <div class="ew-name">${colorName(color)}${mine ? '（你）' : ''}</div>
            <div class="ew-hp-row"><span class="ew-label">血量</span>${hearts}</div>
            <div class="ew-en-row"><span class="ew-label">能量</span>${segs}</div>
        </div>`;
    };
    const btns = [
        ['gather', '聚气', '+1能量'],
        ['block', '格挡', '挡发射'],
        ['fire', '发射', '耗1能量'],
        ['heal', '治疗', '不耗能量']
    ].map(([a, name, tip]) => {
        const disabled = !gameActive || paused || selected || (a === 'fire' && energy[mySymbol] < 1);
        const sel = selected === a ? ' selected' : '';
        return `<button class="ew-btn${sel}" data-action="${a}" ${disabled ? 'disabled' : ''}>${name}<small>${tip}</small></button>`;
    }).join('');
    ctx.board.innerHTML = `
        <div class="ew-panels">${panel('black')}<div class="ew-vs">VS</div>${panel('white')}</div>
        <div class="ew-actions">${btns}</div>`;
    ctx.board.querySelectorAll('.ew-btn').forEach(b => b.addEventListener('click', () => pick(b.dataset.action)));
}

function updateUI() {
    if (!gameActive) return;
    if (paused) {
        ctx.status.innerHTML = '等待对方重连（10 秒）...';
        return;
    }
    const cd = timeLeft > 0 ? `（剩余 ${timeLeft} 秒）` : '';
    ctx.status.innerHTML = selected ? `已选择，等待对方行动${cd}...` : `请选择你的技能${cd}`;
}

function pick(action) {
    if (!gameActive || paused || selected) return;
    if (action === 'fire' && energy[mySymbol] < 1) return;
    selected = action;
    ctx.socket.emit('energyPick', { roomId: ctx.getRoomId(), action });
    render();
    updateUI();
}

function fxPanel(color) {
    return ctx.board.querySelector(`.ew-panel[data-color="${color}"]`);
}

function fxCenter(color) {
    const p = fxPanel(color);
    if (!p) return null;
    const b = ctx.board.getBoundingClientRect();
    const r = p.getBoundingClientRect();
    return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
}

function addFx(el, ms) {
    ctx.board.appendChild(el);
    setTimeout(() => el.remove(), ms || 1200);
}

function fxGather(color) {
    const c = fxCenter(color);
    if (!c) return;
    for (let i = 0; i < 8; i++) {
        const s = document.createElement('div');
        s.className = 'ew-fx-spark gather';
        const ang = (i / 8) * Math.PI * 2;
        const rad = 52;
        const sx = c.x + Math.cos(ang) * rad;
        const sy = c.y + Math.sin(ang) * rad;
        s.style.left = sx + 'px';
        s.style.top = sy + 'px';
        s.style.setProperty('--tx', (c.x - sx) + 'px');
        s.style.setProperty('--ty', (c.y - sy) + 'px');
        s.style.animationDelay = (i * 0.12) + 's';
        addFx(s, 1800);
    }
}

function fxHeal(color) {
    const p = fxPanel(color);
    if (!p) return;
    const c = fxCenter(color);
    for (let i = 0; i < 10; i++) {
        const s = document.createElement('div');
        s.className = 'ew-fx-spark heal';
        s.style.left = (c.x + (Math.random() * 50 - 25)) + 'px';
        s.style.top = (c.y + (Math.random() * 30 - 15)) + 'px';
        s.style.setProperty('--drift', (Math.random() * 40 - 20) + 'px');
        s.style.animationDelay = (i * 0.12) + 's';
        addFx(s, 2000);
    }
    const glow = document.createElement('div');
    glow.className = 'ew-fx-healglow';
    p.appendChild(glow);
    setTimeout(() => glow.remove(), 1600);
}

function fxFire(from, to) {
    const a = fxCenter(from), b = fxCenter(to);
    if (!a || !b) return;
    const bolt = document.createElement('div');
    bolt.className = 'ew-fx-bolt';
    bolt.style.left = a.x + 'px';
    bolt.style.top = a.y + 'px';
    bolt.style.setProperty('--dx', (b.x - a.x) + 'px');
    bolt.style.setProperty('--dy', (b.y - a.y) + 'px');
    addFx(bolt, 900);
    setTimeout(() => fxImpact(to), 560);
}

function fxFireBlocked(from, to) {
    const a = fxCenter(from), b = fxCenter(to);
    if (!a || !b) return;
    const dx = (b.x - a.x) * 0.72;
    const dy = (b.y - a.y) * 0.72;
    const bolt = document.createElement('div');
    bolt.className = 'ew-fx-bolt';
    bolt.style.left = a.x + 'px';
    bolt.style.top = a.y + 'px';
    bolt.style.setProperty('--dx', dx + 'px');
    bolt.style.setProperty('--dy', dy + 'px');
    addFx(bolt, 800);
    setTimeout(() => {
        const shield = document.createElement('div');
        shield.className = 'ew-fx-shield';
        shield.style.left = (a.x + dx) + 'px';
        shield.style.top = (a.y + dy) + 'px';
        addFx(shield, 1100);
        const spark = document.createElement('div');
        spark.className = 'ew-fx-impact';
        spark.style.left = (a.x + dx) + 'px';
        spark.style.top = (a.y + dy) + 'px';
        addFx(spark, 700);
    }, 520);
}

function fxImpact(color) {
    const c = fxCenter(color);
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'ew-fx-impact';
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    addFx(el, 900);
}

function fxBurst(color) {
    const c = fxCenter(color);
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'ew-fx-burst';
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    addFx(el, 1000);
}

function fxShield(color) {
    const c = fxCenter(color);
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'ew-fx-shield';
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    addFx(el, 1100);
}

function fxInterrupted(color) {
    const p = fxPanel(color);
    if (!p) return;
    p.classList.remove('ew-shake');
    void p.offsetWidth;
    p.classList.add('ew-shake');
    const flash = document.createElement('div');
    flash.className = 'ew-fx-flash';
    p.appendChild(flash);
    setTimeout(() => {
        flash.remove();
        p.classList.remove('ew-shake');
    }, 1100);
}

function fxTimeout(color) {
    const c = fxCenter(color);
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'ew-fx-timeout';
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    el.textContent = '超时';
    addFx(el, 1500);
}

function playEffects(events) {
    for (const ev of events || []) {
        switch (ev.type) {
            case 'gather': fxGather(ev.color); break;
            case 'heal': fxHeal(ev.color); break;
            case 'fire': fxFire(ev.color, ev.target); break;
            case 'fireBlocked': fxFireBlocked(ev.color, ev.target); break;
            case 'burst': fxBurst(ev.target); break;
            case 'gatherInterrupted':
            case 'healInterrupted': fxInterrupted(ev.color); break;
            case 'timeout': fxTimeout(ev.color); break;
        }
    }
}

export default {
    key: 'energywar',
    name: '能量战',

    init(c, symbol, round) {
        ctx = c;
        mySymbol = symbol;
        oppSymbol = symbol === 'black' ? 'white' : 'black';
        hp = { black: MAX_HP, white: MAX_HP };
        energy = { black: 0, white: 0 };
        picks = {};
        selected = null;
        log = [];
        gameActive = true;
        paused = false;
        render();
        startCountdown();
        updateUI();
        ctx.restartBtn.disabled = false;
        ctx.info.textContent = `第 ${round} 局，血量 ${MAX_HP}，能量上限 ${MAX_ENERGY}，每回合 ${ROUND_SECONDS} 秒`;
    },

    renderWaiting(c) {
        ctx = c;
        mySymbol = null;
        hp = { black: MAX_HP, white: MAX_HP };
        energy = { black: 0, white: 0 };
        gameActive = false;
        paused = false;
        selected = null;
        render();
    },

    resume(c, data) {
        ctx = c;
        mySymbol = data.symbol;
        oppSymbol = data.symbol === 'black' ? 'white' : 'black';
        if (data.energyState) {
            hp = data.energyState.hp;
            energy = data.energyState.energy;
            picks = data.energyState.picks || {};
        } else {
            hp = { black: MAX_HP, white: MAX_HP };
            energy = { black: 0, white: 0 };
            picks = {};
        }
        selected = Object.keys(picks).includes(mySymbol) ? picks[mySymbol] : null;
        gameActive = !data.over;
        paused = false;
        render();
        startCountdown();
        updateUI();
        ctx.restartBtn.disabled = false;
    },

    setPaused(p) {
        paused = p;
        updateUI();
    },

    onOpponentMove(c, data) {
        ctx = c;
    },

    onOpponentGameOver(c, data) {
        ctx = c;
    },

    onEnergyResolve(c, data) {
        ctx = c;
        hp = data.hp;
        energy = data.energy;
        picks = data.picks || {};
        selected = null;
        gameActive = !data.winner;
        paused = false;
        render();
        playEffects(data.events);

        const lines = [];
        const myPick = ACTION_NAMES[picks[mySymbol]] || '?';
        const oppPick = ACTION_NAMES[picks[oppSymbol]] || '?';
        lines.push(`你【${myPick}】 对方【${oppPick}】`);
        (data.events || []).forEach(ev => lines.push(eventText(ev)));
        ctx.status.innerHTML = lines.join('<br>');
        if (!data.winner) startCountdown();

        if (data.winner) {
            stopCountdown();
            ctx.restartBtn.disabled = false;
            if (data.winner === 'draw') {
                ctx.status.innerHTML += '<br><b>平局！</b>';
                ctx.info.textContent = '双方同时阵亡，积分不变';
            } else if (data.winner === mySymbol) {
                ctx.status.innerHTML += '<br><b>你赢了！</b>';
                ctx.info.textContent = '对手血量归零，积分 +10';
            } else {
                ctx.status.innerHTML += '<br><b>你输了</b>';
                ctx.info.textContent = '你的血量归零，积分 -10';
            }
        }
    },

    onEnergyReset(c) {
        ctx = c;
        selected = null;
        picks = {};
        render();
        startCountdown();
        updateUI();
    },

    updateUI(c) {
        ctx = c;
        updateUI();
    }
};
