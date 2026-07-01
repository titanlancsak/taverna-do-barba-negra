const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

const form = document.getElementById('convert-form');
const statusMessage = document.getElementById('status-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById('audio-input');
  const format = document.getElementById('format-select').value;

  if (!fileInput.files.length) {
    statusMessage.textContent = 'Please select an audio file first.';
    return;
  }

  const formData = new FormData();
  formData.append('audio', fileInput.files[0]);
  formData.append('format', format);

  statusMessage.textContent = 'Converting...';

  try {
    const response = await fetch(`${API_BASE}/api/audio/convert`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Conversion failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    statusMessage.textContent = 'Done! Your download should start automatically.';
  } catch (err) {
    console.error(err);
    statusMessage.textContent = 'Something went wrong. Please try again.';
  }
});
