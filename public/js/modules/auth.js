export function init(app, { onAuthSuccess }) {
    const socket = app.socket;

    document.getElementById('loginBtn').addEventListener('click', () => doAuth(socket, 'login', onAuthSuccess));
    document.getElementById('registerBtn').addEventListener('click', () => doAuth(socket, 'register', onAuthSuccess));
    document.getElementById('loginUser').addEventListener('keydown', (e) => { if (e.key === 'Enter') doAuth(socket, 'login', onAuthSuccess); });
    document.getElementById('loginPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doAuth(socket, 'login', onAuthSuccess); });
}

function doAuth(socket, mode, onAuthSuccess) {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const errorEl = document.getElementById('authError');
    if (!username || !password) {
        errorEl.textContent = '请输入用户名和密码';
        return;
    }
    const event = mode === 'login' ? 'login' : 'register';
    socket.emit(event, { username, password }, (res) => {
        if (res.ok) {
            errorEl.textContent = '';
            socket.__authed = true;
            const prev = JSON.parse(localStorage.getItem('ml_session') || '{}');
            localStorage.setItem('ml_session', JSON.stringify({ ...prev, username, password }));
            onAuthSuccess(res.username, res.score);
        } else {
            errorEl.textContent = res.msg;
        }
    });
}
