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

const explainBtn = document.getElementById('typing-explain-btn');
const explainPanel = document.getElementById('typing-explain');

const rankingCatFilter = document.getElementById('ranking-category-filter');
const rankingList = document.getElementById('ranking-list');
const historyList = document.getElementById('history-list');
const dailyInfo = document.getElementById('daily-info');
const dailyList = document.getElementById('daily-list');
const achievementsGrid = document.getElementById('achievements-grid');

// --- Estado ---
let target = '';
let prevValue = '';      // último valor do input (para contar teclas novas)
let errors = 0;
let typedTotal = 0;
let startTime = null;
let timer = null;
let finished = false;
let composing = false;   // true durante composição do IME (japonês)
let currentIsDaily = false;
let currentEntry = null; // item atual (texto + explicação)

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

// --- Preenche selects ---
TYPING_LANGUAGES.forEach((l) => {
  langSelect.add(new Option(l.label, l.value));
});
langSelect.value = 'ja'; // japonês como idioma padrão
TYPING_CATEGORIES.forEach((c) => {
  catSelect.add(new Option(c.label, c.value));
  rankingCatFilter.add(new Option(c.label, c.value));
});
rankingCatFilter.add(new Option('すべて', ''), rankingCatFilter.firstChild); // opção "todas" no topo
rankingCatFilter.value = '';

const CATEGORY_LABELS = Object.fromEntries(TYPING_CATEGORIES.map((c) => [c.value, c.label]));
const LANG_LABELS = Object.fromEntries(TYPING_LANGUAGES.map((l) => [l.value, l.label]));

// --- Jogo ---
function startRound(entry, isDaily) {
  currentEntry = entry;
  target = (entry && entry.text) || '';
  prevValue = '';
  errors = 0;
  typedTotal = 0;
  startTime = null;
  finished = false;
  composing = false;
  currentIsDaily = !!isDaily;
  resultEl.textContent = '';
  explainBtn.hidden = true;
  explainBtn.textContent = 'コマンドを解説 ▾';
  explainPanel.hidden = true;
  explainPanel.innerHTML = '';
  clearInterval(timer);

  inputEl.value = '';
  inputEl.disabled = !target;
  renderText();
  updateStats();
  inputEl.focus();
}

// Renderiza o alvo caractere a caractere, comparando com o que já foi digitado.
function renderText() {
  const val = inputEl.value;
  textEl.innerHTML = target.split('').map((ch, i) => {
    let cls = 'tc';
    if (i < val.length) cls += (val[i] === ch) ? ' correct' : ' incorrect';
    else if (i === val.length) cls += ' current';
    return `<span class="${cls}">${escapeHtml(ch)}</span>`;
  }).join('');
}

function newRound() {
  const isDaily = dailyCheck.checked;
  if (isDaily) {
    const snip = getDailySnippet();
    catSelect.value = snip.category; // alinha a categoria com o desafio do dia
    startRound(snip.entry, true);
  } else {
    startRound(randomSnippet(catSelect.value), false);
  }
}

// Processa o estado atual do input. Funciona para ASCII (comandos, inglês) e
// para japonês via IME: só é chamado quando não há composição em andamento, então
// o valor já reflete o texto confirmado.
function processInput() {
  if (finished || !target) return;

  let val = inputEl.value;
  if (val.length > target.length) {        // não deixa passar do fim
    val = val.slice(0, target.length);
    inputEl.value = val;
  }

  if (startTime === null && val.length > 0) {
    startTime = Date.now();
    timer = setInterval(updateStats, 150);
  }

  // Conta só o que cresceu como "teclas digitadas" (backspace não desconta,
  // igual à lógica anterior de precisão).
  if (val.length > prevValue.length) {
    for (let i = prevValue.length; i < val.length; i++) {
      typedTotal++;
      if (val[i] !== target[i]) errors++;
    }
  }
  prevValue = val;

  renderText();
  updateStats();

  if (val.length >= target.length) finish();
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
  renderText();
  const { wpm, accuracy, elapsedMs } = computeStats();
  updateStats();
  resultEl.textContent = `完了！ ${wpm} WPM · 精度 ${accuracy}% · ミス ${errors}`;
  // Só comandos têm explicação; frases (英文/和文) não.
  explainBtn.hidden = !(currentEntry && (currentEntry.en || currentEntry.ja));

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

// Durante a composição do IME o valor é provisório; só processamos ao confirmar.
inputEl.addEventListener('input', (e) => { if (e.isComposing || composing) return; processInput(); });
inputEl.addEventListener('compositionstart', () => { composing = true; });
inputEl.addEventListener('compositionend', () => { composing = false; processInput(); });
textEl.addEventListener('click', () => inputEl.focus());
newBtn.addEventListener('click', newRound);
dailyCheck.addEventListener('change', () => {
  // No modo diário a categoria é definida pelo desafio; idioma continua livre (é o da explicação)
  catSelect.disabled = dailyCheck.checked;
});

// --- Explicação do comando ---
function renderExplanation() {
  if (!currentEntry) return;
  const lang = langSelect.value;
  const ex = currentEntry[lang] || currentEntry.en;
  const examples = (ex.ex || []).map((e) => `<li><code>${escapeHtml(e)}</code></li>`).join('');
  explainPanel.innerHTML = `
    <p class="explain-cmd"><code>${escapeHtml(currentEntry.text)}</code></p>
    <p><span class="explain-key">概要</span> ${escapeHtml(ex.s)}</p>
    <p><span class="explain-key">用途</span> ${escapeHtml(ex.u)}</p>
    <p><span class="explain-key">例</span></p>
    <ul class="explain-examples">${examples}</ul>
  `;
}

explainBtn.addEventListener('click', () => {
  const show = explainPanel.hidden;
  if (show) renderExplanation();
  explainPanel.hidden = !show;
  explainBtn.textContent = show ? 'コマンドの解説を隠す ▴' : 'コマンドを解説 ▾';
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
    dailyInfo.innerHTML = `本日の課題: <strong>${escapeHtml(CATEGORY_LABELS[snip.category])}</strong><br><code class="daily-snippet">${escapeHtml(snip.entry.text)}</code>`;

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
