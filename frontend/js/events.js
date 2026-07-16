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

// Formata "YYYY-MM-DD" no estilo japonês, sem depender de parsing com fuso horário
function formatEventDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${y}年${m}月${d}日（${JP_WEEKDAYS[dt.getDay()]}）`;
}

photoInput.addEventListener('change', () => {
  photoFilename.textContent = photoInput.files[0] ? photoInput.files[0].name : '';
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
          ${isCreator ? `<button class="event-delete-btn" data-id="${e.id}" title="イベントを削除">🗑</button>` : ''}
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
  const date = dateInput.value;

  if (!name) {
    statusMessage.textContent = 'イベント名を入力してください。';
    return;
  }
  if (!date) {
    statusMessage.textContent = '日付を選択してください。';
    return;
  }

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
