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
const removePictureBtn = document.getElementById('remove-picture-btn');
const DEFAULT_PICTURE = '../assets/profile-pictures/default.png';

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
    statusMessage.textContent = 'プロフィールの読み込みに失敗しました。';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const displayName = document.getElementById('display-name-input').value;
  const isAnonymous = document.getElementById('anonymous-checkbox').checked;
  const course = document.getElementById('course-input').value;
  const gender = document.getElementById('gender-select').value;

  statusMessage.textContent = '保存中...';

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
      throw new Error(data.error || 'プロフィールの保存に失敗しました');
    }

    statusMessage.textContent = 'プロフィールを保存しました！';
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});

uploadBtn.addEventListener('click', async () => {
  if (!pictureInput.files.length) {
    statusMessage.textContent = 'まず画像を選択してください。';
    return;
  }

  const formData = new FormData();
  formData.append('picture', pictureInput.files[0]);

  statusMessage.textContent = '写真をアップロード中...';

  try {
    const response = await fetch(`${API_BASE}/api/profile/picture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '写真のアップロードに失敗しました');
    }

    profilePreview.src = `..${data.profilePictureUrl}`;
    statusMessage.textContent = 'プロフィール写真を更新しました！';
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});

removePictureBtn.addEventListener('click', async () => {
  if (!confirm('プロフィール写真を削除しますか？')) return;

  statusMessage.textContent = '写真を削除中...';

  try {
    const response = await fetch(`${API_BASE}/api/profile/picture`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '写真の削除に失敗しました');
    }

    profilePreview.src = DEFAULT_PICTURE;
    pictureInput.value = '';
    statusMessage.textContent = 'プロフィール写真を削除しました。';
  } catch (err) {
    statusMessage.textContent = err.message;
  }
});

loadProfile();

// --- Exclusão de conta ---
const deleteBtn = document.getElementById('delete-account-btn');
const deleteConfirm = document.getElementById('delete-confirm');
const deletePassword = document.getElementById('delete-password');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteStatus = document.getElementById('delete-status');

deleteBtn.addEventListener('click', () => {
  deleteConfirm.style.display = 'block';
  deleteBtn.style.display = 'none';
  deleteStatus.textContent = '';
  deletePassword.focus();
});

deleteCancelBtn.addEventListener('click', () => {
  deleteConfirm.style.display = 'none';
  deleteBtn.style.display = 'inline-block';
  deletePassword.value = '';
  deleteStatus.textContent = '';
});

deleteConfirmBtn.addEventListener('click', async () => {
  const password = deletePassword.value;
  if (!password) {
    deleteStatus.textContent = 'パスワードを入力してください。';
    return;
  }

  deleteConfirmBtn.disabled = true;
  deleteStatus.textContent = '削除中...';

  try {
    const response = await fetch(`${API_BASE}/api/auth/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '削除に失敗しました');
    }

    localStorage.removeItem('taverna_token');
    localStorage.removeItem('taverna_user');
    deleteStatus.textContent = data.message;
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
  } catch (err) {
    deleteStatus.textContent = err.message;
    deleteConfirmBtn.disabled = false;
  }
});
