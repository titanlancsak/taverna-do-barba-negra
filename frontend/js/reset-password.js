const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

const form = document.getElementById('reset-form');
const statusMessage = document.getElementById('status-message');
const loginLink = document.getElementById('login-link');

const token = new URLSearchParams(window.location.search).get('token');

if (!token) {
  form.style.display = 'none';
  statusMessage.textContent = 'トークンがありません。リンクをもう一度確認してください。';
  loginLink.style.display = 'inline';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = document.getElementById('password-input').value;
  const confirm = document.getElementById('password-confirm').value;

  if (password !== confirm) {
    statusMessage.textContent = 'パスワードが一致しません。';
    return;
  }

  statusMessage.textContent = '再設定中...';

  try {
    const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '再設定に失敗しました');
    }

    statusMessage.textContent = data.message;
    form.style.display = 'none';
    loginLink.style.display = 'inline';
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});
