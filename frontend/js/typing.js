const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
const token = localStorage.getItem('taverna_token');

if (!token) {
  window.location.href = 'login.html';
}

// --- Elementos ---
const langSelect = document.getElementById('typing-language');
const catSelect = document.getElementById('typing-category');
const dailyCheck = document.getElementById('typing-daily-check');
const newBtn = document.getElementById('typing-new-btn');
const textEl = document.getElementById('typing-text');
const inputEl = document.getElementById('typing-input');
const resultEl = document.getElementById('typing-result');

const statWpm = document.getElementById('stat-wpm');
const statAcc = document.getElementById('stat-acc');
const statErr = document.getElementById('stat-err');
const statTime = document.getElementById('stat-time');

const rankingCatFilter = document.getElementById('ranking-category-filter');
const rankingList = document.getElementById('ranking-list');
const historyList = document.getElementById('history-list');
const dailyInfo = document.getElementById('daily-info');
const dailyList = document.getElementById('daily-list');
const achievementsGrid = document.getElementById('achievements-grid');

// --- Estado ---
let target = '';
let pos = 0;
let errors = 0;
let typedTotal = 0;
let startTime = null;
let timer = null;
let finished = false;
let currentIsDaily = false;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

// --- Preenche selects ---
TYPING_LANGUAGES.forEach((l) => {
  langSelect.add(new Option(l.label, l.value));
});
TYPING_CATEGORIES.forEach((c) => {
  catSelect.add(new Option(c.label, c.value));
  rankingCatFilter.add(new Option(c.label, c.value));
});
rankingCatFilter.add(new Option('すべて', ''), rankingCatFilter.firstChild); // opção "todas" no topo
rankingCatFilter.value = '';

const CATEGORY_LABELS = Object.fromEntries(TYPING_CATEGORIES.map((c) => [c.value, c.label]));
const LANG_LABELS = Object.fromEntries(TYPING_LANGUAGES.map((l) => [l.value, l.label]));

// --- Jogo ---
function startRound(text, isDaily) {
  target = text || '';
  pos = 0;
  errors = 0;
  typedTotal = 0;
  startTime = null;
  finished = false;
  currentIsDaily = !!isDaily;
  resultEl.textContent = '';
  clearInterval(timer);

  // Renderiza cada caractere num span
  textEl.innerHTML = target.split('').map((ch, i) =>
    `<span class="tc${i === 0 ? ' current' : ''}">${escapeHtml(ch)}</span>`
  ).join('');

  updateStats();
  inputEl.value = '';
  inputEl.focus();
}

function newRound() {
  const isDaily = dailyCheck.checked;
  if (isDaily) {
    const snip = getDailySnippet();
    // Alinha os selects com o desafio do dia (informativo)
    langSelect.value = snip.language;
    catSelect.value = snip.category;
    startRound(snip.text, true);
  } else {
    startRound(randomSnippet(langSelect.value, catSelect.value), false);
  }
}

const spans = () => textEl.querySelectorAll('.tc');

function setCurrent() {
  const all = spans();
  all.forEach((s) => s.classList.remove('current'));
  if (pos < all.length) all[pos].classList.add('current');
}

function handleKey(e) {
  if (finished || !target) return;
  // Ignora combinações com Ctrl/Meta/Alt (atalhos)
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'Backspace') {
    e.preventDefault();
    if (pos > 0) {
      pos--;
      const s = spans()[pos];
      s.classList.remove('correct', 'incorrect');
      setCurrent();
      updateStats();
    }
    return;
  }

  // Só caracteres imprimíveis (comprimento 1)
  if (e.key.length !== 1) return;
  e.preventDefault();

  if (startTime === null) {
    startTime = Date.now();
    timer = setInterval(updateStats, 150);
  }

  const all = spans();
  const expected = target[pos];
  typedTotal++;
  if (e.key === expected) {
    all[pos].classList.add('correct');
  } else {
    all[pos].classList.add('incorrect');
    errors++;
  }
  pos++;
  setCurrent();
  updateStats();

  if (pos >= target.length) finish();
}

function computeStats() {
  const elapsedMs = startTime ? Date.now() - startTime : 0;
  const minutes = elapsedMs / 60000;
  const correct = textEl.querySelectorAll('.tc.correct').length;
  const wpm = minutes > 0 ? Math.round((correct / 5) / minutes) : 0;
  const accuracy = typedTotal > 0 ? Math.round(((typedTotal - errors) / typedTotal) * 100) : 100;
  return { wpm, accuracy, elapsedMs };
}

function updateStats() {
  const { wpm, accuracy, elapsedMs } = computeStats();
  statWpm.textContent = wpm;
  statAcc.textContent = accuracy + '%';
  statErr.textContent = errors;
  statTime.textContent = (elapsedMs / 1000).toFixed(1) + 's';
}

async function finish() {
  finished = true;
  clearInterval(timer);
  setCurrent();
  const { wpm, accuracy, elapsedMs } = computeStats();
  updateStats();
  resultEl.textContent = `完了！ ${wpm} WPM · 精度 ${accuracy}% · ミス ${errors}`;

  try {
    const res = await fetch(`${API_BASE}/api/typing/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        language: langSelect.value,
        category: catSelect.value,
        wpm, accuracy, errors,
        durationMs: elapsedMs,
        isDaily: currentIsDaily
      })
    });
    const data = await res.json();
    if (res.ok && data.newAchievements && data.newAchievements.length) {
      const names = data.newAchievements
        .map((k) => (TYPING_ACHIEVEMENTS[k] ? `${TYPING_ACHIEVEMENTS[k].icon} ${TYPING_ACHIEVEMENTS[k].label}` : k))
        .join('、');
      resultEl.textContent += ` — 実績解除: ${names}`;
    }
  } catch (err) {
    console.error(err);
  }

  // Atualiza painéis
  loadRanking();
  loadHistory();
  loadAchievements();
  if (currentIsDaily) loadDaily();
}

inputEl.addEventListener('keydown', handleKey);
textEl.addEventListener('click', () => inputEl.focus());
newBtn.addEventListener('click', newRound);
dailyCheck.addEventListener('change', () => {
  // No modo diário, os selects são definidos pelo desafio
  langSelect.disabled = dailyCheck.checked;
  catSelect.disabled = dailyCheck.checked;
});

// --- Abas ---
document.querySelectorAll('.typing-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.typing-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.typing-panel').forEach((p) => { p.hidden = true; });
    document.getElementById('panel-' + tab.dataset.tab).hidden = false;
  });
});

// --- Painéis ---
function medal(i) {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
}

function renderRankingRows(rows) {
  if (!rows.length) return '<p>まだ記録がありません。</p>';
  return rows.map((r, i) => `
    <div class="rank-row">
      <span class="rank-pos">${medal(i)}</span>
      <img class="rank-pic" src="${r.profile_picture_url ? '..' + r.profile_picture_url : '../assets/default-avatar.svg'}" alt="">
      <span class="rank-name">${escapeHtml(r.name)}</span>
      <span class="rank-wpm">${r.best_wpm} WPM</span>
      <span class="rank-acc">${r.best_accuracy}%</span>
    </div>
  `).join('');
}

async function loadRanking() {
  try {
    const cat = rankingCatFilter.value;
    const q = cat ? `?category=${encodeURIComponent(cat)}` : '';
    const res = await fetch(`${API_BASE}/api/typing/ranking${q}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '読み込みに失敗しました');
    rankingList.innerHTML = renderRankingRows(data.ranking);
  } catch (err) {
    rankingList.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}
rankingCatFilter.addEventListener('change', loadRanking);

async function loadHistory() {
  try {
    const res = await fetch(`${API_BASE}/api/typing/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '読み込みに失敗しました');
    if (!data.history.length) { historyList.innerHTML = '<p>まだ履歴がありません。</p>'; return; }

    historyList.innerHTML = data.history.map((h) => {
      const d = new Date(h.created_at);
      const when = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `
        <div class="history-row">
          <span class="history-cat">${escapeHtml(CATEGORY_LABELS[h.category] || h.category)}${h.is_daily ? ' 📅' : ''}</span>
          <span class="history-lang">${escapeHtml((LANG_LABELS[h.language] || h.language).split(' ')[0])}</span>
          <span class="history-wpm">${h.wpm} WPM</span>
          <span class="history-acc">${h.accuracy}%</span>
          <span class="history-when">${when}</span>
        </div>`;
    }).join('');
  } catch (err) {
    historyList.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

async function loadDaily() {
  try {
    const snip = getDailySnippet();
    dailyInfo.innerHTML = `本日の課題: <strong>${escapeHtml(CATEGORY_LABELS[snip.category])}</strong> · ${escapeHtml(LANG_LABELS[snip.language].split(' ')[0])}<br><code class="daily-snippet">${escapeHtml(snip.text)}</code>`;

    const res = await fetch(`${API_BASE}/api/typing/daily`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '読み込みに失敗しました');
    dailyList.innerHTML = `<h4>本日のランキング</h4>` + renderRankingRows(data.ranking);
  } catch (err) {
    dailyList.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

async function loadAchievements() {
  try {
    const res = await fetch(`${API_BASE}/api/typing/achievements`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '読み込みに失敗しました');
    const unlocked = new Set(data.achievements.map((a) => a.achievement_key));

    achievementsGrid.innerHTML = Object.entries(TYPING_ACHIEVEMENTS).map(([key, a]) => `
      <div class="achievement ${unlocked.has(key) ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">${a.icon}</div>
        <div class="achievement-label">${escapeHtml(a.label)}</div>
        <div class="achievement-desc">${escapeHtml(a.desc)}</div>
      </div>
    `).join('');
  } catch (err) {
    achievementsGrid.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

// --- Init ---
loadRanking();
loadHistory();
loadDaily();
loadAchievements();
