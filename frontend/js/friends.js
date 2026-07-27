// Página unificada: フレンド (esquerda) + グループ/会話 (direita) + janela de chat
// flutuante e arrastável (1-a-1 e grupo). Convidar gente numa conversa vira grupo.
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const token = localStorage.getItem('taverna_token');
const currentUser = JSON.parse(localStorage.getItem('taverna_user') || 'null');

if (!token) {
  window.location.href = 'login.html';
}

// --- Elementos: friends / listas ---
const addFriendEmail = document.getElementById('add-friend-email');
const addFriendBtn = document.getElementById('add-friend-btn');
const addFriendStatus = document.getElementById('add-friend-status');
const pendingList = document.getElementById('pending-requests-list');
const friendsList = document.getElementById('friends-list');
const groupsList = document.getElementById('groups-list');
const conversationsList = document.getElementById('conversations-list');

// --- Elementos: widget de chat ---
const chatWidget = document.getElementById('chat-widget');
const chatWidgetHeader = document.getElementById('chat-widget-header');
const chatWidgetAvatar = document.getElementById('chat-widget-avatar');
const chatWidgetName = document.getElementById('chat-widget-name');
const chatWidgetClose = document.getElementById('chat-widget-close');
const chatWidgetMessages = document.getElementById('chat-widget-messages');
const chatWidgetInput = document.getElementById('chat-widget-input');
const chatWidgetSend = document.getElementById('chat-widget-send');
const chatWidgetMediaInput = document.getElementById('chat-widget-media-input');
const chatWidgetInviteBtn = document.getElementById('chat-widget-invite-btn');
const chatWidgetMembersBtn = document.getElementById('chat-widget-members-btn');

// --- Elementos: modais ---
const inviteModal = document.getElementById('invite-modal');
const inviteGroupNameRow = document.getElementById('invite-group-name-row');
const inviteGroupName = document.getElementById('invite-group-name');
const inviteFriendsList = document.getElementById('invite-friends-list');
const inviteStatus = document.getElementById('invite-status');
const inviteCancelBtn = document.getElementById('invite-cancel-btn');
const inviteConfirmBtn = document.getElementById('invite-confirm-btn');

const membersModal = document.getElementById('members-modal');
const membersList = document.getElementById('members-list');
const membersActions = document.getElementById('members-actions');
const membersModalClose = document.getElementById('members-modal-close');

const DELETE_ICON = '<svg class="delete-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17,4V5H15V4H9V5H7V4A2,2,0,0,1,9,2h6A2,2,0,0,1,17,4Z"/><path d="M20,6H4A1,1,0,0,0,4,8H5V20a2,2,0,0,0,2,2H17a2,2,0,0,0,2-2V8h1a1,1,0,0,0,0-2Z"/></svg>';

// Estado da conversa aberta: null | { type:'dm', id, name } | { type:'group', id, name }
let activeChat = null;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

// ===================== Socket =====================
const socket = window.__tavernaSocket || io(API_BASE || window.location.origin, { auth: { token } });
window.__tavernaSocket = socket;
socket.on('connect_error', (err) => console.error('Socket connection error:', err.message));

socket.on('new_message', (message) => {
  const isForActive = activeChat && activeChat.type === 'dm' &&
    ((message.sender_id === activeChat.id) ||
     (message.receiver_id === activeChat.id && message.sender_id === currentUser.id));
  if (isForActive) appendDmMessage(message);
  loadConversations();
});

socket.on('new_group_message', (message) => {
  if (activeChat && activeChat.type === 'group' && message.group_id === activeChat.id) {
    appendGroupMessage(message);
  }
  loadGroups();
});

socket.on('message_deleted', ({ messageId }) => {
  document.querySelector(`.widget-msg[data-message-id="${messageId}"]`)?.remove();
});

socket.on('conversation_deleted', ({ withUserId }) => {
  if (activeChat && activeChat.type === 'dm' && activeChat.id === withUserId) closeWidget();
  loadConversations();
});

socket.on('group_deleted', ({ groupId }) => afterGroupRemoved(groupId));

socket.on('error_message', (err) => console.error('Chat error:', err.error));

// ===================== Friends =====================
async function loadPendingRequests() {
  try {
    const response = await fetch(`${API_BASE}/api/friends/pending`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.requests.length) {
      pendingList.innerHTML = '<p>保留中のリクエストはありません。</p>';
      return;
    }

    pendingList.innerHTML = data.requests.map(r => `
      <div class="request-card">
        <img class="request-pic" src="${r.profile_picture_url ? '..' + r.profile_picture_url : '../assets/default-avatar.svg'}" alt="">
        <div class="request-info">
          <div class="request-name">${escapeHtml(r.display_name)}</div>
        </div>
        <div class="request-actions">
          <button class="accept-btn" data-id="${r.friendship_id}" data-action="accept">承認</button>
          <button class="decline-btn" data-id="${r.friendship_id}" data-action="decline">拒否</button>
        </div>
      </div>
    `).join('');

    pendingList.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => respondToRequest(btn.dataset.id, btn.dataset.action));
    });
  } catch (err) {
    pendingList.innerHTML = '<p>リクエストの読み込みに失敗しました。</p>';
  }
}

async function respondToRequest(friendshipId, action) {
  try {
    await fetch(`${API_BASE}/api/friends/respond/${friendshipId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
      friendsList.innerHTML = '<p>まだフレンドがいません。上から追加しましょう！</p>';
      return;
    }

    friendsList.innerHTML = data.friends.map(f => `
      <div class="friend-card" data-id="${f.id}" data-name="${escapeHtml(f.display_name)}" data-pic="${f.profile_picture_url || ''}">
        <img class="friend-pic" src="${f.profile_picture_url ? '..' + f.profile_picture_url : '../assets/default-avatar.svg'}" alt="">
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(f.display_name)}</div>
          ${f.course ? `<div class="friend-course">${escapeHtml(f.course)}</div>` : ''}
        </div>
        <button class="chat-with-friend-btn" data-id="${f.id}" data-name="${escapeHtml(f.display_name)}" data-pic="${f.profile_picture_url || ''}">チャット</button>
        <button class="remove-friend-btn" data-id="${f.id}">削除</button>
      </div>
    `).join('');

    friendsList.querySelectorAll('.remove-friend-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); removeFriend(btn.dataset.id); });
    });

    friendsList.querySelectorAll('.chat-with-friend-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDM(parseInt(btn.dataset.id), btn.dataset.name, btn.dataset.pic);
      });
    });
  } catch (err) {
    friendsList.innerHTML = '<p>フレンドの読み込みに失敗しました。</p>';
  }
}

async function removeFriend(userId) {
  if (!confirm('このフレンドを削除しますか？')) return;
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
  addFriendStatus.textContent = 'リクエストを送信中...';
  try {
    const response = await fetch(`${API_BASE}/api/friends/request-by-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'リクエストの送信に失敗しました');
    addFriendStatus.textContent = 'フレンドリクエストを送信しました！';
    addFriendEmail.value = '';
  } catch (err) {
    addFriendStatus.textContent = err.message;
  }
});

// ===================== Conversas (1-a-1) =====================
async function loadConversations() {
  try {
    const response = await fetch(`${API_BASE}/api/chat/conversations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.conversations.length) {
      conversationsList.innerHTML = '<p>会話がまだありません。左のフレンドから「チャット」を押しましょう！</p>';
      return;
    }

    conversationsList.innerHTML = data.conversations.map(c => `
      <div class="conversation-item" data-id="${c.other_user_id}" data-name="${escapeHtml(c.display_name)}" data-pic="${c.profile_picture_url || ''}">
        <img class="conversation-pic" src="${c.profile_picture_url ? '..' + c.profile_picture_url : '../assets/default-avatar.svg'}" alt="">
        <div class="conversation-info">
          <div class="conversation-name">${escapeHtml(c.display_name)}</div>
          <div class="conversation-preview">${c.last_message ? escapeHtml(c.last_message) : '📎 メディア'}</div>
        </div>
        ${c.unread_count > 0 ? `<span class="unread-badge">${c.unread_count}</span>` : ''}
        <button class="conversation-delete-btn" data-id="${c.other_user_id}" data-name="${escapeHtml(c.display_name)}" title="会話を削除">${DELETE_ICON}</button>
      </div>
    `).join('');

    conversationsList.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => openDM(parseInt(item.dataset.id), item.dataset.name, item.dataset.pic));
    });

    conversationsList.querySelectorAll('.conversation-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(parseInt(btn.dataset.id), btn.dataset.name);
      });
    });
  } catch (err) {
    conversationsList.innerHTML = '<p>会話の読み込みに失敗しました。</p>';
  }
}

async function deleteConversation(otherUserId, otherUserName) {
  if (!confirm(`${otherUserName} とのチャットをすべて削除しますか？両方の履歴が消え、元に戻せません。`)) return;
  try {
    const response = await fetch(`${API_BASE}/api/chat/conversation/${otherUserId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '会話の削除に失敗しました');
    if (activeChat && activeChat.type === 'dm' && activeChat.id === otherUserId) closeWidget();
    loadConversations();
  } catch (err) {
    alert(err.message);
  }
}

// ===================== Grupos =====================
async function loadGroups() {
  try {
    const response = await fetch(`${API_BASE}/api/groups`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.groups.length) {
      groupsList.innerHTML = '<p>まだどのグループにも参加していません。フレンドとのチャットから「＋」で作れます。</p>';
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
      card.addEventListener('click', () => openGroup(parseInt(card.dataset.id), card.dataset.name));
    });
  } catch (err) {
    groupsList.innerHTML = '<p>グループの読み込みに失敗しました。</p>';
  }
}

// ===================== Widget: abrir/fechar =====================
async function openDM(userId, userName, userPic) {
  if (activeChat && activeChat.type === 'group') socket.emit('leave_group_room', { groupId: activeChat.id });
  activeChat = { type: 'dm', id: userId, name: userName };

  chatWidgetName.textContent = userName;
  chatWidgetAvatar.style.display = '';
  chatWidgetAvatar.src = userPic ? '..' + userPic : '../assets/default-avatar.svg';
  chatWidgetAvatar.onerror = () => { chatWidgetAvatar.src = '../assets/default-avatar.svg'; };
  chatWidgetMembersBtn.style.display = 'none'; // membros só em grupo
  chatWidget.style.display = 'flex';
  chatWidgetMessages.innerHTML = '<p class="widget-empty-state">読み込み中...</p>';

  try {
    const response = await fetch(`${API_BASE}/api/chat/history/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    chatWidgetMessages.innerHTML = '';
    if (!data.messages.length) {
      chatWidgetMessages.innerHTML = '<p class="widget-empty-state">あいさつしよう！👋</p>';
    } else {
      data.messages.forEach(appendDmMessage);
    }
    scrollWidgetToBottom();
  } catch (err) {
    chatWidgetMessages.innerHTML = '<p>メッセージの読み込みに失敗しました。</p>';
  }
  loadConversations();
}

async function openGroup(groupId, groupName) {
  if (activeChat && activeChat.type === 'group') socket.emit('leave_group_room', { groupId: activeChat.id });
  activeChat = { type: 'group', id: groupId, name: groupName };

  chatWidgetName.textContent = groupName;
  chatWidgetAvatar.style.display = 'none';
  chatWidgetMembersBtn.style.display = '';
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

function closeWidget() {
  if (activeChat && activeChat.type === 'group') socket.emit('leave_group_room', { groupId: activeChat.id });
  chatWidget.style.display = 'none';
  activeChat = null;
}

chatWidgetClose.addEventListener('click', closeWidget);

// ===================== Widget: mensagens =====================
function appendDmMessage(message) {
  chatWidgetMessages.querySelector('.widget-empty-state')?.remove();
  const isSent = message.sender_id === currentUser.id;
  const bubble = document.createElement('div');
  bubble.className = `widget-msg ${isSent ? 'sent' : 'received'}`;
  bubble.dataset.messageId = message.id;

  let mediaHtml = '';
  if (message.media_url) {
    mediaHtml = message.media_type === 'video'
      ? `<video class="widget-msg-media" src="..${message.media_url}" controls></video>`
      : `<img class="widget-msg-media" src="..${message.media_url}" alt="">`;
  }

  bubble.innerHTML = `
    ${isSent ? '<button class="widget-msg-delete">✕</button>' : ''}
    ${mediaHtml}
    ${message.content ? escapeHtml(message.content) : ''}
  `;

  if (isSent) {
    bubble.querySelector('.widget-msg-delete').addEventListener('click', () => {
      socket.emit('delete_message', { messageId: message.id });
    });
  }
  chatWidgetMessages.appendChild(bubble);
  scrollWidgetToBottom();
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

  const senderLabel = !isSent ? `<div class="widget-msg-sender">${escapeHtml(message.sender_name)}</div>` : '';
  bubble.innerHTML = `${senderLabel}${mediaHtml}${message.content ? escapeHtml(message.content) : ''}`;
  chatWidgetMessages.appendChild(bubble);
  scrollWidgetToBottom();
}

function scrollWidgetToBottom() {
  chatWidgetMessages.scrollTop = chatWidgetMessages.scrollHeight;
}

function sendMessage() {
  const content = chatWidgetInput.value.trim();
  if (!content || !activeChat) return;
  if (activeChat.type === 'dm') {
    socket.emit('send_message', { receiverId: activeChat.id, content });
  } else {
    socket.emit('send_group_message', { groupId: activeChat.id, content });
  }
  chatWidgetInput.value = '';
}

chatWidgetSend.addEventListener('click', sendMessage);
chatWidgetInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

chatWidgetMediaInput.addEventListener('change', async () => {
  const file = chatWidgetMediaInput.files[0];
  if (!file || !activeChat) return;

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

    if (activeChat.type === 'dm') {
      socket.emit('send_message', { receiverId: activeChat.id, mediaUrl: data.mediaUrl, mediaType: data.mediaType });
    } else {
      socket.emit('send_group_message', { groupId: activeChat.id, mediaUrl: data.mediaUrl, mediaType: data.mediaType });
    }
    chatWidgetMediaInput.value = '';
  } catch (err) {
    alert(err.message);
  }
});

// ===================== Convidar (vira grupo / adiciona membros) =====================
chatWidgetInviteBtn.addEventListener('click', openInviteModal);

async function openInviteModal() {
  if (!activeChat) return;
  inviteStatus.textContent = '';
  inviteGroupName.value = '';
  // Em DM cria um grupo novo (pede nome); em grupo só adiciona membros
  inviteGroupNameRow.style.display = activeChat.type === 'dm' ? '' : 'none';
  inviteConfirmBtn.textContent = activeChat.type === 'dm' ? 'グループを作成' : '招待';
  inviteFriendsList.innerHTML = '<p>読み込み中...</p>';
  inviteModal.style.display = 'flex';

  try {
    const response = await fetch(`${API_BASE}/api/friends`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    // Em DM, o outro participante já entra no grupo — não precisa marcá-lo
    const friends = data.friends.filter(f => !(activeChat.type === 'dm' && f.id === activeChat.id));

    if (!friends.length) {
      inviteFriendsList.innerHTML = '<p>招待できるフレンドがいません。</p>';
      return;
    }
    inviteFriendsList.innerHTML = friends.map(f => `
      <label class="invite-friend-check">
        <input type="checkbox" value="${f.id}"> ${escapeHtml(f.display_name)}
      </label>
    `).join('');
  } catch (err) {
    inviteFriendsList.innerHTML = '<p>フレンドの読み込みに失敗しました。</p>';
  }
}

function closeInviteModal() {
  inviteModal.style.display = 'none';
}
inviteCancelBtn.addEventListener('click', closeInviteModal);

inviteConfirmBtn.addEventListener('click', async () => {
  if (!activeChat) return;
  const selected = Array.from(inviteFriendsList.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
  if (!selected.length) {
    inviteStatus.textContent = '少なくとも1人選んでください。';
    return;
  }
  inviteConfirmBtn.disabled = true;

  try {
    if (activeChat.type === 'group') {
      inviteStatus.textContent = '招待中...';
      for (const friendId of selected) {
        const res = await fetch(`${API_BASE}/api/groups/${activeChat.id}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ friendId })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || '招待に失敗しました');
      }
      inviteStatus.textContent = '招待しました！';
      await loadGroups();
      setTimeout(closeInviteModal, 900);
    } else {
      // DM -> cria grupo com o outro participante + selecionados
      const name = inviteGroupName.value.trim();
      if (!name) {
        inviteStatus.textContent = 'グループ名を入力してください。';
        inviteConfirmBtn.disabled = false;
        return;
      }
      inviteStatus.textContent = 'グループを作成中...';
      const memberIds = [activeChat.id, ...selected];
      const res = await fetch(`${API_BASE}/api/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, memberIds })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'グループの作成に失敗しました');
      closeInviteModal();
      await loadGroups();
      openGroup(d.group.id, d.group.name);
    }
  } catch (err) {
    inviteStatus.textContent = err.message;
  } finally {
    inviteConfirmBtn.disabled = false;
  }
});

// ===================== Membros do grupo =====================
chatWidgetMembersBtn.addEventListener('click', async () => {
  if (!activeChat || activeChat.type !== 'group') return;
  const groupId = activeChat.id;
  membersModal.style.display = 'flex';
  membersList.innerHTML = '<p>読み込み中...</p>';
  membersActions.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE}/api/groups/${groupId}/members`, {
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

    const me = data.members.find(m => m.id === currentUser.id);
    const isOwner = me && me.role === 'owner';
    membersActions.innerHTML = `
      <button id="leave-group-btn">グループを退出</button>
      ${isOwner ? '<button id="delete-group-btn">グループを削除</button>' : ''}
    `;
    document.getElementById('leave-group-btn').addEventListener('click', () => leaveGroup(groupId));
    if (isOwner) {
      document.getElementById('delete-group-btn').addEventListener('click', () => deleteGroup(groupId));
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

function afterGroupRemoved(groupId) {
  membersModal.style.display = 'none';
  if (activeChat && activeChat.type === 'group' && activeChat.id === groupId) {
    socket.emit('leave_group_room', { groupId });
    chatWidget.style.display = 'none';
    activeChat = null;
  }
  loadGroups();
}

membersModalClose.addEventListener('click', () => { membersModal.style.display = 'none'; });

// ===================== Janela arrastável =====================
(function makeDraggable(widget, handle) {
  let dragging = false, offsetX = 0, offsetY = 0;

  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return; // não arrastar ao clicar nos botões do header
    dragging = true;
    const rect = widget.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    // Passa de bottom/right para left/top para poder mover livremente
    widget.style.left = rect.left + 'px';
    widget.style.top = rect.top + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
    handle.setPointerCapture(e.pointerId);
    handle.style.cursor = 'grabbing';
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;
    x = Math.max(0, Math.min(x, window.innerWidth - widget.offsetWidth));
    y = Math.max(0, Math.min(y, window.innerHeight - widget.offsetHeight));
    widget.style.left = x + 'px';
    widget.style.top = y + 'px';
  });

  const stop = (e) => {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = '';
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
})(chatWidget, chatWidgetHeader);

// ===================== Init =====================
async function init() {
  loadPendingRequests();
  loadFriends();
  loadConversations();
  await loadGroups();

  // Deep-link: abre direto uma conversa (?userId=&name=) ou um grupo (?groupId=)
  const params = new URLSearchParams(window.location.search);
  const uid = params.get('userId');
  const gid = params.get('groupId');
  if (uid) {
    openDM(parseInt(uid), params.get('name') || 'チャット', null);
  } else if (gid) {
    const card = groupsList.querySelector(`.group-card[data-id="${gid}"]`);
    if (card) openGroup(parseInt(gid), card.dataset.name);
  }
}
init();
