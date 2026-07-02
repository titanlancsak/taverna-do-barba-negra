const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

const form = document.getElementById('register-form');
const statusMessage = document.getElementById('status-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email-input').value;
  const password = document.getElementById('password-input').value;

  statusMessage.textContent = 'Creating account...';

  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    statusMessage.textContent = data.message;
    form.reset();
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});
