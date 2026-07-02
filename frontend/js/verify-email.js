const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

const statusMessage = document.getElementById('status-message');
const loginLink = document.getElementById('login-link');

async function verify() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    statusMessage.textContent = 'Missing verification token.';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/verify-email?token=${token}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Verification failed');
    }

    statusMessage.textContent = data.message;
    loginLink.style.display = 'inline-block';
  } catch (err) {
    statusMessage.textContent = err.message;
  }
}

verify();
