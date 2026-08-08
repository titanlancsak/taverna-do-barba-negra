// Subnet Calculator avançado — 100% no navegador.
// Suporta IPv4/IPv6, CIDR/máscara, network/broadcast, contagem de hosts,
// geração automática de subnets, VLSM e histórico (localStorage).

/* ===================== Helpers IPv4 ===================== */

// "192.168.0.1" -> BigInt de 32 bits (ou lança erro)
function ipv4ToInt(str) {
  const parts = str.trim().split('.');
  if (parts.length !== 4) throw new Error('IPv4 は 4 つのオクテットが必要です。');
  let n = 0n;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) throw new Error('IPv4 の値が不正です。');
    const v = Number(p);
    if (v < 0 || v > 255) throw new Error('各オクテットは 0〜255 の範囲です。');
    n = (n << 8n) | BigInt(v);
  }
  return n;
}

// BigInt de 32 bits -> "192.168.0.1"
function intToIpv4(n) {
  const o = [];
  for (let i = 3; i >= 0; i--) o.push(Number((n >> BigInt(i * 8)) & 0xffn));
  return o.join('.');
}

// prefixo (0-32) -> máscara como BigInt de 32 bits
function ipv4Mask(prefix) {
  if (prefix === 0) return 0n;
  return (0xffffffffn << BigInt(32 - prefix)) & 0xffffffffn;
}

// Classe do endereço IPv4 (A/B/C/D/E)
function ipv4Class(firstOctet) {
  if (firstOctet < 128) return 'A';
  if (firstOctet < 192) return 'B';
  if (firstOctet < 224) return 'C';
  if (firstOctet < 240) return 'D (マルチキャスト)';
  return 'E (実験用)';
}

// Tipo do endereço IPv4 (privado, loopback, etc.)
function ipv4Type(n) {
  const a = Number((n >> 24n) & 0xffn);
  const b = Number((n >> 16n) & 0xffn);
  if (a === 10) return 'プライベート';
  if (a === 172 && b >= 16 && b <= 31) return 'プライベート';
  if (a === 192 && b === 168) return 'プライベート';
  if (a === 127) return 'ループバック';
  if (a === 169 && b === 254) return 'リンクローカル (APIPA)';
  if (a >= 224 && a <= 239) return 'マルチキャスト';
  if (a === 0) return '予約済み';
  return 'パブリック';
}

// Representação binária pontilhada de um IPv4
function ipv4Binary(n) {
  const o = [];
  for (let i = 3; i >= 0; i--) {
    const byte = Number((n >> BigInt(i * 8)) & 0xffn);
    o.push(byte.toString(2).padStart(8, '0'));
  }
  return o.join('.');
}

/* ===================== Helpers IPv6 ===================== */

// "2001:db8::1" -> BigInt de 128 bits
function ipv6ToInt(str) {
  let s = str.trim().toLowerCase();
  if (s === '') throw new Error('IPv6 が空です。');

  // Divide em parte antes/depois do "::"
  let head, tail;
  if (s.includes('::')) {
    const halves = s.split('::');
    if (halves.length > 2) throw new Error('"::" は 1 回のみ使用できます。');
    head = halves[0] === '' ? [] : halves[0].split(':');
    tail = halves[1] === '' ? [] : halves[1].split(':');
  } else {
    head = s.split(':');
    tail = [];
    if (head.length !== 8) throw new Error('圧縮なしの IPv6 は 8 グループ必要です。');
  }

  const groups = [];
  for (const g of head) groups.push(g);
  const missing = 8 - (head.length + tail.length);
  if (missing < 0) throw new Error('IPv6 のグループが多すぎます。');
  for (let i = 0; i < missing; i++) groups.push('0');
  for (const g of tail) groups.push(g);
  if (groups.length !== 8) throw new Error('IPv6 のグループ数が不正です。');

  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) throw new Error(`IPv6 グループが不正です: "${g}"`);
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

// BigInt de 128 bits -> IPv6 comprimido (com "::")
function intToIpv6(n) {
  const groups = [];
  for (let i = 7; i >= 0; i--) {
    groups.push(Number((n >> BigInt(i * 16)) & 0xffffn).toString(16));
  }
  // Encontra a maior sequência de zeros para comprimir
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (groups[i] === '0') {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curStart = -1; curLen = 0;
    }
  }
  if (bestLen < 2) return groups.join(':'); // não vale a pena comprimir 1 grupo
  const before = groups.slice(0, bestStart).join(':');
  const after = groups.slice(bestStart + bestLen).join(':');
  return `${before}::${after}`;
}

// prefixo (0-128) -> máscara como BigInt de 128 bits
function ipv6Mask(prefix) {
  if (prefix === 0) return 0n;
  const full = (1n << 128n) - 1n;
  return (full << BigInt(128 - prefix)) & full;
}

// Tipo do endereço IPv6
function ipv6Type(n) {
  const top16 = (n >> 112n) & 0xffffn;
  if (n === 0n) return '未指定 (::)';
  if (n === 1n) return 'ループバック (::1)';
  if ((top16 & 0xfe00n) === 0xfc00n) return 'ユニークローカル (ULA)';
  if ((top16 & 0xffc0n) === 0xfe80n) return 'リンクローカル';
  if ((top16 & 0xff00n) === 0xff00n) return 'マルチキャスト';
  if (top16 === 0x2001n && ((n >> 96n) & 0xffffn) === 0x0db8n) return 'ドキュメント用 (2001:db8::/32)';
  if ((top16 & 0xe000n) === 0x2000n) return 'グローバルユニキャスト';
  return 'その他';
}

/* ===================== Formatação de números grandes ===================== */

function formatBig(n) {
  // Insere separador de milhar
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* ===================== Cálculo principal ===================== */

// Recebe { ip, prefix, version } e devolve objeto com todos os dados calculados
function calcSubnet(ip, prefix, version) {
  if (version === 'ipv4') {
    const n = ipv4ToInt(ip);
    if (prefix < 0 || prefix > 32) throw new Error('IPv4 のプレフィックスは 0〜32 です。');
    const mask = ipv4Mask(prefix);
    const wildcard = (~mask) & 0xffffffffn;
    const network = n & mask;
    const broadcast = network | wildcard;
    const totalAddr = 1n << BigInt(32 - prefix);

    let firstHost, lastHost, usable;
    if (prefix >= 31) {
      // /31 (RFC 3021) e /32 não têm rede/broadcast utilizáveis no sentido clássico
      firstHost = network;
      lastHost = broadcast;
      usable = prefix === 32 ? 1n : 2n;
    } else {
      firstHost = network + 1n;
      lastHost = broadcast - 1n;
      usable = totalAddr - 2n;
    }

    const firstOctet = Number((network >> 24n) & 0xffn);

    return {
      version: 'ipv4',
      input: `${ip}/${prefix}`,
      rows: [
        ['CIDR 表記', `${intToIpv4(network)}/${prefix}`],
        ['ネットワークアドレス', intToIpv4(network)],
        ['ブロードキャストアドレス', intToIpv4(broadcast)],
        ['サブネットマスク', intToIpv4(mask)],
        ['ワイルドカードマスク', intToIpv4(wildcard)],
        ['最初のホスト', prefix >= 31 ? '—' : intToIpv4(firstHost)],
        ['最後のホスト', prefix >= 31 ? '—' : intToIpv4(lastHost)],
        ['使用可能ホスト数', formatBig(usable)],
        ['総アドレス数', formatBig(totalAddr)],
        ['IP クラス', ipv4Class(firstOctet)],
        ['種別', ipv4Type(network)],
        ['マスク (2進)', ipv4Binary(mask)],
        ['ネットワーク (2進)', ipv4Binary(network)]
      ],
      network, broadcast, prefix, totalAddr
    };
  } else {
    const n = ipv6ToInt(ip);
    if (prefix < 0 || prefix > 128) throw new Error('IPv6 のプレフィックスは 0〜128 です。');
    const mask = ipv6Mask(prefix);
    const network = n & mask;
    const totalAddr = 1n << BigInt(128 - prefix);
    const lastAddr = network | ((1n << BigInt(128 - prefix)) - 1n);

    return {
      version: 'ipv6',
      input: `${ip}/${prefix}`,
      rows: [
        ['CIDR 表記', `${intToIpv6(network)}/${prefix}`],
        ['ネットワーク (Prefix)', intToIpv6(network)],
        ['最初のアドレス', intToIpv6(network)],
        ['最後のアドレス', intToIpv6(lastAddr)],
        ['アドレス数', formatBig(totalAddr)],
        ['種別', ipv6Type(network)],
        ['完全表記', intToIpv6Full(network)]
      ],
      network, prefix, totalAddr
    };
  }
}

// IPv6 sem compressão (todos os 8 grupos)
function intToIpv6Full(n) {
  const groups = [];
  for (let i = 7; i >= 0; i--) {
    groups.push(Number((n >> BigInt(i * 16)) & 0xffffn).toString(16).padStart(4, '0'));
  }
  return groups.join(':');
}

/* ===================== Geração automática de subnets ===================== */

// Divide uma rede base num novo prefixo e devolve a lista de subredes
function generateSubnets(ip, basePrefix, newPrefix, version, limit = 256) {
  const isV4 = version === 'ipv4';
  const maxPrefix = isV4 ? 32 : 128;
  if (newPrefix < basePrefix) throw new Error('新しいプレフィックスはベースより大きくしてください。');
  if (newPrefix > maxPrefix) throw new Error(`プレフィックスは最大 ${maxPrefix} です。`);

  const base = calcSubnet(ip, basePrefix, version);
  const network = base.network;
  const count = 1n << BigInt(newPrefix - basePrefix);       // quantas subredes
  const step = 1n << BigInt(maxPrefix - newPrefix);          // tamanho de cada uma

  const subnets = [];
  const shown = count > BigInt(limit) ? BigInt(limit) : count;
  for (let i = 0n; i < shown; i++) {
    const sub = network + i * step;
    if (isV4) {
      const bc = sub + step - 1n;
      const usable = newPrefix >= 31 ? (newPrefix === 32 ? 1n : 2n) : step - 2n;
      subnets.push({
        cidr: `${intToIpv4(sub)}/${newPrefix}`,
        network: intToIpv4(sub),
        range: newPrefix >= 31
          ? `${intToIpv4(sub)} – ${intToIpv4(bc)}`
          : `${intToIpv4(sub + 1n)} – ${intToIpv4(bc - 1n)}`,
        broadcast: intToIpv4(bc),
        hosts: formatBig(usable)
      });
    } else {
      const last = sub + step - 1n;
      subnets.push({
        cidr: `${intToIpv6(sub)}/${newPrefix}`,
        network: intToIpv6(sub),
        range: `${intToIpv6(sub)} – ${intToIpv6(last)}`,
        broadcast: '—',
        hosts: formatBig(step)
      });
    }
  }
  return { subnets, total: count, shown, step };
}

/* ===================== VLSM ===================== */

// Aloca sub-redes de tamanho variável a partir de requisitos de hosts.
// requirements: [{ name, hosts }]  -> ordena do maior para o menor e aloca sequencialmente
function calcVLSM(ip, basePrefix, requirements, version) {
  const isV4 = version === 'ipv4';
  const maxPrefix = isV4 ? 32 : 128;
  const base = calcSubnet(ip, basePrefix, version);
  let cursor = base.network;
  const baseEnd = base.network + base.totalAddr - 1n;

  // Ordena por hosts desc (aloca os blocos maiores primeiro para evitar fragmentação)
  const reqs = [...requirements].sort((a, b) => b.hosts - a.hosts);

  const results = [];
  for (const req of reqs) {
    // Precisa de req.hosts + 2 (rede + broadcast) no IPv4; no IPv6 usamos /64 por padrão salvo pedido menor
    const needed = isV4 ? req.hosts + 2 : req.hosts;
    // Encontra o menor prefixo que comporta "needed"
    let hostBits = 0;
    while ((1n << BigInt(hostBits)) < BigInt(Math.max(needed, 1))) hostBits++;
    const prefix = maxPrefix - hostBits;
    if (prefix < basePrefix) throw new Error(`"${req.name}" が大きすぎてベースネットワークに収まりません。`);

    const size = 1n << BigInt(hostBits);
    // Alinha o cursor ao tamanho do bloco
    const rem = cursor % size;
    if (rem !== 0n) cursor += size - rem;

    if (cursor + size - 1n > baseEnd) {
      throw new Error(`アドレスが足りません（"${req.name}" を割り当て中）。`);
    }

    const sub = cursor;
    const end = cursor + size - 1n;
    if (isV4) {
      const usable = prefix >= 31 ? (prefix === 32 ? 1n : 2n) : size - 2n;
      results.push({
        name: req.name,
        requested: req.hosts,
        cidr: `${intToIpv4(sub)}/${prefix}`,
        mask: intToIpv4(ipv4Mask(prefix)),
        network: intToIpv4(sub),
        range: prefix >= 31 ? `${intToIpv4(sub)} – ${intToIpv4(end)}` : `${intToIpv4(sub + 1n)} – ${intToIpv4(end - 1n)}`,
        broadcast: intToIpv4(end),
        usable: formatBig(usable)
      });
    } else {
      results.push({
        name: req.name,
        requested: req.hosts,
        cidr: `${intToIpv6(sub)}/${prefix}`,
        mask: `/${prefix}`,
        network: intToIpv6(sub),
        range: `${intToIpv6(sub)} – ${intToIpv6(end)}`,
        broadcast: '—',
        usable: formatBig(size)
      });
    }
    cursor = end + 1n;
  }
  return results;
}

/* ===================== Detecção de versão ===================== */

function detectVersion(ip) {
  if (ip.includes(':')) return 'ipv6';
  if (ip.includes('.')) return 'ipv4';
  return null;
}

// Aceita "192.168.0.1/24" ou "192.168.0.1" + prefixo do select
function parseIpInput(raw, fallbackPrefix) {
  let ip = raw.trim();
  let prefix = fallbackPrefix;
  if (ip.includes('/')) {
    const [a, b] = ip.split('/');
    ip = a.trim();
    prefix = parseInt(b, 10);
  }
  const version = detectVersion(ip);
  if (!version) throw new Error('有効な IPv4 または IPv6 アドレスを入力してください。');
  if (isNaN(prefix)) throw new Error('プレフィックス（CIDR）を指定してください。');
  return { ip, prefix, version };
}

/* ===================== Histórico (localStorage) ===================== */

const HISTORY_KEY = 'subnet_calc_history';

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveToHistory(entry) {
  const hist = loadHistory();
  hist.unshift(entry);
  // Mantém no máximo 30 entradas
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 30)));
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

function renderHistory() {
  const box = document.getElementById('history-list');
  if (!box) return;
  const hist = loadHistory();
  if (hist.length === 0) {
    box.innerHTML = '<p class="sc-empty">まだ計算履歴がありません。</p>';
    return;
  }
  box.innerHTML = '';
  hist.forEach((h, idx) => {
    const row = document.createElement('div');
    row.className = 'sc-history-row';
    const when = new Date(h.at).toLocaleString('ja-JP');
    row.innerHTML = `
      <div class="sc-history-main">
        <span class="sc-history-cidr">${h.input}</span>
        <span class="sc-history-tag">${h.version.toUpperCase()}${h.kind ? ' · ' + h.kind : ''}</span>
        <span class="sc-history-summary">${h.summary || ''}</span>
      </div>
      <div class="sc-history-side">
        <span class="sc-history-when">${when}</span>
        <button class="sc-history-reuse" data-idx="${idx}">再利用</button>
      </div>`;
    box.appendChild(row);
  });
  box.querySelectorAll('.sc-history-reuse').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = loadHistory()[Number(btn.dataset.idx)];
      if (!h) return;
      document.querySelector('.sc-tab[data-tab="calc"]').click();
      document.getElementById('calc-ip').value = h.input;
      document.getElementById('calc-form').requestSubmit();
    });
  });
}

/* ===================== Renderização de resultados ===================== */

function renderResultTable(result) {
  const box = document.getElementById('calc-result');
  const rows = result.rows.map(([k, v]) =>
    `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
  box.innerHTML = `<table class="sc-table"><tbody>${rows}</tbody></table>`;
  box.hidden = false;
}

/* ===================== Wiring da UI ===================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- Abas ---
  const tabs = document.querySelectorAll('.sc-tab');
  const panels = document.querySelectorAll('.sc-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // --- Calculadora ---
  const calcForm = document.getElementById('calc-form');
  const calcStatus = document.getElementById('calc-status');
  calcForm.addEventListener('submit', (e) => {
    e.preventDefault();
    calcStatus.textContent = '';
    try {
      const raw = document.getElementById('calc-ip').value;
      const prefixSel = document.getElementById('calc-prefix').value;
      const { ip, prefix, version } = parseIpInput(raw, parseInt(prefixSel, 10));
      const result = calcSubnet(ip, prefix, version);
      renderResultTable(result);
      const summary = version === 'ipv4'
        ? result.rows.find(r => r[0] === '使用可能ホスト数')[1] + ' hosts'
        : result.rows.find(r => r[0] === 'アドレス数')[1] + ' addr';
      saveToHistory({ input: `${ip}/${prefix}`, version, kind: '計算', summary, at: Date.now() });
    } catch (err) {
      document.getElementById('calc-result').hidden = true;
      calcStatus.textContent = '⚠ ' + err.message;
    }
  });

  // --- Geração automática de subnets ---
  const genForm = document.getElementById('gen-form');
  const genStatus = document.getElementById('gen-status');
  const genMode = document.getElementById('gen-mode');
  genForm.addEventListener('submit', (e) => {
    e.preventDefault();
    genStatus.textContent = '';
    try {
      const raw = document.getElementById('gen-ip').value;
      const basePfx = parseInt(document.getElementById('gen-base-prefix').value, 10);
      const { ip, prefix, version } = parseIpInput(raw, basePfx);
      const maxPrefix = version === 'ipv4' ? 32 : 128;

      let newPrefix;
      if (genMode.value === 'prefix') {
        newPrefix = parseInt(document.getElementById('gen-new-prefix').value, 10);
      } else {
        // Por quantidade de subredes: encontra prefixo que gere >= N subredes
        const wanted = parseInt(document.getElementById('gen-count').value, 10);
        if (!wanted || wanted < 1) throw new Error('サブネット数を入力してください。');
        let bits = 0;
        while ((1 << bits) < wanted) bits++;
        newPrefix = prefix + bits;
        if (newPrefix > maxPrefix) throw new Error(`要求されたサブネット数が多すぎます（最大プレフィックス ${maxPrefix}）。`);
      }

      const { subnets, total, shown, step } = generateSubnets(ip, prefix, newPrefix, version);
      const head = version === 'ipv4'
        ? '<tr><th>#</th><th>CIDR</th><th>ネットワーク</th><th>ホスト範囲</th><th>ブロードキャスト</th><th>ホスト数</th></tr>'
        : '<tr><th>#</th><th>CIDR</th><th>ネットワーク</th><th>アドレス範囲</th><th>アドレス数</th></tr>';
      const body = subnets.map((s, i) => version === 'ipv4'
        ? `<tr><td>${i + 1}</td><td>${s.cidr}</td><td>${s.network}</td><td>${s.range}</td><td>${s.broadcast}</td><td>${s.hosts}</td></tr>`
        : `<tr><td>${i + 1}</td><td>${s.cidr}</td><td>${s.network}</td><td>${s.range}</td><td>${s.hosts}</td></tr>`
      ).join('');

      const note = total > shown
        ? `<p class="sc-note">合計 ${formatBig(total)} サブネットのうち最初の ${formatBig(shown)} 件を表示。</p>`
        : `<p class="sc-note">${formatBig(total)} 件のサブネットを生成しました。</p>`;

      document.getElementById('gen-result').innerHTML =
        note + `<div class="sc-table-wrap"><table class="sc-table sc-table-list"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
      document.getElementById('gen-result').hidden = false;

      saveToHistory({
        input: `${ip}/${prefix} → /${newPrefix}`,
        version, kind: '分割',
        summary: `${formatBig(total)} サブネット`,
        at: Date.now()
      });
    } catch (err) {
      document.getElementById('gen-result').hidden = true;
      genStatus.textContent = '⚠ ' + err.message;
    }
  });

  // Alterna campos entre "por prefixo" e "por quantidade"
  genMode.addEventListener('change', () => {
    const byPrefix = genMode.value === 'prefix';
    document.getElementById('gen-prefix-field').hidden = !byPrefix;
    document.getElementById('gen-count-field').hidden = byPrefix;
  });

  // --- VLSM ---
  const vlsmRows = document.getElementById('vlsm-rows');
  function addVlsmRow(name = '', hosts = '') {
    const row = document.createElement('div');
    row.className = 'sc-vlsm-req';
    row.innerHTML = `
      <input type="text" class="vlsm-name" placeholder="部署名（例: 営業部）" value="${name}">
      <input type="number" class="vlsm-hosts" placeholder="必要ホスト数" min="1" value="${hosts}">
      <button type="button" class="vlsm-remove" title="削除">✕</button>`;
    row.querySelector('.vlsm-remove').addEventListener('click', () => row.remove());
    vlsmRows.appendChild(row);
  }
  document.getElementById('vlsm-add').addEventListener('click', () => addVlsmRow());
  // Duas linhas iniciais
  addVlsmRow('LAN-A', '50');
  addVlsmRow('LAN-B', '20');

  const vlsmForm = document.getElementById('vlsm-form');
  const vlsmStatus = document.getElementById('vlsm-status');
  vlsmForm.addEventListener('submit', (e) => {
    e.preventDefault();
    vlsmStatus.textContent = '';
    try {
      const raw = document.getElementById('vlsm-ip').value;
      const basePfx = parseInt(document.getElementById('vlsm-base-prefix').value, 10);
      const { ip, prefix, version } = parseIpInput(raw, basePfx);

      const reqs = [];
      vlsmRows.querySelectorAll('.sc-vlsm-req').forEach(r => {
        const name = r.querySelector('.vlsm-name').value.trim() || 'サブネット';
        const hosts = parseInt(r.querySelector('.vlsm-hosts').value, 10);
        if (hosts && hosts > 0) reqs.push({ name, hosts });
      });
      if (reqs.length === 0) throw new Error('少なくとも 1 つのホスト要件を入力してください。');

      const results = calcVLSM(ip, prefix, reqs, version);
      const head = version === 'ipv4'
        ? '<tr><th>名前</th><th>要求</th><th>CIDR</th><th>マスク</th><th>ネットワーク</th><th>範囲</th><th>ブロードキャスト</th><th>使用可能</th></tr>'
        : '<tr><th>名前</th><th>要求</th><th>CIDR</th><th>ネットワーク</th><th>範囲</th><th>アドレス数</th></tr>';
      const body = results.map(r => version === 'ipv4'
        ? `<tr><td>${r.name}</td><td>${formatBig(r.requested)}</td><td>${r.cidr}</td><td>${r.mask}</td><td>${r.network}</td><td>${r.range}</td><td>${r.broadcast}</td><td>${r.usable}</td></tr>`
        : `<tr><td>${r.name}</td><td>${formatBig(r.requested)}</td><td>${r.cidr}</td><td>${r.network}</td><td>${r.range}</td><td>${r.usable}</td></tr>`
      ).join('');

      document.getElementById('vlsm-result').innerHTML =
        `<div class="sc-table-wrap"><table class="sc-table sc-table-list"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
      document.getElementById('vlsm-result').hidden = false;

      saveToHistory({
        input: `${ip}/${prefix}`,
        version, kind: 'VLSM',
        summary: `${results.length} サブネット割り当て`,
        at: Date.now()
      });
    } catch (err) {
      document.getElementById('vlsm-result').hidden = true;
      vlsmStatus.textContent = '⚠ ' + err.message;
    }
  });

  // --- Histórico ---
  document.getElementById('history-clear').addEventListener('click', clearHistory);
  renderHistory();
});
