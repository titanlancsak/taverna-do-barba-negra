const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const token = localStorage.getItem('taverna_token');
const currentUser = JSON.parse(localStorage.getItem('taverna_user') || 'null');
const ADMIN_EMAIL = 'g024c1025@g.neec.ac.jp';

if (!token) {
  window.location.href = 'login.html';
}
// Só admin acessa esta página
if (!currentUser || (currentUser.email || '').toLowerCase() !== ADMIN_EMAIL) {
  window.location.href = '../index.html';
}

const usersContainer = document.getElementById('admin-users');
const statusEl = document.getElementById('admin-status');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

function formatDate(s) {
  const d = new Date(s);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

async function loadUsers() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '読み込みに失敗しました');

    usersContainer.innerHTML = data.users.map(renderUser).join('');
    usersContainer.querySelectorAll('.admin-ban-btn').forEach((btn) => {
      btn.addEventListener('click', () => setBan(parseInt(btn.dataset.id), btn.dataset.action === 'ban'));
    });
  } catch (err) {
    usersContainer.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

function renderUser(u) {
  const isAdmin = (u.email || '').toLowerCase() === ADMIN_EMAIL;
  const name = u.is_anonymous ? '匿名の海賊' : (u.display_name || '—');
  const statusBadge = u.is_banned
    ? '<span class="admin-badge banned">停止中</span>'
    : '<span class="admin-badge active">有効</span>';
  const adminBadge = isAdmin ? '<span class="admin-badge admin">管理者</span>' : '';

  let actionBtn = '';
  if (!isAdmin) {
    actionBtn = u.is_banned
      ? `<button class="admin-ban-btn unban" data-id="${u.id}" data-action="unban">停止解除</button>`
      : `<button class="admin-ban-btn ban" data-id="${u.id}" data-action="ban">停止</button>`;
  }

  const reasonLine = (u.is_banned && u.ban_reason)
    ? `<div class="admin-user-reason">理由: ${escapeHtml(u.ban_reason)}</div>`
    : '';

  return `
    <div class="admin-user-row ${u.is_banned ? 'is-banned' : ''}">
      <div class="admin-user-info">
        <div class="admin-user-email">${escapeHtml(u.email)} ${adminBadge}${statusBadge}</div>
        <div class="admin-user-meta">
          ${escapeHtml(name)}${u.course ? ' · ' + escapeHtml(u.course) : ''} · 登録: ${formatDate(u.created_at)}${u.email_verified ? '' : ' · 未認証'}
        </div>
        ${reasonLine}
      </div>
      ${actionBtn}
    </div>
  `;
}

async function setBan(id, ban) {
  let reason = null;
  if (ban) {
    reason = prompt('停止の理由（任意）:', '');
    if (reason === null) return; // cancelou
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${id}/${ban ? 'ban' : 'unban'}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: ban ? JSON.stringify({ reason }) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '操作に失敗しました');
    statusEl.textContent = data.message;
    loadUsers();
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

loadUsers();
