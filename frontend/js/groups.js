const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const token = localStorage.getItem('taverna_token');
const currentUser = JSON.parse(localStorage.getItem('taverna_user') || 'null');

if (!token) {
  window.location.href = 'login.html';
}

const groupNameInput = document.getElementById('group-name-input');
const groupFriendsChecklist = document.getElementById('group-friends-checklist');
const createGroupBtn = document.getElementById('create-group-btn');
const createGroupStatus = document.getElementById('create-group-status');
const groupsList = document.getElementById('groups-list');

const chatWidget = document.getElementById('chat-widget');
const chatWidgetAvatar = document.getElementById('chat-widget-avatar');
const chatWidgetName = document.getElementById('chat-widget-name');
const chatWidgetClose = document.getElementById('chat-widget-close');
const chatWidgetMessages = document.getElementById('chat-widget-messages');
const chatWidgetInput = document.getElementById('chat-widget-input');
const chatWidgetSend = document.getElementById('chat-widget-send');
const chatWidgetMediaInput = document.getElementById('chat-widget-media-input');
const chatWidgetMembersBtn = document.getElementById('chat-widget-members-btn');

const membersModal = document.getElementById('members-modal');
const membersList = document.getElementById('members-list');
const membersActions = document.getElementById('members-actions');
const membersModalClose = document.getElementById('members-modal-close');

let activeGroupId = null;

// Reutiliza a conexão global se já existir (ex.: criada pelas notificações), pra não abrir socket duplicado
const socket = window.__tavernaSocket || io(API_BASE || window.location.origin, { auth: { token } });
window.__tavernaSocket = socket;

socket.on('connect_error', (err) => console.error('Socket connection error:', err.message));

socket.on('new_group_message', (message) => {
  if (message.group_id === activeGroupId) {
    appendGroupMessage(message);
  }
  loadGroups();
});

socket.on('error_message', (err) => console.error('Group chat error:', err.error));

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadFriendsChecklist() {
  try {
    const response = await fetch(`${API_BASE}/api/friends`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.friends.length) {
      groupFriendsChecklist.innerHTML = '<p style="font-size:12px;color:#8a7a68;">グループに招待するには、まずフレンドを追加してください。</p>';
      return;
    }

    groupFriendsChecklist.innerHTML = data.friends.map(f => `
      <label class="group-friend-check">
        <input type="checkbox" value="${f.id}"> ${escapeHtml(f.display_name)}
      </label>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

createGroupBtn.addEventListener('click', async () => {
  const name = groupNameInput.value.trim();
  if (!name) {
    createGroupStatus.textContent = 'グループ名を入力してください。';
    return;
  }

  const memberIds = Array.from(groupFriendsChecklist.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));

  createGroupStatus.textContent = 'グループを作成中...';

  try {
    const response = await fetch(`${API_BASE}/api/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, memberIds })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'グループの作成に失敗しました');

    groupNameInput.value = '';
    groupFriendsChecklist.querySelectorAll('input:checked').forEach(cb => cb.checked = false);
    createGroupStatus.textContent = 'グループを作成しました！';
    await loadGroups();
  } catch (err) {
    createGroupStatus.textContent = err.message;
  }
});

async function loadGroups() {
  try {
    const response = await fetch(`${API_BASE}/api/groups`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.groups.length) {
      groupsList.innerHTML = '<p>まだどのグループにも参加していません。</p>';
      return;
    }

    groupsList.innerHTML = data.groups.map(g => `
      <div class="group-card" data-id="${g.id}" data-name="${escapeHtml(g.name)}">
        <div class="group-icon">${escapeHtml(g.name.charAt(0).toUpperCase())}</div>
        <div class="group-info">
          <div class="group-name">${escapeHtml(g.name)}</div>
          <div class="group-meta">${g.member_count}人のメンバー</div>
        </div>
      </div>
    `).join('');

    groupsList.querySelectorAll('.group-card').forEach(card => {
      card.addEventListener('click', () => openGroupChat(parseInt(card.dataset.id), card.dataset.name));
    });
  } catch (err) {
    groupsList.innerHTML = '<p>グループの読み込みに失敗しました。</p>';
  }
}

async function openGroupChat(groupId, groupName) {
  if (activeGroupId) {
    socket.emit('leave_group_room', { groupId: activeGroupId });
  }

  activeGroupId = groupId;
  chatWidgetName.textContent = groupName;
  chatWidgetAvatar.style.display = 'none';
  chatWidget.style.display = 'flex';
  chatWidgetMessages.innerHTML = '<p class="widget-empty-state">読み込み中...</p>';

  socket.emit('join_group', { groupId });

  try {
    const response = await fetch(`${API_BASE}/api/groups/${groupId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    chatWidgetMessages.innerHTML = '';
    if (!data.messages.length) {
      chatWidgetMessages.innerHTML = '<p class="widget-empty-state">まだメッセージがありません。あいさつしよう！👋</p>';
    } else {
      data.messages.forEach(appendGroupMessage);
    }
    scrollWidgetToBottom();
  } catch (err) {
    chatWidgetMessages.innerHTML = '<p>メッセージの読み込みに失敗しました。</p>';
  }
}

function appendGroupMessage(message) {
  chatWidgetMessages.querySelector('.widget-empty-state')?.remove();
  const isSent = message.sender_id === currentUser.id;
  const bubble = document.createElement('div');
  bubble.className = `widget-msg ${isSent ? 'sent' : 'received'}`;

  let mediaHtml = '';
  if (message.media_url) {
    mediaHtml = message.media_type === 'video'
      ? `<video class="widget-msg-media" src="..${message.media_url}" controls></video>`
      : `<img class="widget-msg-media" src="..${message.media_url}" alt="">`;
  }

  const senderLabel = !isSent ? `<div style="font-size:10px;color:#d4a017;margin-bottom:2px;">${escapeHtml(message.sender_name)}</div>` : '';

  bubble.innerHTML = `${senderLabel}${mediaHtml}${message.content ? escapeHtml(message.content) : ''}`;
  chatWidgetMessages.appendChild(bubble);
  scrollWidgetToBottom();
}

function scrollWidgetToBottom() {
  chatWidgetMessages.scrollTop = chatWidgetMessages.scrollHeight;
}

chatWidgetClose.addEventListener('click', () => {
  if (activeGroupId) socket.emit('leave_group_room', { groupId: activeGroupId });
  chatWidget.style.display = 'none';
  activeGroupId = null;
});

function sendGroupTextMessage() {
  const content = chatWidgetInput.value.trim();
  if (!content || !activeGroupId) return;

  socket.emit('send_group_message', { groupId: activeGroupId, content });
  chatWidgetInput.value = '';
}

chatWidgetSend.addEventListener('click', sendGroupTextMessage);
chatWidgetInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendGroupTextMessage();
});

chatWidgetMediaInput.addEventListener('change', async () => {
  const file = chatWidgetMediaInput.files[0];
  if (!file || !activeGroupId) return;

  const formData = new FormData();
  formData.append('media', file);

  try {
    const response = await fetch(`${API_BASE}/api/chat/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'アップロードに失敗しました');

    socket.emit('send_group_message', {
      groupId: activeGroupId,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType
    });

    chatWidgetMediaInput.value = '';
  } catch (err) {
    alert(err.message);
  }
});

chatWidgetMembersBtn.addEventListener('click', async () => {
  if (!activeGroupId) return;

  membersModal.style.display = 'flex';
  membersList.innerHTML = '<p>読み込み中...</p>';

  try {
    const response = await fetch(`${API_BASE}/api/groups/${activeGroupId}/members`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    membersList.innerHTML = data.members.map(m => `
      <div class="member-item">
        <img class="member-pic" src="${m.profile_picture_url ? '..' + m.profile_picture_url : '../assets/default-avatar.svg'}" alt="">
        ${escapeHtml(m.display_name)}
        ${m.role === 'owner' ? '<span class="member-role">オーナー</span>' : ''}
      </div>
    `).join('');

    // Ações do grupo: sair (todos) e deletar (só o dono)
    const me = data.members.find(m => m.id === currentUser.id);
    const isOwner = me && me.role === 'owner';
    membersActions.innerHTML = `
      <button id="leave-group-btn">グループを退出</button>
      ${isOwner ? '<button id="delete-group-btn">グループを削除</button>' : ''}
    `;

    document.getElementById('leave-group-btn').addEventListener('click', () => leaveGroup(activeGroupId));
    if (isOwner) {
      document.getElementById('delete-group-btn').addEventListener('click', () => deleteGroup(activeGroupId));
    }
  } catch (err) {
    membersList.innerHTML = '<p>メンバーの読み込みに失敗しました。</p>';
  }
});

async function leaveGroup(groupId) {
  if (!confirm('このグループを退出しますか？再度参加するには招待が必要です。')) return;

  try {
    const response = await fetch(`${API_BASE}/api/groups/${groupId}/leave`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'グループの退出に失敗しました');

    afterGroupRemoved(groupId);
  } catch (err) {
    alert(err.message);
  }
}

async function deleteGroup(groupId) {
  if (!confirm('このグループを全員のために削除しますか？すべてのメッセージが失われ、元に戻せません。')) return;

  try {
    const response = await fetch(`${API_BASE}/api/groups/${groupId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'グループの削除に失敗しました');

    afterGroupRemoved(groupId);
  } catch (err) {
    alert(err.message);
  }
}

// Fecha modal/widget se o grupo saiu de cena e recarrega a lista
function afterGroupRemoved(groupId) {
  membersModal.style.display = 'none';
  if (activeGroupId === groupId) {
    socket.emit('leave_group_room', { groupId });
    chatWidget.style.display = 'none';
    activeGroupId = null;
  }
  loadGroups();
}

// Se o dono apagou o grupo enquanto eu estava dentro, reflete aqui
socket.on('group_deleted', ({ groupId }) => {
  afterGroupRemoved(groupId);
});

membersModalClose.addEventListener('click', () => {
  membersModal.style.display = 'none';
});

loadFriendsChecklist();
loadGroups();
