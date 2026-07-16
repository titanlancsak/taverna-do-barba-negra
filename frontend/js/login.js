const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

const form = document.getElementById('login-form');
const statusMessage = document.getElementById('status-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email-input').value;
  const password = document.getElementById('password-input').value;

  statusMessage.textContent = 'ログイン中...';

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ログインに失敗しました');
    }

    // Salva o token localmente pro navegador lembrar da sessão
    localStorage.setItem('taverna_token', data.token);
    localStorage.setItem('taverna_user', JSON.stringify(data.user));

    statusMessage.textContent = 'ログイン成功！リダイレクトしています...';
    setTimeout(() => {
      window.location.href = '../index.html';
    }, 1000);
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});
