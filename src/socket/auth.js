const { users, saveUsers, hashPwd } = require('../users');
const config = require('../config');

module.exports = function registerAuth(io, socket) {
    socket.on('register', ({ username, password }, cb) => {
        if (!username || !password) return cb && cb({ ok: false, msg: '用户名和密码不能为空' });
        if (users[username]) return cb && cb({ ok: false, msg: '用户名已被占用' });
        if (!/^[\w\u4e00-\u9fa5]{2,16}$/.test(username)) return cb && cb({ ok: false, msg: '用户名需为2-16位字母/数字/下划线/中文' });
        users[username] = { username, password: hashPwd(password), score: config.START_SCORE };
        saveUsers();
        socket.data.username = username;
        cb && cb({ ok: true, username, score: config.START_SCORE });
        console.log(`用户注册: ${username}`);
    });

    socket.on('login', ({ username, password }, cb) => {
        const u = users[username];
        if (!u) return cb && cb({ ok: false, msg: '用户名不存在' });
        if (u.password !== hashPwd(password)) return cb && cb({ ok: false, msg: '密码错误' });
        socket.data.username = username;
        cb && cb({ ok: true, username, score: u.score });
        console.log(`用户登录: ${username}`);
    });
};
