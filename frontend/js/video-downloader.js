const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

const form = document.getElementById('download-form');
const statusMessage = document.getElementById('status-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const url = document.getElementById('url-input').value;
  const type = document.getElementById('type-select').value;

  statusMessage.textContent = 'Downloading... this may take a while.';

  try {
    const response = await fetch(`${API_BASE}/api/download/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, type })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Download failed');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = type === 'audio' ? 'audio.mp3' : 'video.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();

    statusMessage.textContent = 'Done! Your download should start automatically.';
  } catch (err) {
    console.error(err);
    statusMessage.textContent = err.message || 'Something went wrong. Please try again.';
  }
});
