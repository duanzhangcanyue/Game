const MAX_HP = 3;
const MAX_ENERGY = 3;

function newState() {
    return { hp: { black: MAX_HP, white: MAX_HP }, energy: { black: 0, white: 0 }, picks: {} };
}

function resolve(state) {
    const { hp, energy, picks } = state;
    const events = [];
    const colors = ['black', 'white'];
    const injured = { black: false, white: false };

    for (const c of colors) {
        const target = c === 'black' ? 'white' : 'black';
        if (picks[c] === 'fire') {
            if (energy[c] >= 1) {
                energy[c] -= 1;
                if (picks[target] === 'block') {
                    events.push({ color: c, type: 'fireBlocked', target });
                } else {
                    hp[target] -= 1;
                    injured[target] = true;
                    events.push({ color: c, type: 'fire', target, dmg: 1 });
                }
            } else {
                events.push({ color: c, type: 'noEnergy' });
            }
        }
    }

    for (const c of colors) {
        if (picks[c] === 'gather') {
            if (injured[c]) {
                events.push({ color: c, type: 'gatherInterrupted' });
            } else {
                energy[c] = Math.min(MAX_ENERGY, energy[c] + 1);
                events.push({ color: c, type: 'gather' });
            }
        }
    }

    for (const c of colors) {
        if (energy[c] >= MAX_ENERGY) {
            energy[c] = 0;
            const target = c === 'black' ? 'white' : 'black';
            hp[target] -= 2;
            injured[target] = true;
            events.push({ color: c, type: 'burst', target, dmg: 2 });
        }
    }

    for (const c of colors) {
        if (picks[c] === 'heal') {
            if (injured[c]) {
                events.push({ color: c, type: 'healInterrupted' });
            } else if (energy[c] >= 1) {
                energy[c] -= 1;
                hp[c] = Math.min(MAX_HP, hp[c] + 1);
                events.push({ color: c, type: 'heal' });
            } else {
                events.push({ color: c, type: 'noEnergy' });
            }
        }
    }

    hp.black = Math.max(0, hp.black);
    hp.white = Math.max(0, hp.white);

    let winner = null;
    if (hp.black <= 0 && hp.white <= 0) winner = 'draw';
    else if (hp.black <= 0) winner = 'white';
    else if (hp.white <= 0) winner = 'black';

    return { winner, events };
}

module.exports = { newState, resolve, MAX_HP, MAX_ENERGY };
