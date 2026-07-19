const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const token = localStorage.getItem('taverna_token');
const currentUser = JSON.parse(localStorage.getItem('taverna_user') || 'null');

if (!token) {
  window.location.href = 'login.html';
}

const nameInput = document.getElementById('event-name-input');
const dateInput = document.getElementById('event-date-input');
const timeInput = document.getElementById('event-time-input');
const locationInput = document.getElementById('event-location-input');
const descriptionInput = document.getElementById('event-description-input');
const photoInput = document.getElementById('event-photo-input');
const photoFilename = document.getElementById('event-photo-filename');
const submitBtn = document.getElementById('event-submit-btn');
const statusMessage = document.getElementById('event-status-message');
const eventsList = document.getElementById('events-list');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const JP_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// Ícone de lixeira (inline, herda a cor do botão via currentColor)
const DELETE_ICON = '<svg class="delete-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17,4V5H15V4H9V5H7V4A2,2,0,0,1,9,2h6A2,2,0,0,1,17,4Z"/><path d="M20,6H4A1,1,0,0,0,4,8H5V20a2,2,0,0,0,2,2H17a2,2,0,0,0,2-2V8h1a1,1,0,0,0,0-2Z"/></svg>';

// Formata "YYYY-MM-DD" no estilo japonês, sem depender de parsing com fuso horário
function formatEventDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}年${m}月${d}日（${JP_WEEKDAYS[dt.getDay()]}）`;
}

photoInput.addEventListener('change', () => {
  photoFilename.textContent = photoInput.files[0] ? photoInput.files[0].name : '';
});

// Formata a data como YYYY/MM/DD enquanto digita (só números, barras automáticas)
dateInput.addEventListener('input', () => {
  const d = dateInput.value.replace(/\D/g, '').slice(0, 8);
  let out = d.slice(0, 4);
  if (d.length > 4) out += '/' + d.slice(4, 6);
  if (d.length > 6) out += '/' + d.slice(6, 8);
  dateInput.value = out;
});

async function loadEvents() {
  try {
    const response = await fetch(`${API_BASE}/api/events`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.events.length) {
      eventsList.innerHTML = '<p>今後のイベントはありません。最初のイベントを作成しましょう！</p>';
      return;
    }

    eventsList.innerHTML = data.events.map(renderEventCard).join('');

    eventsList.querySelectorAll('.event-attend-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleAttendance(parseInt(btn.dataset.id), btn.dataset.attending === 'true'));
    });
    eventsList.querySelectorAll('.event-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteEvent(parseInt(btn.dataset.id)));
    });
  } catch (err) {
    eventsList.innerHTML = '<p>イベントの読み込みに失敗しました。</p>';
  }
}

function renderEventCard(e) {
  const when = `${formatEventDate(e.event_date)}${e.event_time ? ' · ' + e.event_time : ''}`;
  const isCreator = currentUser && currentUser.id === e.creator_id;
  const photo = e.photo_url
    ? `<img class="event-photo" src="..${e.photo_url}" alt="">`
    : '';

  return `
    <div class="event-card" data-id="${e.id}">
      ${photo}
      <div class="event-body">
        <div class="event-name">${escapeHtml(e.name)}</div>
        <div class="event-when">📅 ${escapeHtml(when)}</div>
        ${e.location ? `<div class="event-location">📍 ${escapeHtml(e.location)}</div>` : ''}
        ${e.description ? `<div class="event-description">${escapeHtml(e.description)}</div>` : ''}
        <div class="event-meta">作成者: ${escapeHtml(e.creator_name)}</div>
        <div class="event-actions">
          <button class="event-attend-btn ${e.attending ? 'attending' : ''}" data-id="${e.id}" data-attending="${e.attending}">
            ${e.attending ? '✓ 参加中（取消）' : '参加する'}
          </button>
          <span class="event-attendees">${e.attendee_count}人参加</span>
          ${isCreator ? `<button class="event-delete-btn" data-id="${e.id}" title="イベントを削除">${DELETE_ICON}</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

async function toggleAttendance(eventId, currentlyAttending) {
  try {
    const response = await fetch(`${API_BASE}/api/events/${eventId}/attend`, {
      method: currentlyAttending ? 'DELETE' : 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '参加状況の更新に失敗しました');

    // Atualiza só o card afetado, sem recarregar a lista toda
    const card = eventsList.querySelector(`.event-card[data-id="${eventId}"]`);
    if (!card) return;
    const btn = card.querySelector('.event-attend-btn');
    const count = card.querySelector('.event-attendees');
    btn.dataset.attending = data.attending;
    btn.classList.toggle('attending', data.attending);
    btn.textContent = data.attending ? '✓ 参加中（取消）' : '参加する';
    count.textContent = `${data.attendeeCount}人参加`;
  } catch (err) {
    alert(err.message);
  }
}

async function deleteEvent(eventId) {
  if (!confirm('このイベントを削除しますか？元に戻せません。')) return;

  try {
    const response = await fetch(`${API_BASE}/api/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'イベントの削除に失敗しました');

    loadEvents();
  } catch (err) {
    alert(err.message);
  }
}

submitBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  const dateRaw = dateInput.value.trim();

  if (!name) {
    statusMessage.textContent = 'イベント名を入力してください。';
    return;
  }
  if (!dateRaw) {
    statusMessage.textContent = '日付を入力してください。';
    return;
  }
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateRaw)) {
    statusMessage.textContent = '日付は YYYY/MM/DD の形式で入力してください。';
    return;
  }
  const date = dateRaw.replace(/\//g, '-'); // backend espera YYYY-MM-DD

  statusMessage.textContent = 'イベントを作成中...';
  submitBtn.disabled = true;

  const formData = new FormData();
  formData.append('name', name);
  formData.append('date', date);
  if (timeInput.value) formData.append('time', timeInput.value);
  if (locationInput.value.trim()) formData.append('location', locationInput.value.trim());
  if (descriptionInput.value.trim()) formData.append('description', descriptionInput.value.trim());
  if (photoInput.files[0]) formData.append('photo', photoInput.files[0]);

  try {
    const response = await fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'イベントの作成に失敗しました');

    nameInput.value = '';
    dateInput.value = '';
    timeInput.value = '';
    locationInput.value = '';
    descriptionInput.value = '';
    photoInput.value = '';
    photoFilename.textContent = '';
    statusMessage.textContent = 'イベントを作成しました！';
    loadEvents();
  } catch (err) {
    statusMessage.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
});

loadEvents();
