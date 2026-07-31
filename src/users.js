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

module.exports = { users, saveUsers, hashPwd, getScore };
