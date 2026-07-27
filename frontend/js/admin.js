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

// ===== 通報モデレーション =====
const reportsList = document.getElementById('reports-list');
const reportsStatus = document.getElementById('reports-status');
const reportsRefreshBtn = document.getElementById('reports-refresh');

const REASON_LABELS = {
  spam: 'スパム',
  offense: '攻撃的な内容',
  inappropriate: '不適切なコンテンツ',
  other: 'その他'
};
const STATUS_LABELS = {
  pending: '未対応',
  resolved: '対応済み',
  dismissed: '却下'
};
const TARGET_LABELS = { post: '投稿', comment: 'コメント' };

async function loadReports() {
  try {
    const res = await fetch(`${API_BASE}/api/reports`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '読み込みに失敗しました');

    if (!data.reports.length) {
      reportsList.innerHTML = '<p>通報はありません。</p>';
      return;
    }

    reportsList.innerHTML = data.reports.map(renderReport).join('');
    reportsList.querySelectorAll('.report-action-btn').forEach((btn) => {
      btn.addEventListener('click', () => actOnReport(btn.dataset.id, btn.dataset.action));
    });
  } catch (err) {
    reportsList.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

function renderReport(r) {
  const reason = REASON_LABELS[r.reason] || r.reason;
  const statusLabel = STATUS_LABELS[r.status] || r.status;
  const targetLabel = TARGET_LABELS[r.target_type] || r.target_type;

  const content = r.target_content != null
    ? escapeHtml(r.target_content).slice(0, 200)
    : '<em>（削除済み）</em>';
  const author = r.target_author_name
    ? `${escapeHtml(r.target_author_name)} (${escapeHtml(r.target_author_email || '')})`
    : '—';

  const actions = r.status === 'pending'
    ? `<div class="report-actions-row">
         <button class="report-action-btn resolve" data-id="${r.id}" data-action="resolve">対応済みにする</button>
         <button class="report-action-btn dismiss" data-id="${r.id}" data-action="dismiss">却下</button>
       </div>`
    : '';

  return `
    <div class="report-row report-status-${r.status}">
      <div class="report-row-head">
        <span class="report-reason-badge reason-${r.reason}">${reason}</span>
        <span class="report-target-badge">${targetLabel}</span>
        <span class="report-status-badge s-${r.status}">${statusLabel}</span>
        <span class="report-date">${formatDate(r.created_at)}</span>
      </div>
      <div class="report-content">${content}</div>
      <div class="report-meta">投稿者: ${author}</div>
      <div class="report-meta">通報者: ${escapeHtml(r.reporter_name || '匿名')} (${escapeHtml(r.reporter_email || '')})</div>
      ${r.description ? `<div class="report-desc">詳細: ${escapeHtml(r.description)}</div>` : ''}
      ${actions}
    </div>
  `;
}

async function actOnReport(id, action) {
  try {
    const res = await fetch(`${API_BASE}/api/reports/${id}/${action}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '操作に失敗しました');
    reportsStatus.textContent = data.message;
    loadReports();
  } catch (err) {
    reportsStatus.textContent = err.message;
  }
}

if (reportsRefreshBtn) reportsRefreshBtn.addEventListener('click', loadReports);
loadReports();

// ===== ステータスページ（サーバー監視） =====
const statusGrid = document.getElementById('status-grid');
const statusUpdated = document.getElementById('status-updated');
const statusRefreshBtn = document.getElementById('status-refresh');

function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatUptime(sec) {
  if (sec == null) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}日`);
  if (h) parts.push(`${h}時間`);
  parts.push(`${m}分`);
  return parts.join(' ');
}

// Card com bolinha de status (online/offline/unknown)
function dotCard(title, state, detail) {
  const label = state === 'online' ? 'オンライン' : state === 'offline' ? 'オフライン' : '不明';
  return `
    <div class="status-card">
      <div class="status-card-title">${title}</div>
      <div class="status-dot-row">
        <span class="status-dot ${state}"></span>
        <span class="status-dot-label">${label}</span>
      </div>
      ${detail ? `<div class="status-card-detail">${detail}</div>` : ''}
    </div>`;
}

// Card com barra de porcentagem (CPU/RAM/Disco)
function gaugeCard(title, percent, detail) {
  const p = Number.isFinite(percent) ? percent : 0;
  const level = p >= 90 ? 'critical' : p >= 70 ? 'warn' : 'ok';
  return `
    <div class="status-card">
      <div class="status-card-title">${title}</div>
      <div class="status-gauge-value">${Number.isFinite(percent) ? p + '%' : '—'}</div>
      <div class="status-gauge-track"><div class="status-gauge-fill ${level}" style="width:${p}%"></div></div>
      ${detail ? `<div class="status-card-detail">${detail}</div>` : ''}
    </div>`;
}

async function loadStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || '読み込みに失敗しました');

    const cards = [];

    // オンライン人数（一番上に目立たせる）
    cards.push(`
      <div class="status-card highlight">
        <div class="status-card-title">オンラインのユーザー</div>
        <div class="status-online-count">${d.online.users}</div>
        <div class="status-card-detail">接続数: ${d.online.connections}</div>
      </div>`);

    cards.push(dotCard('サーバー', d.server.status,
      `稼働時間: ${formatUptime(d.server.uptimeSeconds)}<br>${escapeHtml(d.server.hostname || '')}`));
    cards.push(dotCard('API', d.api.status, ''));
    cards.push(dotCard('データベース', d.database.status,
      d.database.latencyMs != null ? `応答: ${d.database.latencyMs} ms` : ''));
    cards.push(dotCard('Nginx', d.nginx.status, ''));

    cards.push(gaugeCard('CPU', d.cpu.percent,
      `${d.cpu.cores} コア · 負荷: ${d.cpu.loadAvg1}`));
    cards.push(gaugeCard('RAM', d.ram.percent,
      `${formatBytes(d.ram.usedBytes)} / ${formatBytes(d.ram.totalBytes)}`));
    if (d.disk) {
      cards.push(gaugeCard('ディスク', d.disk.percent,
        `${formatBytes(d.disk.usedBytes)} / ${formatBytes(d.disk.totalBytes)}`));
    } else {
      cards.push(gaugeCard('ディスク', NaN, '取得できません'));
    }

    statusGrid.innerHTML = cards.join('');
    const t = new Date(d.timestamp);
    statusUpdated.textContent = `最終更新: ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`;
  } catch (err) {
    statusGrid.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

if (statusRefreshBtn) statusRefreshBtn.addEventListener('click', loadStatus);
loadStatus();
setInterval(loadStatus, 10000); // atualiza a cada 10s
