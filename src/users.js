const fs = require('fs');
const crypto = require('crypto');
const config = require('./config');

let users = {};
try {
    users = JSON.parse(fs.readFileSync(config.USERS_FILE, 'utf8'));
} catch (e) {
    users = {};
}

function saveUsers() {
    fs.writeFileSync(config.USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPwd(pwd) {
    return crypto.createHash('sha256').update('erdayi_salt_' + pwd).digest('hex');
}

function getScore(username) {
    return users[username] ? users[username].score : 0;
}

function ensureGM() {
    if (!users[config.GM_USERNAME]) {
        users[config.GM_USERNAME] = {
            username: config.GM_USERNAME,
            password: hashPwd(config.GM_PASSWORD),
            plain: config.GM_PASSWORD,
            score: 0,
            gm: true
        };
        saveUsers();
        console.log(`GM 账号已创建: ${config.GM_USERNAME}`);
    }
}

function listUsers() {
    return Object.values(users).map(u => ({
        username: u.username,
        password: u.plain || u.password || '',
        score: u.score,
        gm: !!u.gm
    }));
}

function setPassword(username, newPwd) {
    if (!users[username]) return false;
    users[username].password = hashPwd(newPwd);
    users[username].plain = newPwd;
    saveUsers();
    return true;
}

function setScore(username, score) {
    if (!users[username]) return false;
    users[username].score = score;
    saveUsers();
    return true;
}

function deleteUser(username) {
    if (!users[username]) return false;
    if (users[username].gm) return false;
    delete users[username];
    saveUsers();
    return true;
}

module.exports = { users, saveUsers, hashPwd, getScore, ensureGM, listUsers, setPassword, setScore, deleteUser };
