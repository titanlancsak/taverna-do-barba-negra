const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const token = localStorage.getItem('taverna_token');

if (!token) {
  window.location.href = 'login.html';
}

const addFriendEmail = document.getElementById('add-friend-email');
const addFriendBtn = document.getElementById('add-friend-btn');
const addFriendStatus = document.getElementById('add-friend-status');
const pendingList = document.getElementById('pending-requests-list');
const friendsList = document.getElementById('friends-list');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadPendingRequests() {
  try {
    const response = await fetch(`${API_BASE}/api/friends/pending`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.requests.length) {
      pendingList.innerHTML = '<p>No pending requests.</p>';
      return;
    }

    pendingList.innerHTML = data.requests.map(r => `
      <div class="request-card">
        <img class="request-pic" src="${r.profile_picture_url ? '..' + r.profile_picture_url : '../assets/default-avatar.svg'}" alt="">
        <div class="request-info">
          <div class="request-name">${escapeHtml(r.display_name)}</div>
        </div>
        <div class="request-actions">
          <button class="accept-btn" data-id="${r.friendship_id}" data-action="accept">Accept</button>
          <button class="decline-btn" data-id="${r.friendship_id}" data-action="decline">Decline</button>
        </div>
      </div>
    `).join('');

    pendingList.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => respondToRequest(btn.dataset.id, btn.dataset.action));
    });
  } catch (err) {
    pendingList.innerHTML = '<p>Failed to load requests.</p>';
  }
}

async function respondToRequest(friendshipId, action) {
  try {
    await fetch(`${API_BASE}/api/friends/respond/${friendshipId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action })
    });
    await loadPendingRequests();
    await loadFriends();
  } catch (err) {
    console.error(err);
  }
}

async function loadFriends() {
  try {
    const response = await fetch(`${API_BASE}/api/friends`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.friends.length) {
      friendsList.innerHTML = '<p>You have no friends yet. Add someone above!</p>';
      return;
    }

    friendsList.innerHTML = data.friends.map(f => `
      <div class="friend-card">
        <img class="friend-pic" src="${f.profile_picture_url ? '..' + f.profile_picture_url : '../assets/default-avatar.svg'}" alt="">
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(f.display_name)}</div>
          ${f.course ? `<div class="friend-course">${escapeHtml(f.course)}</div>` : ''}
        </div>
        <button class="chat-with-friend-btn" data-id="${f.id}" data-name="${escapeHtml(f.display_name)}">Chat</button>
        <button class="remove-friend-btn" data-id="${f.id}">Remove</button>
      </div>
    `).join('');

    friendsList.querySelectorAll('.remove-friend-btn').forEach(btn => {
      btn.addEventListener('click', () => removeFriend(btn.dataset.id));
    });

    friendsList.querySelectorAll('.chat-with-friend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.href = `chat.html?userId=${btn.dataset.id}&name=${encodeURIComponent(btn.dataset.name)}`;
      });
    });
  } catch (err) {
    friendsList.innerHTML = '<p>Failed to load friends.</p>';
  }
}

async function removeFriend(userId) {
  if (!confirm('Remove this friend?')) return;

  try {
    await fetch(`${API_BASE}/api/friends/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await loadFriends();
  } catch (err) {
    console.error(err);
  }
}

addFriendBtn.addEventListener('click', async () => {
  const email = addFriendEmail.value.trim();
  if (!email) return;

  addFriendStatus.textContent = 'Sending request...';

  try {
    const response = await fetch(`${API_BASE}/api/friends/request-by-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Failed to send request');

    addFriendStatus.textContent = 'Friend request sent!';
    addFriendEmail.value = '';
  } catch (err) {
    addFriendStatus.textContent = err.message;
  }
});

loadPendingRequests();
loadFriends();
