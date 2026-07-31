const { listUsers, setPassword, setScore, deleteUser } = require('../users');
const config = require('../config');

function isGM(socket) {
    return socket.data.username === config.GM_USERNAME;
}

module.exports = function registerAdmin(io, socket) {
    socket.on('adminListUsers', (cb) => {
        if (!isGM(socket)) return cb && cb({ ok: false, msg: '无权限' });
        cb && cb({ ok: true, users: listUsers() });
    });

    socket.on('adminSetPassword', ({ username, password }, cb) => {
        if (!isGM(socket)) return cb && cb({ ok: false, msg: '无权限' });
        if (!password) return cb && cb({ ok: false, msg: '密码不能为空' });
        if (!setPassword(username, password)) return cb && cb({ ok: false, msg: '用户不存在' });
        cb && cb({ ok: true });
        console.log(`GM 修改密码: ${username}`);
    });

    socket.on('adminSetScore', ({ username, score }, cb) => {
        if (!isGM(socket)) return cb && cb({ ok: false, msg: '无权限' });
        const s = Number(score);
        if (!Number.isFinite(s) || s < 0) return cb && cb({ ok: false, msg: '积分无效' });
        if (!setScore(username, s)) return cb && cb({ ok: false, msg: '用户不存在' });
        cb && cb({ ok: true });
        io.emit('scoreUpdate', { [username]: s });
        console.log(`GM 修改积分: ${username} -> ${s}`);
    });

    socket.on('adminDeleteUser', ({ username }, cb) => {
        if (!isGM(socket)) return cb && cb({ ok: false, msg: '无权限' });
        if (username === config.GM_USERNAME) return cb && cb({ ok: false, msg: '不能删除GM账号' });
        if (!deleteUser(username)) return cb && cb({ ok: false, msg: '用户不存在或为GM账号' });
        cb && cb({ ok: true });
        console.log(`GM 删除用户: ${username}`);
    });
};
