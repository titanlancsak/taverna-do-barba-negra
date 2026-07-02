const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

const token = localStorage.getItem('taverna_token');

if (!token) {
  window.location.href = 'login.html';
}

const form = document.getElementById('profile-form');
const statusMessage = document.getElementById('status-message');
const profilePreview = document.getElementById('profile-preview');
const pictureInput = document.getElementById('picture-input');
const uploadBtn = document.getElementById('upload-picture-btn');

async function loadProfile() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      localStorage.removeItem('taverna_token');
      localStorage.removeItem('taverna_user');
      window.location.href = 'login.html';
      return;
    }

    const data = await response.json();
    const user = data.user;

    document.getElementById('display-name-input').value = user.display_name || '';
    document.getElementById('anonymous-checkbox').checked = user.is_anonymous;
    document.getElementById('course-input').value = user.course || '';
    document.getElementById('gender-select').value = user.gender || '';

    if (user.profile_picture_url) {
      profilePreview.src = `..${user.profile_picture_url}`;
    }
  } catch (err) {
    console.error(err);
    statusMessage.textContent = 'Failed to load profile.';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const displayName = document.getElementById('display-name-input').value;
  const isAnonymous = document.getElementById('anonymous-checkbox').checked;
  const course = document.getElementById('course-input').value;
  const gender = document.getElementById('gender-select').value;

  statusMessage.textContent = 'Saving...';

  try {
    const response = await fetch(`${API_BASE}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ displayName, isAnonymous, course, gender })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to save profile');
    }

    statusMessage.textContent = 'Profile saved!';
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});

uploadBtn.addEventListener('click', async () => {
  if (!pictureInput.files.length) {
    statusMessage.textContent = 'Please choose an image first.';
    return;
  }

  const formData = new FormData();
  formData.append('picture', pictureInput.files[0]);

  statusMessage.textContent = 'Uploading picture...';

  try {
    const response = await fetch(`${API_BASE}/api/profile/picture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload picture');
    }

    profilePreview.src = `..${data.profilePictureUrl}`;
    statusMessage.textContent = 'Profile picture updated!';
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});

loadProfile();
