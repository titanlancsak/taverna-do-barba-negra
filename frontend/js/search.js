// Pesquisa global — caixa "検索" no header, com dropdown de resultados agrupados.
(function () {
  const token = localStorage.getItem('taverna_token');
  if (!token) return;

  const input = document.getElementById('global-search-input');
  const resultsEl = document.getElementById('global-search-results');
  if (!input || !resultsEl) return;

  const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
  const isInPages = window.location.pathname.includes('/pages/');
  const pagePrefix = isInPages ? '' : 'pages/';
  const rootPrefix = isInPages ? '../' : '';

  function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t == null ? '' : t;
    return d.innerHTML;
  }
  function escapeAttr(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function snippet(text) {
    text = (text || '').replace(/\s+/g, ' ').trim();
    return text.length > 40 ? text.slice(0, 40) + '…' : text;
  }

  function item(href, label, sub) {
    return `<a class="gs-item" href="${escapeAttr(href)}">${escapeHtml(label)}` +
           (sub ? `<span class="gs-sub"> · ${escapeHtml(sub)}</span>` : '') + `</a>`;
  }
  function section(title, items) {
    return items.length ? `<div class="gs-section-title">${title}</div>` + items.join('') : '';
  }

  function hide() { resultsEl.style.display = 'none'; }

  function render(data) {
    let html = '';
    html += section('ユーザー', (data.users || []).map((u) =>
      item(`${pagePrefix}chat.html?userId=${u.id}&name=${encodeURIComponent(u.display_name)}`, u.display_name)));
    html += section('投稿', (data.posts || []).map((p) =>
      item(`${rootPrefix}index.html`, snippet(p.content), p.author_name)));
    html += section('イベント', (data.events || []).map((e) =>
      item(`${pagePrefix}events.html`, e.name, e.event_date)));
    html += section('グループ', (data.groups || []).map((g) =>
      item(`${pagePrefix}groups.html`, g.name)));

    resultsEl.innerHTML = html || '<div class="gs-empty">結果がありません</div>';
    resultsEl.style.display = 'block';
  }

  async function runSearch(q) {
    try {
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      render(data);
    } catch (err) {
      resultsEl.innerHTML = '<div class="gs-empty">検索に失敗しました</div>';
      resultsEl.style.display = 'block';
    }
  }

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) { hide(); return; }
    debounce = setTimeout(() => runSearch(q), 250);
  });

  input.addEventListener('focus', () => {
    if (resultsEl.innerHTML.trim()) resultsEl.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#global-search')) hide();
  });
})();
