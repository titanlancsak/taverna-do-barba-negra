const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const notifToken = localStorage.getItem('taverna_token');

if (notifToken) {
  initNotifications();
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (err) {
    console.error('Could not play notification sound:', err);
  }
}

function initNotifications() {
  const nav = document.querySelector('header nav');
  if (!nav) return;

  const bellWrapper = document.createElement('div');
  bellWrapper.id = 'notif-bell-wrapper';
  bellWrapper.innerHTML = `
    <button id="notif-bell-btn">🔔<span id="notif-badge" style="display:none;">0</span></button>
    <div id="notif-dropdown" style="display:none;">
      <div id="notif-dropdown-header">
        <span>Notifications</span>
        <button id="notif-mark-all-read">Mark all read</button>
      </div>
      <div id="notif-list"></div>
    </div>
  `;
  nav.appendChild(bellWrapper);

  const bellBtn = document.getElementById('notif-bell-btn');
  const dropdown = document.getElementById('notif-dropdown');
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notif-list');
  const markAllBtn = document.getElementById('notif-mark-all-read');

  function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateBadge(count) {
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  async function loadNotifications() {
    try {
      const response = await fetch(`${API_BASE}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${notifToken}` }
      });
      const data = await response.json();

      updateBadge(data.unreadCount);

      if (!data.notifications.length) {
        list.innerHTML = '<p class="notif-empty">No notifications yet.</p>';
        return;
      }

      list.innerHTML = data.notifications.map(n => `
        <div class="notif-item ${n.read_at ? '' : 'unread'}" data-id="${n.id}">
          <div class="notif-message">${escapeHtml(n.message)}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      `).join('');

      list.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', () => markAsRead(item.dataset.id, item));
      });
    } catch (err) {
      list.innerHTML = '<p class="notif-empty">Failed to load notifications.</p>';
    }
  }

  async function markAsRead(id, itemEl) {
    if (!itemEl.classList.contains('unread')) return;
    itemEl.classList.remove('unread');

    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${notifToken}` }
      });
      const currentBadge = parseInt(badge.textContent) || 0;
      updateBadge(Math.max(0, currentBadge - 1));
    } catch (err) {
      console.error(err);
    }
  }

  markAllBtn.addEventListener('click', async () => {
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${notifToken}` }
      });
      document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
      updateBadge(0);
    } catch (err) {
      console.error(err);
    }
  });

  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display === 'block';
    dropdown.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) loadNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!bellWrapper.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Conecta ao socket global (se já não tiver uma conexão ativa na página, como no chat)
  if (typeof io !== 'undefined') {
    const notifSocket = window.__tavernaSocket || io(API_BASE || window.location.origin, { auth: { token: notifToken } });
    window.__tavernaSocket = notifSocket;

    notifSocket.on('new_notification', (notification) => {
      playNotificationSound();
      const currentBadge = parseInt(badge.textContent) || 0;
      updateBadge(currentBadge + 1);
    });
  }

  loadNotifications();
}
