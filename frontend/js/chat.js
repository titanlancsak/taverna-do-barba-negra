const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const token = localStorage.getItem('taverna_token');
const currentUser = JSON.parse(localStorage.getItem('taverna_user') || 'null');

if (!token) {
  window.location.href = 'login.html';
}

const conversationsList = document.getElementById('conversations-list');
const friendSelect = document.getElementById('friend-select');
const chatHeader = document.getElementById('chat-header');
const messagesContainer = document.getElementById('messages-container');
const messageInputBox = document.getElementById('message-input-box');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');

let activeChatUserId = null;
let activeChatUserName = null;

const socket = io(API_BASE || window.location.origin, {
  auth: { token }
});

socket.on('connect', () => console.log('Connected to chat server'));
socket.on('connect_error', (err) => console.error('Socket connection error:', err.message));

socket.on('new_message', (message) => {
  const isForActiveChat =
    (message.sender_id === activeChatUserId) || (message.receiver_id === activeChatUserId && message.sender_id === currentUser.id);

  if (isForActiveChat) {
    appendMessage(message);
  }

  loadConversations();
});

socket.on('error_message', (err) => {
  console.error('Chat error:', err.error);
});

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
      conversationsList.innerHTML = '<p style="font-size:13px;color:#8a7a68;">No conversations yet.</p>';
    } else {
      conversationsList.innerHTML = data.conversations.map(c => `
        <div class="conversation-item ${activeChatUserId === c.other_user_id ? 'active' : ''}" data-id="${c.other_user_id}" data-name="${escapeHtml(c.display_name)}">
          <img class="conversation-pic" src="${c.profile_picture_url ? '..' + c.profile_picture_url : '../assets/default-avatar.png'}" alt="">
          <div>
            <div class="conversation-name">${escapeHtml(c.display_name)}</div>
            <div class="conversation-preview">${escapeHtml(c.last_message || '')}</div>
          </div>
          ${c.unread_count > 0 ? `<span class="unread-badge">${c.unread_count}</span>` : ''}
        </div>
      `).join('');

      conversationsList.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => openChat(parseInt(item.dataset.id), item.dataset.name));
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadFriendsForSelect() {
  try {
    const response = await fetch(`${API_BASE}/api/friends`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    friendSelect.innerHTML = '<option value="">Select a friend...</option>' +
      data.friends.map(f => `<option value="${f.id}" data-name="${escapeHtml(f.display_name)}">${escapeHtml(f.display_name)}</option>`).join('');
  } catch (err) {
    console.error(err);
  }
}

friendSelect.addEventListener('change', () => {
  const option = friendSelect.selectedOptions[0];
  if (option.value) {
    openChat(parseInt(option.value), option.dataset.name);
  }
});

async function openChat(userId, userName) {
  activeChatUserId = userId;
  activeChatUserName = userName;

  chatHeader.innerHTML = `<strong>${escapeHtml(userName)}</strong>`;
  messageInputBox.style.display = 'flex';
  messagesContainer.innerHTML = '<p>Loading messages...</p>';

  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.id) === userId);
  });

  try {
    const response = await fetch(`${API_BASE}/api/chat/history/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    messagesContainer.innerHTML = '';
    data.messages.forEach(appendMessage);
    scrollToBottom();
  } catch (err) {
    messagesContainer.innerHTML = '<p>Failed to load messages.</p>';
  }
}

function appendMessage(message) {
  const isSent = message.sender_id === currentUser.id;
  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
  bubble.textContent = message.content;
  messagesContainer.appendChild(bubble);
  scrollToBottom();
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !activeChatUserId) return;

  socket.emit('send_message', { receiverId: activeChatUserId, content });
  messageInput.value = '';
}

sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

loadConversations();
loadFriendsForSelect();

// Se veio de "friends.html" com um usuário específico, já abre o chat direto
const urlParams = new URLSearchParams(window.location.search);
const preselectedUserId = urlParams.get('userId');
const preselectedUserName = urlParams.get('name');
if (preselectedUserId && preselectedUserName) {
  openChat(parseInt(preselectedUserId), preselectedUserName);
}
