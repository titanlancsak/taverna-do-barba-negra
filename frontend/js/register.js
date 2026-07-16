const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

const form = document.getElementById('register-form');
const statusMessage = document.getElementById('status-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email-input').value;
  const password = document.getElementById('password-input').value;

  statusMessage.textContent = 'アカウントを作成中...';

  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '登録に失敗しました');
    }

    statusMessage.textContent = data.message;
    form.reset();
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});
