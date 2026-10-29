/* =====================================================================
   i18n — tradução da UI em runtime + seletor de idioma (JP/EN/PT/ES).

   Como funciona (sem precisar editar os HTMLs um a um):
   - O idioma de origem da UI é o JAPONÊS. O dicionário mapeia a string
     japonesa -> tradução em en/pt/es.
   - Ao carregar, percorre os nós de texto e alguns atributos
     (placeholder/title/aria-label) e troca os que estão no dicionário.
   - Um MutationObserver traduz o que os outros scripts inserem depois
     (feed, mensagens de status, erros vindos da API etc.).
   - Conteúdo de usuário (posts, comentários, nomes) é pulado via
     SKIP_SELECTORS, então nunca é "traduzido".
   - Trocar de idioma salva em localStorage e recarrega a página (simples
     e confiável: a página re-renderiza em JP e é traduzida de novo).

   Estratégia de backend: as mensagens de erro da API chegam em japonês e
   são exibidas no DOM; por estarem no dicionário, o Observer as traduz no
   cliente — sem alterar os controllers.
   ===================================================================== */
(function () {
  'use strict';

  var SUPPORTED = ['ja', 'en', 'pt', 'es'];
  var NAMES = { ja: '日本語', en: 'English', pt: 'Português', es: 'Español' };
  var SHORT = { ja: '日本語', en: 'EN', pt: 'PT', es: 'ES' };

  // Elementos cujo texto é conteúdo de usuário — nunca traduzir.
  var SKIP_SELECTORS = [
    '[data-no-i18n]', '.post-content', '.post-author-name', '.comment-item',
    '.comment-author', '.conversation-name', '.conversation-preview',
    '.friend-name', '.request-name', '.friend-course', '.chat-message',
    '.message-content', '.nav-account', '.gs-item'
  ].join(',');

  // ---- Dicionário (chave = japonês de origem) ----
  var DICT = {
    en: {
      // Navegação / header
      'SNS ▾': 'Social ▾', 'ツール ▾': 'Tools ▾', '検索': 'Search',
      'ログアウト': 'Log out', 'ホーム': 'Home', 'フレンド・チャット': 'Friends & Chat',
      'イベント': 'Events', 'キャンパス': 'Campus', 'タイピングゲーム': 'Typing game',
      'マイプロフィール': 'My profile', 'サイト紹介': 'About', 'ログイン': 'Log in',
      '新規登録': 'Sign up', '管理': 'Admin',
      '画像コンバーター': 'Image converter', '動画・音声ダウンローダー': 'Video / audio downloader',
      '音声コンバーター': 'Audio converter', '音楽プレーヤー': 'Music player',
      'QRコードジェネレーター': 'QR code generator', 'サブネット計算機': 'Subnet calculator',
      '無料の本': 'Free books', 'Linuxディストロ': 'Linux distros', '便利なスクリプト': 'Handy scripts',
      'Linuxラボ': 'Linux lab', 'Ciscoラボ': 'Cisco lab',
      // Home / feed
      'Blackbeard Tavern へようこそ — オールインワンのツールボックスです。': 'Welcome to Blackbeard Tavern — your all-in-one toolbox.',
      'コミュニティフィード': 'Community feed',
      'いま何を考えていますか、海賊さん？': "What's on your mind, pirate?",
      '📎 メディアを添付': '📎 Attach media', '投稿': 'Post', 'フィードを読み込み中...': 'Loading feed...',
      'まだ投稿がありません。最初の投稿をしましょう！': 'No posts yet. Be the first to post!',
      'フィードの読み込みに失敗しました。': 'Failed to load the feed.',
      'コメントを読み込み中...': 'Loading comments...', 'まだコメントがありません。': 'No comments yet.',
      'コメントの読み込みに失敗しました。': 'Failed to load comments.',
      'コメントを書く...': 'Write a comment...', '送信': 'Send', 'コメント': 'Comment',
      'コメントするには': 'To comment, ', 'してください。': ' please.', '通報': 'Report',
      '削除': 'Delete', 'メニュー': 'Menu', 'いいね': 'Like',
      // Login
      'パスワード': 'Password', 'パスワードをお忘れですか？': 'Forgot your password?',
      'ログイン中...': 'Logging in...', 'ログインに失敗しました': 'Login failed',
      'ログイン成功！リダイレクトしています...': 'Logged in! Redirecting...',
      // Registro
      'アカウントを作成': 'Create account',
      '@g.neec.ac.jp のメールを持つ学生のみ登録できます。': 'Only students with an @g.neec.ac.jp email can register.',
      'パスワード（8文字以上）': 'Password (8+ characters)',
      'アカウントを作成中...': 'Creating account...', '登録に失敗しました': 'Registration failed',
      // Perfil
      'プロフィール写真': 'Profile picture', 'Picture Input': 'Choose a picture',
      '写真をアップロード': 'Upload photo', '写真を削除': 'Remove photo',
      '表示名': 'Display name', '他のユーザーに表示される名前': 'Name shown to other users',
      '匿名のままにする（他のユーザーに名前を表示しない）': "Stay anonymous (don't show my name to others)",
      'コース': 'Course', '例：情報技術': 'e.g. Information Technology', '性別': 'Gender',
      '回答しない': 'Prefer not to say', '男性': 'Male', '女性': 'Female', 'その他': 'Other',
      'プロフィールを保存': 'Save profile', 'アカウントの削除': 'Delete account',
      'アカウントを削除すると、投稿・メッセージ・フレンドなど、すべてのデータが完全に削除されます。この操作は取り消せません。':
        'Deleting your account permanently removes all your data — posts, messages, friends and more. This cannot be undone.',
      'アカウントを削除': 'Delete account',
      '確認のため、現在のパスワードを入力してください。': 'Please enter your current password to confirm.',
      'キャンセル': 'Cancel', '完全に削除する': 'Delete permanently',
      'プロフィールの読み込みに失敗しました。': 'Failed to load profile.', '保存中...': 'Saving...',
      'プロフィールの保存に失敗しました': 'Failed to save profile', 'プロフィールを保存しました！': 'Profile saved!',
      'まず画像を選択してください。': 'Please choose an image first.', '写真をアップロード中...': 'Uploading photo...',
      '写真のアップロードに失敗しました': 'Failed to upload photo', 'プロフィール写真を更新しました！': 'Profile picture updated!',
      'プロフィール写真を削除しますか？': 'Delete your profile picture?', '写真を削除中...': 'Removing photo...',
      '写真の削除に失敗しました': 'Failed to remove photo', 'プロフィール写真を削除しました。': 'Profile picture removed.',
      'パスワードを入力してください。': 'Please enter your password.', '削除中...': 'Deleting...',
      '削除に失敗しました': 'Deletion failed',
      // Mensagens de erro do backend (auth / perfil / conta)
      'g.neec.ac.jp のメールのみ利用できます': 'Only @g.neec.ac.jp emails can be used',
      'パスワードは8文字以上である必要があります': 'Password must be at least 8 characters.',
      'このメールアドレスのアカウントは既に存在します': 'An account with this email already exists.',
      'アカウントを作成しました。メールを確認してアカウントを認証してください。': 'Account created. Check your email to verify your account.',
      'メールアドレスとパスワードは必須です': 'Email and password are required.',
      'メールアドレスまたはパスワードが正しくありません': 'Incorrect email or password.',
      'ログインする前にメールを認証してください': 'Please verify your email before logging in.',
      'このアカウントは停止されています': 'This account has been suspended.',
      'アカウントを削除しました。': 'Account deleted.',
      '© 2026 Blackbeard Tavern': '© 2026 Blackbeard Tavern'
    },
    pt: {
      'SNS ▾': 'Social ▾', 'ツール ▾': 'Ferramentas ▾', '検索': 'Buscar',
      'ログアウト': 'Sair', 'ホーム': 'Início', 'フレンド・チャット': 'Amigos e chat',
      'イベント': 'Eventos', 'キャンパス': 'Campus', 'タイピングゲーム': 'Jogo de digitação',
      'マイプロフィール': 'Meu perfil', 'サイト紹介': 'Sobre o site', 'ログイン': 'Entrar',
      '新規登録': 'Cadastrar', '管理': 'Admin',
      '画像コンバーター': 'Conversor de imagem', '動画・音声ダウンローダー': 'Baixador de vídeo e áudio',
      '音声コンバーター': 'Conversor de áudio', '音楽プレーヤー': 'Reprodutor de música',
      'QRコードジェネレーター': 'Gerador de QR code', 'サブネット計算機': 'Calculadora de sub-rede',
      '無料の本': 'Livros grátis', 'Linuxディストロ': 'Distros Linux', '便利なスクリプト': 'Scripts úteis',
      'Linuxラボ': 'Laboratório Linux', 'Ciscoラボ': 'Laboratório Cisco',
      'Blackbeard Tavern へようこそ — オールインワンのツールボックスです。': 'Bem-vindo à Blackbeard Tavern — sua caixa de ferramentas tudo-em-um.',
      'コミュニティフィード': 'Feed da comunidade',
      'いま何を考えていますか、海賊さん？': 'No que você está pensando, pirata?',
      '📎 メディアを添付': '📎 Anexar mídia', '投稿': 'Publicar', 'フィードを読み込み中...': 'Carregando feed...',
      'まだ投稿がありません。最初の投稿をしましょう！': 'Ainda não há posts. Faça o primeiro!',
      'フィードの読み込みに失敗しました。': 'Falha ao carregar o feed.',
      'コメントを読み込み中...': 'Carregando comentários...', 'まだコメントがありません。': 'Ainda não há comentários.',
      'コメントの読み込みに失敗しました。': 'Falha ao carregar os comentários.',
      'コメントを書く...': 'Escreva um comentário...', '送信': 'Enviar', 'コメント': 'Comentário',
      'コメントするには': 'Para comentar, ', 'してください。': '.', '通報': 'Denunciar',
      '削除': 'Excluir', 'メニュー': 'Menu', 'いいね': 'Curtir',
      'パスワード': 'Senha', 'パスワードをお忘れですか？': 'Esqueceu sua senha?',
      'ログイン中...': 'Entrando...', 'ログインに失敗しました': 'Falha ao entrar',
      'ログイン成功！リダイレクトしています...': 'Login efetuado! Redirecionando...',
      'アカウントを作成': 'Criar conta',
      '@g.neec.ac.jp のメールを持つ学生のみ登録できます。': 'Apenas estudantes com e-mail @g.neec.ac.jp podem se cadastrar.',
      'パスワード（8文字以上）': 'Senha (8+ caracteres)',
      'アカウントを作成中...': 'Criando conta...', '登録に失敗しました': 'Falha no cadastro',
      'プロフィール写真': 'Foto de perfil', 'Picture Input': 'Escolher uma foto',
      '写真をアップロード': 'Enviar foto', '写真を削除': 'Remover foto',
      '表示名': 'Nome de exibição', '他のユーザーに表示される名前': 'Nome exibido a outros usuários',
      '匿名のままにする（他のユーザーに名前を表示しない）': 'Permanecer anônimo (não mostrar meu nome aos outros)',
      'コース': 'Curso', '例：情報技術': 'ex.: Tecnologia da Informação', '性別': 'Gênero',
      '回答しない': 'Prefiro não dizer', '男性': 'Masculino', '女性': 'Feminino', 'その他': 'Outro',
      'プロフィールを保存': 'Salvar perfil', 'アカウントの削除': 'Excluir conta',
      'アカウントを削除すると、投稿・メッセージ・フレンドなど、すべてのデータが完全に削除されます。この操作は取り消せません。':
        'Excluir sua conta remove permanentemente todos os seus dados — posts, mensagens, amigos e mais. Esta ação não pode ser desfeita.',
      'アカウントを削除': 'Excluir conta',
      '確認のため、現在のパスワードを入力してください。': 'Digite sua senha atual para confirmar.',
      'キャンセル': 'Cancelar', '完全に削除する': 'Excluir definitivamente',
      'プロフィールの読み込みに失敗しました。': 'Falha ao carregar o perfil.', '保存中...': 'Salvando...',
      'プロフィールの保存に失敗しました': 'Falha ao salvar o perfil', 'プロフィールを保存しました！': 'Perfil salvo!',
      'まず画像を選択してください。': 'Escolha uma imagem primeiro.', '写真をアップロード中...': 'Enviando foto...',
      '写真のアップロードに失敗しました': 'Falha ao enviar a foto', 'プロフィール写真を更新しました！': 'Foto de perfil atualizada!',
      'プロフィール写真を削除しますか？': 'Excluir sua foto de perfil?', '写真を削除中...': 'Removendo foto...',
      '写真の削除に失敗しました': 'Falha ao remover a foto', 'プロフィール写真を削除しました。': 'Foto de perfil removida.',
      'パスワードを入力してください。': 'Digite sua senha.', '削除中...': 'Excluindo...',
      '削除に失敗しました': 'Falha ao excluir',
      'g.neec.ac.jp のメールのみ利用できます': 'Apenas e-mails @g.neec.ac.jp podem ser usados',
      'パスワードは8文字以上である必要があります': 'A senha precisa ter ao menos 8 caracteres.',
      'このメールアドレスのアカウントは既に存在します': 'Já existe uma conta com este e-mail.',
      'アカウントを作成しました。メールを確認してアカウントを認証してください。': 'Conta criada. Verifique seu e-mail para confirmar a conta.',
      'メールアドレスとパスワードは必須です': 'E-mail e senha são obrigatórios.',
      'メールアドレスまたはパスワードが正しくありません': 'E-mail ou senha incorretos.',
      'ログインする前にメールを認証してください': 'Verifique seu e-mail antes de entrar.',
      'このアカウントは停止されています': 'Esta conta foi suspensa.',
      'アカウントを削除しました。': 'Conta excluída.',
      '© 2026 Blackbeard Tavern': '© 2026 Blackbeard Tavern'
    },
    es: {
      'SNS ▾': 'Social ▾', 'ツール ▾': 'Herramientas ▾', '検索': 'Buscar',
      'ログアウト': 'Cerrar sesión', 'ホーム': 'Inicio', 'フレンド・チャット': 'Amigos y chat',
      'イベント': 'Eventos', 'キャンパス': 'Campus', 'タイピングゲーム': 'Juego de mecanografía',
      'マイプロフィール': 'Mi perfil', 'サイト紹介': 'Acerca del sitio', 'ログイン': 'Iniciar sesión',
      '新規登録': 'Registrarse', '管理': 'Admin',
      '画像コンバーター': 'Conversor de imágenes', '動画・音声ダウンローダー': 'Descargador de video y audio',
      '音声コンバーター': 'Conversor de audio', '音楽プレーヤー': 'Reproductor de música',
      'QRコードジェネレーター': 'Generador de código QR', 'サブネット計算機': 'Calculadora de subredes',
      '無料の本': 'Libros gratis', 'Linuxディストロ': 'Distros de Linux', '便利なスクリプト': 'Scripts útiles',
      'Linuxラボ': 'Laboratorio Linux', 'Ciscoラボ': 'Laboratorio Cisco',
      'Blackbeard Tavern へようこそ — オールインワンのツールボックスです。': 'Bienvenido a Blackbeard Tavern — tu caja de herramientas todo en uno.',
      'コミュニティフィード': 'Feed de la comunidad',
      'いま何を考えていますか、海賊さん？': '¿Qué estás pensando, pirata?',
      '📎 メディアを添付': '📎 Adjuntar medio', '投稿': 'Publicar', 'フィードを読み込み中...': 'Cargando feed...',
      'まだ投稿がありません。最初の投稿をしましょう！': 'Aún no hay publicaciones. ¡Sé el primero!',
      'フィードの読み込みに失敗しました。': 'Error al cargar el feed.',
      'コメントを読み込み中...': 'Cargando comentarios...', 'まだコメントがありません。': 'Aún no hay comentarios.',
      'コメントの読み込みに失敗しました。': 'Error al cargar los comentarios.',
      'コメントを書く...': 'Escribe un comentario...', '送信': 'Enviar', 'コメント': 'Comentario',
      'コメントするには': 'Para comentar, ', 'してください。': '.', '通報': 'Reportar',
      '削除': 'Eliminar', 'メニュー': 'Menú', 'いいね': 'Me gusta',
      'パスワード': 'Contraseña', 'パスワードをお忘れですか？': '¿Olvidaste tu contraseña?',
      'ログイン中...': 'Iniciando sesión...', 'ログインに失敗しました': 'Error al iniciar sesión',
      'ログイン成功！リダイレクトしています...': '¡Sesión iniciada! Redirigiendo...',
      'アカウントを作成': 'Crear cuenta',
      '@g.neec.ac.jp のメールを持つ学生のみ登録できます。': 'Solo estudiantes con correo @g.neec.ac.jp pueden registrarse.',
      'パスワード（8文字以上）': 'Contraseña (8+ caracteres)',
      'アカウントを作成中...': 'Creando cuenta...', '登録に失敗しました': 'Error en el registro',
      'プロフィール写真': 'Foto de perfil', 'Picture Input': 'Elegir una foto',
      '写真をアップロード': 'Subir foto', '写真を削除': 'Eliminar foto',
      '表示名': 'Nombre visible', '他のユーザーに表示される名前': 'Nombre mostrado a otros usuarios',
      '匿名のままにする（他のユーザーに名前を表示しない）': 'Permanecer anónimo (no mostrar mi nombre a otros)',
      'コース': 'Curso', '例：情報技術': 'ej.: Tecnología de la Información', '性別': 'Género',
      '回答しない': 'Prefiero no decir', '男性': 'Masculino', '女性': 'Femenino', 'その他': 'Otro',
      'プロフィールを保存': 'Guardar perfil', 'アカウントの削除': 'Eliminar cuenta',
      'アカウントを削除すると、投稿・メッセージ・フレンドなど、すべてのデータが完全に削除されます。この操作は取り消せません。':
        'Eliminar tu cuenta borra permanentemente todos tus datos — publicaciones, mensajes, amigos y más. Esta acción no se puede deshacer.',
      'アカウントを削除': 'Eliminar cuenta',
      '確認のため、現在のパスワードを入力してください。': 'Introduce tu contraseña actual para confirmar.',
      'キャンセル': 'Cancelar', '完全に削除する': 'Eliminar definitivamente',
      'プロフィールの読み込みに失敗しました。': 'Error al cargar el perfil.', '保存中...': 'Guardando...',
      'プロフィールの保存に失敗しました': 'Error al guardar el perfil', 'プロフィールを保存しました！': '¡Perfil guardado!',
      'まず画像を選択してください。': 'Primero elige una imagen.', '写真をアップロード中...': 'Subiendo foto...',
      '写真のアップロードに失敗しました': 'Error al subir la foto', 'プロフィール写真を更新しました！': '¡Foto de perfil actualizada!',
      'プロフィール写真を削除しますか？': '¿Eliminar tu foto de perfil?', '写真を削除中...': 'Eliminando foto...',
      '写真の削除に失敗しました': 'Error al eliminar la foto', 'プロフィール写真を削除しました。': 'Foto de perfil eliminada.',
      'パスワードを入力してください。': 'Introduce tu contraseña.', '削除中...': 'Eliminando...',
      '削除に失敗しました': 'Error al eliminar',
      'g.neec.ac.jp のメールのみ利用できます': 'Solo se permiten correos @g.neec.ac.jp',
      'パスワードは8文字以上である必要があります': 'La contraseña debe tener al menos 8 caracteres.',
      'このメールアドレスのアカウントは既に存在します': 'Ya existe una cuenta con este correo.',
      'アカウントを作成しました。メールを確認してアカウントを認証してください。': 'Cuenta creada. Revisa tu correo para verificar la cuenta.',
      'メールアドレスとパスワードは必須です': 'El correo y la contraseña son obligatorios.',
      'メールアドレスまたはパスワードが正しくありません': 'Correo o contraseña incorrectos.',
      'ログインする前にメールを認証してください': 'Verifica tu correo antes de iniciar sesión.',
      'このアカウントは停止されています': 'Esta cuenta ha sido suspendida.',
      'アカウントを削除しました。': 'Cuenta eliminada.',
      '© 2026 Blackbeard Tavern': '© 2026 Blackbeard Tavern'
    }
  };

  // ---- Detecção de idioma ----
  function detect() {
    try {
      var saved = localStorage.getItem('taverna_lang');
      if (SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (e) {}
    var navs = navigator.languages || [navigator.language || 'ja'];
    for (var i = 0; i < navs.length; i++) {
      var code = String(navs[i] || '').toLowerCase().split('-')[0];
      if (SUPPORTED.indexOf(code) !== -1) return code;
    }
    return 'ja'; // base do site (estudantes de Hachioji)
  }

  var LANG = detect();
  var TABLE = DICT[LANG] || null; // null quando LANG === 'ja'

  function lookup(core) {
    if (!TABLE) return undefined;
    return TABLE[core];
  }

  // ---- Tradução de nós de texto (preservando espaços nas bordas) ----
  function translateTextNode(node) {
    var raw = node.nodeValue;
    if (!raw) return;
    var m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!m) return;
    var core = m[2];
    if (!core) return;
    var t = lookup(core);
    if (t !== undefined && t !== core) node.nodeValue = m[1] + t + m[3];
  }

  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  function translateAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute || !el.hasAttribute(a)) continue;
      var v = el.getAttribute(a);
      var tv = v && v.trim();
      if (!tv) continue;
      var t = lookup(tv);
      if (t !== undefined && t !== tv) el.setAttribute(a, t);
    }
    // valor de botões/inputs do tipo submit/button
    if (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) {
      var vv = el.value && el.value.trim();
      if (vv) { var tt = lookup(vv); if (tt !== undefined && tt !== vv) el.value = tt; }
    }
  }

  function skip(el) {
    return el && el.closest && el.closest(SKIP_SELECTORS);
  }

  function translateElement(root) {
    if (!root || !TABLE) return;
    if (root.nodeType === 3) { // texto
      if (!skip(root.parentElement)) translateTextNode(root);
      return;
    }
    if (root.nodeType !== 1) return;

    // Atributos do próprio nó + descendentes
    var all = [root];
    if (root.querySelectorAll) all = all.concat(Array.prototype.slice.call(root.querySelectorAll('*')));
    for (var i = 0; i < all.length; i++) translateAttrs(all[i]);

    // Nós de texto
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'CODE' || tag === 'PRE') return NodeFilter.FILTER_REJECT;
        if (skip(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = tw.nextNode())) nodes.push(n);
    for (var j = 0; j < nodes.length; j++) translateTextNode(nodes[j]);
  }

  function translateTitle() {
    if (!TABLE) return;
    var sep = ' - ';
    var title = document.title || '';
    if (title.indexOf(sep) !== -1) {
      var parts = title.split(sep);
      var t = lookup(parts[0].trim());
      if (t !== undefined) { parts[0] = t; document.title = parts.join(sep); }
    } else {
      var tt = lookup(title.trim());
      if (tt !== undefined) document.title = tt;
    }
  }

  // ---- Observa conteúdo inserido dinamicamente ----
  var observer = null;
  function startObserver() {
    if (!TABLE || !window.MutationObserver) return;
    observer = new MutationObserver(function (muts) {
      observer.disconnect();
      for (var i = 0; i < muts.length; i++) {
        var mu = muts[i];
        if (mu.type === 'childList') {
          for (var k = 0; k < mu.addedNodes.length; k++) translateElement(mu.addedNodes[k]);
        } else if (mu.type === 'characterData') {
          if (!skip(mu.target.parentElement)) translateTextNode(mu.target);
        }
      }
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // ---- Seletor de idioma no header ----
  function setLang(code) {
    try { localStorage.setItem('taverna_lang', code); } catch (e) {}
    location.reload();
  }

  function buildSwitcher() {
    var header = document.querySelector('header');
    if (!header || header.querySelector('.i18n-switch')) return;

    var side = document.createElement('div');
    side.className = 'nav-side nav-right i18n-switch';

    var btn = document.createElement('button');
    btn.className = 'nav-menu-btn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Language / 言語');
    btn.textContent = '🌐 ' + SHORT[LANG];

    var panel = document.createElement('div');
    panel.className = 'nav-panel';
    panel.setAttribute('role', 'menu');

    SUPPORTED.forEach(function (code) {
      var a = document.createElement('a');
      a.href = '#';
      a.setAttribute('role', 'menuitem');
      a.setAttribute('data-no-i18n', ''); // nomes dos idiomas não se traduzem
      a.textContent = NAMES[code];
      if (code === LANG) { a.style.color = 'var(--accent)'; a.setAttribute('aria-current', 'true'); }
      a.addEventListener('click', function (e) { e.preventDefault(); setLang(code); });
      panel.appendChild(a);
    });

    side.appendChild(btn);
    side.appendChild(panel);
    header.appendChild(side);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () {
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { panel.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  // ---- Init ----
  function init() {
    document.documentElement.lang = LANG;
    buildSwitcher();
    if (!TABLE) return; // japonês: nada a traduzir
    translateElement(document.body);
    translateTitle();
    startObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposto para outros scripts que queiram traduzir uma string manualmente
  window.__i18n = { t: function (s) { var r = lookup(s); return r === undefined ? s : r; }, lang: LANG };
})();
