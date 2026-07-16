const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const token = localStorage.getItem('taverna_token');
const currentUser = JSON.parse(localStorage.getItem('taverna_user') || 'null');

if (!token) {
  window.location.href = 'login.html';
}

const conversationsList = document.getElementById('conversations-list');
const chatWidget = document.getElementById('chat-widget');
const chatWidgetAvatar = document.getElementById('chat-widget-avatar');
const chatWidgetName = document.getElementById('chat-widget-name');
const chatWidgetClose = document.getElementById('chat-widget-close');
const chatWidgetMessages = document.getElementById('chat-widget-messages');
const chatWidgetInput = document.getElementById('chat-widget-input');
const chatWidgetSend = document.getElementById('chat-widget-send');
const chatWidgetMediaInput = document.getElementById('chat-widget-media-input');

let activeChatUserId = null;

// Reutiliza a conexão global se já existir (ex.: criada pelas notificações), pra não abrir socket duplicado
const socket = window.__tavernaSocket || io(API_BASE || window.location.origin, { auth: { token } });
window.__tavernaSocket = socket;

socket.on('connect_error', (err) => console.error('Socket connection error:', err.message));

socket.on('new_message', (message) => {
  const isForActiveChat =
    (message.sender_id === activeChatUserId) ||
    (message.receiver_id === activeChatUserId && message.sender_id === currentUser.id);

  if (isForActiveChat) appendWidgetMessage(message);
  loadConversations();
});

socket.on('message_deleted', ({ messageId }) => {
  document.querySelector(`.widget-msg[data-message-id="${messageId}"]`)?.remove();
});

socket.on('error_message', (err) => console.error('Chat error:', err.error));

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadConversations() {
  try {
    const response = await fetch(`${API_BASE}/api/chat/conversations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.conversations.length) {
      conversationsList.innerHTML = '<p>会話がまだありません。フレンド一覧から「チャット」を押しましょう！</p>';
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
        <button class="conversation-delete-btn" data-id="${c.other_user_id}" data-name="${escapeHtml(c.display_name)}" title="会話を削除">🗑</button>
      </div>
    `).join('');

    conversationsList.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => openWidget(parseInt(item.dataset.id), item.dataset.name, item.dataset.pic));
    });

    conversationsList.querySelectorAll('.conversation-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // não abrir o chat ao clicar em deletar
        deleteConversation(parseInt(btn.dataset.id), btn.dataset.name);
      });
    });
  } catch (err) {
    conversationsList.innerHTML = '<p>会話の読み込みに失敗しました。</p>';
  }
}

async function openWidget(userId, userName, userPic) {
  activeChatUserId = userId;
  chatWidgetName.textContent = userName;
  chatWidgetAvatar.src = userPic ? '..' + userPic : '../assets/default-avatar.svg';
  chatWidget.style.display = 'flex';
  chatWidgetAvatar.onerror = () => { chatWidgetAvatar.src = '../assets/default-avatar.svg'; };
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
      data.messages.forEach(appendWidgetMessage);
    }
    scrollWidgetToBottom();
  } catch (err) {
    chatWidgetMessages.innerHTML = '<p>メッセージの読み込みに失敗しました。</p>';
  }

  loadConversations();
}

function appendWidgetMessage(message) {
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

function scrollWidgetToBottom() {
  chatWidgetMessages.scrollTop = chatWidgetMessages.scrollHeight;
}

chatWidgetClose.addEventListener('click', () => {
  chatWidget.style.display = 'none';
  activeChatUserId = null;
});

async function deleteConversation(otherUserId, otherUserName) {
  if (!confirm(`${otherUserName} とのチャットをすべて削除しますか？両方の履歴が消え、元に戻せません。`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/chat/conversation/${otherUserId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '会話の削除に失敗しました');

    if (activeChatUserId === otherUserId) {
      chatWidget.style.display = 'none';
      activeChatUserId = null;
    }
    loadConversations();
  } catch (err) {
    alert(err.message);
  }
}

// Se a conversa foi apagada (por mim em outra aba, ou pelo outro), reflete aqui
socket.on('conversation_deleted', ({ withUserId }) => {
  if (activeChatUserId === withUserId) {
    chatWidget.style.display = 'none';
    activeChatUserId = null;
  }
  loadConversations();
});

function sendTextMessage() {
  const content = chatWidgetInput.value.trim();
  if (!content || !activeChatUserId) return;

  socket.emit('send_message', { receiverId: activeChatUserId, content });
  chatWidgetInput.value = '';
}

chatWidgetSend.addEventListener('click', sendTextMessage);
chatWidgetInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendTextMessage();
});

chatWidgetMediaInput.addEventListener('change', async () => {
  const file = chatWidgetMediaInput.files[0];
  if (!file || !activeChatUserId) return;

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

    socket.emit('send_message', {
      receiverId: activeChatUserId,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType
    });

    chatWidgetMediaInput.value = '';
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

// Se veio de "friends.html" com um usuário específico, já abre o widget direto
const urlParams = new URLSearchParams(window.location.search);
const preselectedUserId = urlParams.get('userId');
const preselectedUserName = urlParams.get('name');
if (preselectedUserId && preselectedUserName) {
  openWidget(parseInt(preselectedUserId), preselectedUserName, null);
}

loadConversations();
