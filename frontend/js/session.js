function getToken() {
  return localStorage.getItem('taverna_token');
}

function getUser() {
  const raw = localStorage.getItem('taverna_user');
  return raw ? JSON.parse(raw) : null;
}

function logout() {
  localStorage.removeItem('taverna_token');
  localStorage.removeItem('taverna_user');
  window.location.reload();
}

// Monta o cabeçalho: menu "SNS" à esquerda, título no centro, menu "ツール" (ferramentas) à direita.
function buildNav() {
  const header = document.querySelector('header');
  if (!header) return;

  const isInPages = window.location.pathname.includes('/pages/');
  const prefix = isInPages ? '' : 'pages/';   // caminho para páginas em /pages/
  const rootPrefix = isInPages ? '../' : '';   // caminho para a home

  // Remove qualquer nav antigo (links hardcoded no HTML) e evita duplicar em recarga
  header.querySelectorAll('nav, .nav-side').forEach(n => n.remove());

  const token = getToken();
  const user = getUser();

  // Ferramentas (menu da direita) — sempre disponíveis
  const tools = [
    ['画像コンバーター', `${prefix}image-converter.html`],
    ['動画・音声ダウンローダー', `${prefix}video-downloader.html`],
    ['音声コンバーター', `${prefix}audio-converter.html`],
    ['音楽プレーヤー', `${prefix}music-player.html`],
    ['無料の本', `${prefix}free-books.html`],
    ['Linuxディストロ', `${prefix}linux-distros.html`],
    ['便利なスクリプト', `${prefix}scripts.html`]
  ];

  // SNS (menu da esquerda) — depende de estar logado
  const snsItems = token && user
    ? [
        ['ホーム', `${rootPrefix}index.html`],
        ['フレンド', `${prefix}friends.html`],
        ['チャット', `${prefix}chat.html`],
        ['グループ', `${prefix}groups.html`],
        ['イベント', `${prefix}events.html`],
        ['キャンパス', `${prefix}campus.html`],
        ['マイプロフィール', `${prefix}profile.html`],
        ['サイト紹介', `${rootPrefix}intro.html`]
      ]
    : [
        ['ホーム', `${rootPrefix}index.html`],
        ['ログイン', `${prefix}login.html`],
        ['新規登録', `${prefix}register.html`]
      ];

  function buildPanel(items) {
    const panel = document.createElement('div');
    panel.className = 'nav-panel';
    items.forEach(([label, href]) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      panel.appendChild(a);
    });
    return panel;
  }

  // ----- Lado esquerdo: SNS -----
  const left = document.createElement('div');
  left.className = 'nav-side nav-left';

  const snsBtn = document.createElement('button');
  snsBtn.className = 'nav-menu-btn';
  snsBtn.textContent = 'SNS ▾';

  const snsPanel = buildPanel(snsItems);

  if (token && user) {
    const acct = document.createElement('span');
    acct.className = 'nav-account';
    acct.textContent = `👤 ${user.email}`;
    snsPanel.appendChild(acct);

    const logoutLink = document.createElement('a');
    logoutLink.href = '#';
    logoutLink.textContent = 'ログアウト';
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
    snsPanel.appendChild(logoutLink);
  }

  left.appendChild(snsBtn);
  left.appendChild(snsPanel);

  // ----- Lado direito: Ferramentas -----
  const right = document.createElement('div');
  right.className = 'nav-side nav-right';

  const toolsBtn = document.createElement('button');
  toolsBtn.className = 'nav-menu-btn';
  toolsBtn.textContent = 'ツール ▾';

  const toolsPanel = buildPanel(tools);

  right.appendChild(toolsBtn);
  right.appendChild(toolsPanel);

  // Insere: esquerda antes do título, direita depois
  const h1 = header.querySelector('h1');
  if (h1) header.insertBefore(left, h1);
  else header.prepend(left);
  header.appendChild(right);

  // Abrir/fechar os menus
  function toggle(panel, other) {
    return (e) => {
      e.stopPropagation();
      other.classList.remove('open');
      panel.classList.toggle('open');
    };
  }
  snsBtn.addEventListener('click', toggle(snsPanel, toolsPanel));
  toolsBtn.addEventListener('click', toggle(toolsPanel, snsPanel));
  [snsPanel, toolsPanel].forEach(p => p.addEventListener('click', (e) => e.stopPropagation()));
  document.addEventListener('click', () => {
    snsPanel.classList.remove('open');
    toolsPanel.classList.remove('open');
  });
}

buildNav();


// Fundo de vídeo (taverna) em loop — só na página de perfil, atrás de tudo e escurecido pelo CSS
function addSiteBackground() {
  if (!window.location.pathname.includes('profile.html')) return; // só no perfil
  if (document.getElementById('site-bg')) return;
  const isInPages = window.location.pathname.includes('/pages/');
  const src = (isInPages ? '../' : '') + 'assets/img/tavern-bg.mp4';

  const bg = document.createElement('div');
  bg.id = 'site-bg';

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;         // obrigatório pro autoplay não ser bloqueado
  video.loop = true;
  video.setAttribute('playsinline', ''); // iOS não abre em tela cheia
  video.src = src;

  bg.appendChild(video);
  document.body.prepend(bg);
}
addSiteBackground();


// Carrega o sistema de notificações (sino) se o usuário estiver logado
if (localStorage.getItem('taverna_token')) {
  const isInPages = window.location.pathname.includes('/pages/');

  const loadNotifScript = () => {
    const notifScript = document.createElement('script');
    notifScript.src = isInPages ? '../js/notifications.js' : 'js/notifications.js';
    document.body.appendChild(notifScript);
  };

  // Páginas como chat/groups já incluem o socket.io. Só carrega do CDN se ainda não existir.
  if (typeof io !== 'undefined') {
    loadNotifScript();
  } else {
    const socketIoScript = document.createElement('script');
    socketIoScript.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
    socketIoScript.onload = loadNotifScript;
    document.body.appendChild(socketIoScript);
  }
}
