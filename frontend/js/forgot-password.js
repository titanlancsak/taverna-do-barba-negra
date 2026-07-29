const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

const form = document.getElementById('forgot-form');
const statusMessage = document.getElementById('status-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email-input').value;
  statusMessage.textContent = '送信中...';

  try {
    const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '送信に失敗しました');
    }

    // Mensagem genérica (não revela se o e-mail existe)
    statusMessage.textContent = data.message;
    form.reset();
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});
