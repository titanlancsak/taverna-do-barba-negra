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
      // Fase 2 — amigos / chat
      'フレンド': 'Friends', '学校のメールでフレンド追加': 'Add a friend by school email',
      'リクエストを送る': 'Send request', '保留中のリクエスト': 'Pending requests',
      'マイフレンド': 'My friends', 'グループ': 'Groups', '会話': 'Conversations',
      '読み込み中...': 'Loading...', '招待して会話する': 'Invite to chat', '招待': 'Invite',
      'メンバーを見る': 'View members', 'メンバー': 'Members', '閉じる': 'Close',
      'メディアを追加': 'Add media', 'メッセージを入力...': 'Type a message...',
      'グループ名': 'Group name', 'グループメンバー': 'Group members',
      '承認': 'Accept', '拒否': 'Decline', 'チャット': 'Chat', '会話を削除': 'Delete conversation',
      'グループを退出': 'Leave group', 'あいさつしよう！👋': 'Say hi! 👋',
      'まだメッセージがありません。あいさつしよう！👋': 'No messages yet. Say hi! 👋',
      'まだどのグループにも参加していません。フレンドとのチャットから「＋」で作れます。': 'You’re not in any group yet. Create one from a friend chat with the “+”.',
      'まだフレンドがいません。上から追加しましょう！': 'No friends yet. Add some above!',
      'グループの読み込みに失敗しました。': 'Failed to load groups.',
      'フレンドの読み込みに失敗しました。': 'Failed to load friends.',
      'メッセージの読み込みに失敗しました。': 'Failed to load messages.',
      'メンバーの読み込みに失敗しました。': 'Failed to load members.',
      'リクエストの読み込みに失敗しました。': 'Failed to load requests.',
      '会話がまだありません。左のフレンドから「チャット」を押しましょう！': 'No conversations yet. Press “Chat” on a friend on the left!',
      '会話の読み込みに失敗しました。': 'Failed to load conversations.',
      '保留中のリクエストはありません。': 'No pending requests.',
      '招待できるフレンドがいません。': 'No friends to invite.',
      'アップロードに失敗しました': 'Upload failed', 'グループの作成に失敗しました': 'Failed to create group',
      'グループの削除に失敗しました': 'Failed to delete group', 'グループの退出に失敗しました': 'Failed to leave group',
      'グループを作成': 'Create group', 'グループを作成中...': 'Creating group...',
      'グループ名を入力してください。': 'Please enter a group name.',
      'フレンドリクエストを送信しました！': 'Friend request sent!',
      'リクエストの送信に失敗しました': 'Failed to send request', 'リクエストを送信中...': 'Sending request...',
      '会話の削除に失敗しました': 'Failed to delete conversation',
      '少なくとも1人選んでください。': 'Please select at least one person.',
      '招待しました！': 'Invited!', '招待に失敗しました': 'Failed to invite', '招待中...': 'Inviting...',
      // Fase 2 — eventos
      'イベントを作成': 'Create event', 'イベント名': 'Event name', '時間': 'Time',
      '場所': 'Location', '説明': 'Description', '📷 写真を追加': '📷 Add photo',
      'イベントを読み込み中...': 'Loading events...',
      '今後のイベントはありません。最初のイベントを作成しましょう！': 'No upcoming events. Create the first one!',
      'イベントの読み込みに失敗しました。': 'Failed to load events.',
      '✓ 参加中（取消）': '✓ Attending (cancel)', '参加する': 'Attend', 'イベントを削除': 'Delete event',
      'イベント名を入力してください。': 'Please enter an event name.',
      '日付を入力してください。': 'Please enter a date.',
      '日付は YYYY/MM/DD の形式で入力してください。': 'Please enter the date as YYYY/MM/DD.',
      'イベントを作成中...': 'Creating event...', 'イベントを作成しました！': 'Event created!',
      'イベントの作成に失敗しました': 'Failed to create event',
      'イベントの削除に失敗しました': 'Failed to delete event',
      '参加状況の更新に失敗しました': 'Failed to update attendance',
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
      // Fase 3 — auth extras
      'パスワードの再設定': 'Reset your password', 'パスワードをお忘れですか': 'Forgot your password',
      '登録したメールアドレスを入力してください。再設定用のリンクをお送りします。': 'Enter your registered email and we’ll send you a reset link.',
      'リンクを送信': 'Send link', 'ログインに戻る': 'Back to login', 'ログインへ': 'To login',
      '送信に失敗しました': 'Failed to send', '送信中...': 'Sending...',
      'パスワードを再設定': 'Reset password', '新しいパスワード': 'New password',
      '新しいパスワードを設定': 'Set new password', '新しいパスワード（8文字以上）': 'New password (8+ characters)',
      '新しいパスワード（確認）': 'New password (confirm)',
      'トークンがありません。リンクをもう一度確認してください。': 'No token. Please check the link again.',
      'パスワードが一致しません。': 'Passwords do not match.',
      '再設定に失敗しました': 'Reset failed', '再設定中...': 'Resetting...',
      'メールを認証しています...': 'Verifying your email...', 'メール認証': 'Email verification',
      '認証に失敗しました': 'Verification failed', '認証トークンがありません。': 'No verification token.',
      // Fase 3 — ferramentas
      '画像フォーマットコンバーター': 'Image format converter',
      '画像をアップロードして PNG・JPEG・GIF 間で変換します。': 'Upload an image and convert between PNG, JPEG and GIF.',
      '変換': 'Convert', '変換先:': 'Convert to:',
      '音声フォーマットコンバーター': 'Audio format converter',
      '音声ファイルをアップロードして別のフォーマットに変換します。': 'Upload an audio file and convert it to another format.',
      'リンクを貼り付けて、動画（MP4）または音声（MP3）としてダウンロードします。': 'Paste a link to download it as video (MP4) or audio (MP3).',
      'ダウンロード': 'Download', 'ダウンロード形式:': 'Download as:', '動画 (MP4)': 'Video (MP4)', '音声 (MP3)': 'Audio (MP3)',
      '曲が選択されていません': 'No song selected', '曲を選んで再生しましょう。': 'Pick a song to play.',
      'リンク・テキスト': 'Link or text', 'リンクやテキストを貼り付けて QR コードを生成します。': 'Paste a link or text to generate a QR code.',
      '誤り訂正レベル:': 'Error correction level:', '低 (L)': 'Low (L)', '中 (M)': 'Medium (M)', 'やや高 (Q)': 'Quartile (Q)', '高 (H)': 'High (H)',
      '生成': 'Generate', '生成された QR コード': 'Generated QR code',
      '無料のパブリックドメイン書籍': 'Free public-domain books',
      '合法的に無料の書籍 — パブリックドメイン、または著者・出版社が公開ライセンスで提供しているものです。': 'Legally free books — public domain, or released by the authors/publishers under an open license.',
      'プロジェクト・グーテンベルク（ポルトガル語）': 'Project Gutenberg (Portuguese)',
      '— 70,000冊以上の無料パブリックドメイン電子書籍。': '— 70,000+ free public-domain e-books.',
      '— ポルトガル語のパブリックドメイン書籍。': '— Public-domain books in Portuguese.',
      '— 無料のデジタル貸出図書館。': '— A free digital lending library.',
      '— 無料の技術書・コンピュータサイエンス書籍。': '— Free tech and computer-science books.',
      '— 無料の査読付き大学教科書。': '— Free peer-reviewed college textbooks.',
      '— 美しく整形されたパブリックドメインの名作。': '— Beautifully formatted public-domain classics.',
      'Linuxディストリビューション': 'Linux distributions',
      '人気のある無料・オープンソースの Linux ディストロ公式ダウンロードリンク。': 'Official download links for popular free and open-source Linux distros.',
      '— 最も人気のあるデスクトップ／サーバー用ディストロ。': '— The most popular desktop/server distro.',
      '— 初心者に優しいデスクトップ体験。': '— A beginner-friendly desktop experience.',
      '— 安定志向でコミュニティ主導。': '— Stability-focused and community-driven.',
      '— 最先端、Red Hat がスポンサー。': '— Cutting-edge, sponsored by Red Hat.',
      '— エンタープライズ向け、RHEL互換。': '— Enterprise-grade, RHEL-compatible.',
      '— ミニマルで高いカスタマイズ性。': '— Minimal and highly customizable.',
      '— セキュリティとペネトレーションテスト向け。': '— For security and penetration testing.',
      '便利な自動化スクリプト': 'Handy automation scripts',
      'ターミナルにコピー＆ペーストして使ってください。実行する前に必ずスクリプトを読みましょう。': 'Copy and paste into your terminal. Always read a script before running it.',
      'コピー': 'Copy', 'システム更新（Rocky／RHEL系）': 'System update (Rocky / RHEL family)',
      '開いているポートを確認': 'Check open ports',
      '特定のポートを使うプロセスを見つけて終了': 'Find and kill the process using a specific port',
      'ディスク使用量の概要を確認': 'Check a disk-usage summary', 'ディスク上の大きなファイルを探す': 'Find large files on disk',
      'フォルダ内の30日より古いファイルを削除': 'Delete files older than 30 days in a folder',
      'タイムスタンプ付きでフォルダをバックアップ': 'Back up a folder with a timestamp',
      'システムリソースをリアルタイム監視': 'Monitor system resources in real time',
      '実行中のサービスを一覧表示': 'List running services',
      'SSL証明書の自動更新（Certbotのcron確認）': 'Auto-renew SSL certificates (check Certbot cron)',
      'スワップファイルを作成（低メモリのVMに便利）': 'Create a swap file (handy for low-memory VMs)',
      'ダウンロードフォルダをファイル種別で自動整理': 'Auto-organize the Downloads folder by file type',
      'フォルダ内の全画像を圧縮（ImageMagickが必要）': 'Compress all images in a folder (needs ImageMagick)',
      'フォルダを監視して新しいファイルを自動仕分け（リアルタイム）': 'Watch a folder and auto-sort new files (real time)',
      'ブラウザ上で動く使い捨ての Linux 環境です。コマンドを自由に試せます。ページを閉じるとすべて消えます。': 'A disposable Linux environment that runs in your browser. Try commands freely; everything is wiped when you close the page.',
      '⚠️ この環境はインターネットに接続されていません。': '⚠️ This environment is not connected to the internet.',
      'すべてあなたのブラウザ内だけで動くため、ネットワークを必要とするコマンドは動きません：': 'Everything runs entirely inside your browser, so commands that need the network won’t work:',
      'でのダウンロード、': ' downloads, ', 'パッケージのインストール（': 'package installs (',
      'など': 'etc.', 'など）': 'etc.)', 'ファイル操作（': 'file operations (',
      '）、テキスト処理（': '), text processing (', '）、権限（': '), permissions (',
      '）、シェルスクリプトなど、ローカルで完結するコマンドは自由に試せます。': '), shell scripts and other fully-local commands are free to try.',
      '試せること：': 'What you can try:', '再起動': 'Restart',
      'すべてブラウザ内で動くのでサーバーには何も残りません。ページを閉じる・': 'Everything runs in your browser, so nothing is left on the server. Closing the page or ',
      'するとすべてリセットされます。初回はイメージの読み込みに少し時間がかかります。画面をクリックしてから入力してください。': ' resets everything. The first image load takes a moment. Click the screen before typing.',
      // Fase 3 — status de conversores
      'まず音声ファイルを選択してください。': 'Please choose an audio file first.',
      'エラーが発生しました。もう一度お試しください。': 'An error occurred. Please try again.',
      '変換に失敗しました': 'Conversion failed', '変換中...': 'Converting...',
      '完了！ダウンロードが自動的に始まります。': 'Done! Your download will start automatically.',
      'ダウンロードに失敗しました': 'Download failed',
      'ダウンロード中... 少し時間がかかる場合があります。': 'Downloading... this may take a moment.',
      'まだ曲がありません。': 'No songs yet.', '曲を読み込めませんでした。': 'Couldn’t load songs.',
      'まずリンクかテキストを入力してください。': 'Please enter a link or text first.',
      'テキストが長すぎます。もっと短い内容でお試しください。': 'The text is too long. Please try something shorter.',
      '生成しました！': 'Generated!', 'コピーしました！': 'Copied!',
      // Fase 3 — notificações / busca (global)
      '通知': 'Notifications', 'すべて既読にする': 'Mark all as read', '通知はまだありません。': 'No notifications yet.',
      'たった今': 'just now', 'ユーザー': 'Users', '結果がありません': 'No results',
      // Fase 4a — campus
      'Enter を押してチャット…': 'Press Enter to chat…', 'クリックで全体マップ': 'Click for full map',
      'クリックで拡大': 'Click to zoom', '音楽': 'Music',
      '矢印キーまたは WASD で移動 · Enter でチャット': 'Move with arrow keys or WASD · Enter to chat',
      // Fase 4a — digitação
      'カテゴリ': 'Category', 'ここに入力…': 'Type here…', 'コマンドを解説 ▾': 'Explain command ▾',
      'デイリー': 'Daily', 'デイリーチャレンジ': 'Daily challenge', 'ミス': 'Misses', 'ランキング': 'Ranking',
      '実績': 'Achievements', '履歴': 'History', '新しい文': 'New sentence', '精度': 'Accuracy', '言語': 'Language',
      '「新しい文」を押して、下の入力欄にタイプしてください。': 'Press “New sentence” and type in the field below.',
      '本日のランキング': 'Today’s ranking', 'まだ履歴がありません。': 'No history yet.', 'まだ記録がありません。': 'No records yet.',
      'WPM · 精度': 'WPM · Accuracy', '— 実績解除:': '— Achievement unlocked:', 'すべて': 'All',
      'コマンドの解説を隠す ▴': 'Hide command explanation ▴', '完了！': 'Done!', '本日の課題:': 'Today’s challenge:',
      '読み込みに失敗しました': 'Failed to load', '例': 'Example', '概要': 'Overview', '用途': 'Usage',
      // Fase 4a — admin
      'ステータス — サーバー監視': 'Status — server monitoring', '更新': 'Refresh',
      '管理パネル — アカウント': 'Admin panel — accounts', '通報 — モデレーション': 'Reports — moderation',
      '停止': 'Ban', '却下': 'Dismiss', '対応済みにする': 'Mark resolved', '停止解除': 'Unban',
      '理由:': 'Reason:', '投稿者:': 'Posted by:', '通報者:': 'Reported by:', '接続数:': 'Connections:',
      'オンラインのユーザー': 'Online users', '（削除済み）': '(deleted)', '通報はありません。': 'No reports.',
      '有効': 'Active', '管理者': 'Admin', '停止中': 'Banned', '登録:': 'Registered:', 'オフライン': 'Offline', 'オンライン': 'Online',
      'コア · 負荷:': 'Cores · load:', 'サーバー': 'Server', 'スパム': 'Spam', 'ディスク': 'Disk', 'データベース': 'Database',
      '不明': 'Unknown', '不適切なコンテンツ': 'Inappropriate content', '停止の理由（任意）:': 'Ban reason (optional):',
      '匿名の海賊': 'Anonymous pirate', '取得できません': 'Unavailable', '対応済み': 'Resolved', '操作に失敗しました': 'Action failed',
      '攻撃的な内容': 'Offensive content', '最終更新:': 'Last updated:', '未対応': 'Pending', '稼働時間:': 'Uptime:', '応答:': 'Response:',
      // Fase 4a — intro
      'Blackbeard Tavern とは？': 'What is Blackbeard Tavern?',
      'HTML・CSS・JavaScript（Vanilla）／ Phaser': 'HTML/CSS/JavaScript (Vanilla) / Phaser',
      'Node.js・Express ／ Socket.io ／ PM2': 'Node.js, Express / Socket.io / PM2',
      '⚙️ 使用技術': '⚙️ Tech stack', 'ようこそ': 'Welcome', 'インフラ': 'Infrastructure',
      'キャラクターで歩き回り、他のユーザーと出会えます。': 'Walk around as a character and meet other users.',
      'サイトに入る': 'Enter the site', 'スクロールして見る ↓': 'Scroll to explore ↓',
      'タイピングゲーム（EN/JA・ランキング・実績）': 'Typing game (EN/JA · ranking · achievements)',
      'バックエンド': 'Backend', 'フィード（投稿・いいね・コメント）': 'Feed (posts · likes · comments)',
      'フレンド・チャット（リアルタイム）': 'Friends & chat (real time)', 'フロントエンド': 'Frontend',
      'メディア処理': 'Media processing', 'メール': 'Email', 'リアルタイムのマルチプレイヤー空間。': 'A real-time multiplayer space.',
      '便利なツール、SNS、バーチャルキャンパスが一つになった、': 'Handy tools, a social network and a virtual campus, all in one —',
      '学生のためのオールインワン・プラットフォーム': 'an all-in-one platform for students',
      '学生のためのサイトです。': 'A site for students.', '準備はいい？': 'Ready?', '認証': 'Authentication',
      '💬 ソーシャル（SNS）': '💬 Social (SNS)', '🗺 バーチャルキャンパス': '🗺 Virtual campus', '🛠 ツール': '🛠 Tools',
      // Fase 4b — calculadora de subnet
      'CIDR・VLSM・ネットワーク／ブロードキャスト・ホスト数・サブネット自動生成に対応。すべてブラウザ内で計算します。': 'Supports CIDR, VLSM, network/broadcast, host counts and automatic subnet generation. Everything is computed in your browser.',
      'IP アドレス（IPv4 / IPv6、CIDR 付きも可）': 'IP address (IPv4 / IPv6, CIDR allowed)',
      'VLSM を計算': 'Calculate VLSM', 'サブネットを生成': 'Generate subnets', 'サブネット分割': 'Subnet splitting',
      'サブネット計算機（IPv4 / IPv6）': 'Subnet calculator (IPv4 / IPv6)',
      'プレフィックス（CIDR）— IP に /xx が無い場合に使用': 'Prefix (CIDR) — used when the IP has no /xx',
      'ベースネットワーク': 'Base network', 'ベースプレフィックス（IP に /xx が無い場合）': 'Base prefix (when the IP has no /xx)',
      'ホスト要件（大きい順に自動で割り当てます）': 'Host requirements (assigned largest-first automatically)',
      '例: 192.168.0.0/24': 'e.g. 192.168.0.0/24', '例: 192.168.0.0/24 または 2001:db8::/48': 'e.g. 192.168.0.0/24 or 2001:db8::/48',
      '例: 192.168.1.10/24 または 2001:db8::1': 'e.g. 192.168.1.10/24 or 2001:db8::1',
      '分割方法': 'Split method', '履歴を消去': 'Clear history', '必要なサブネット数': 'Required number of subnets',
      '必要なサブネット数を指定': 'Specify required number of subnets', '新しいプレフィックス': 'New prefix',
      '新しいプレフィックスを指定': 'Specify new prefix', '計算する': 'Calculate', '計算履歴': 'Calculation history',
      '計算機': 'Calculator', '＋ 要件を追加': '＋ Add requirement',
      'CIDR 表記': 'CIDR notation', 'D (マルチキャスト)': 'D (multicast)', 'E (実験用)': 'E (experimental)', 'IP クラス': 'IP class',
      'IPv4 のプレフィックスは 0〜32 です。': 'IPv4 prefix must be 0–32.', 'IPv4 の値が不正です。': 'Invalid IPv4 value.',
      'IPv4 は 4 つのオクテットが必要です。': 'IPv4 needs 4 octets.', 'IPv6 が空です。': 'IPv6 is empty.',
      'IPv6 のグループが多すぎます。': 'Too many IPv6 groups.', 'IPv6 のグループ数が不正です。': 'Invalid number of IPv6 groups.',
      'IPv6 のプレフィックスは 0〜128 です。': 'IPv6 prefix must be 0–128.',
      'アドレス数': 'Address count', 'グローバルユニキャスト': 'Global unicast', 'サブネット': 'Subnet',
      'サブネットマスク': 'Subnet mask', 'サブネット割り当て': 'Subnet allocation', 'サブネット数を入力してください。': 'Please enter the number of subnets.',
      'ドキュメント用 (2001:db8::/32)': 'Documentation (2001:db8::/32)', 'ネットワーク (2進)': 'Network (binary)', 'ネットワーク (Prefix)': 'Network (prefix)',
      'ネットワークアドレス': 'Network address', 'パブリック': 'Public', 'ブロードキャストアドレス': 'Broadcast address', 'プライベート': 'Private',
      'プレフィックス（CIDR）を指定してください。': 'Please specify a prefix (CIDR).', 'マスク (2進)': 'Mask (binary)', 'マルチキャスト': 'Multicast',
      'ユニークローカル (ULA)': 'Unique local (ULA)', 'リンクローカル': 'Link-local', 'リンクローカル (APIPA)': 'Link-local (APIPA)',
      'ループバック': 'Loopback', 'ループバック (::1)': 'Loopback (::1)', 'ワイルドカードマスク': 'Wildcard mask', '予約済み': 'Reserved',
      '使用可能ホスト数': 'Usable host count', '分割': 'Split', '各オクテットは 0〜255 の範囲です。': 'Each octet must be 0–255.',
      '圧縮なしの IPv6 は 8 グループ必要です。': 'Uncompressed IPv6 needs 8 groups.', '完全表記': 'Full notation',
      '少なくとも 1 つのホスト要件を入力してください。': 'Enter at least one host requirement.',
      '新しいプレフィックスはベースより大きくしてください。': 'The new prefix must be larger than the base.',
      '最初のアドレス': 'First address', '最初のホスト': 'First host', '最後のアドレス': 'Last address', '最後のホスト': 'Last host',
      '有効な IPv4 または IPv6 アドレスを入力してください。': 'Enter a valid IPv4 or IPv6 address.', '未指定 (::)': 'Unspecified (::)',
      '種別': 'Type', '総アドレス数': 'Total addresses', '計算': 'Calculate',
      'ネットワーク': 'Network', 'アドレス範囲': 'Address range', 'ホスト範囲': 'Host range', 'ブロードキャスト': 'Broadcast', 'ホスト数': 'Host count',
      '名前': 'Name', '要求': 'Required', 'マスク': 'Mask', '範囲': 'Range', '使用可能': 'Usable', '再利用': 'Reuse',
      '必要ホスト数': 'Required hosts', '部署名（例: 営業部）': 'Department name (e.g. Sales)', 'まだ計算履歴がありません。': 'No calculation history yet.', '合計': 'Total',
      // Fase 4b — Cisco lab (UI; a saída do terminal fica como está)
      'Cisco IOS のコマンドを練習できるシミュレーターです。ルーター／スイッチ／L3スイッチのコマンドを試せます。': 'A simulator to practice Cisco IOS commands. Try router / switch / L3-switch commands.',
      'L3スイッチ': 'L3 switch', 'スイッチ (L2)': 'Switch (L2)', 'ルーター': 'Router',
      'これは IOS のシミュレーターです（本物の IOS ではありません）。': 'This is an IOS simulator (not real IOS).',
      'デバイス:': 'Device:', 'ヒント：': 'Hint:', 'リセット': 'Reset', 'など。': 'etc.',
      '「enable」で特権モード、「configure terminal」で設定モード。「?」でヘルプ。': 'Use “enable” for privileged mode, “configure terminal” for config mode, “?” for help.',
      // Diálogos confirm() (os interpolados são tratados por PATTERNS)
      'このイベントを削除しますか？元に戻せません。': 'Delete this event? This cannot be undone.',
      'この投稿を削除しますか？元に戻せません。': 'Delete this post? This cannot be undone.',
      'このコメントを削除しますか？': 'Delete this comment?',
      'このフレンドを削除しますか？': 'Remove this friend?',
      'このグループを退出しますか？再度参加するには招待が必要です。': 'Leave this group? You will need an invite to rejoin.',
      'このグループを全員のために削除しますか？すべてのメッセージが失われ、元に戻せません。': 'Delete this group for everyone? All messages will be lost and this cannot be undone.',
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
      // Fase 2 — amigos / chat
      'フレンド': 'Amigos', '学校のメールでフレンド追加': 'Adicionar amigo pelo e-mail da escola',
      'リクエストを送る': 'Enviar pedido', '保留中のリクエスト': 'Pedidos pendentes',
      'マイフレンド': 'Meus amigos', 'グループ': 'Grupos', '会話': 'Conversas',
      '読み込み中...': 'Carregando...', '招待して会話する': 'Convidar para conversar', '招待': 'Convidar',
      'メンバーを見る': 'Ver membros', 'メンバー': 'Membros', '閉じる': 'Fechar',
      'メディアを追加': 'Adicionar mídia', 'メッセージを入力...': 'Digite uma mensagem...',
      'グループ名': 'Nome do grupo', 'グループメンバー': 'Membros do grupo',
      '承認': 'Aceitar', '拒否': 'Recusar', 'チャット': 'Chat', '会話を削除': 'Excluir conversa',
      'グループを退出': 'Sair do grupo', 'あいさつしよう！👋': 'Diga oi! 👋',
      'まだメッセージがありません。あいさつしよう！👋': 'Ainda não há mensagens. Diga oi! 👋',
      'まだどのグループにも参加していません。フレンドとのチャットから「＋」で作れます。': 'Você ainda não está em nenhum grupo. Crie um a partir de um chat com um amigo usando o “+”.',
      'まだフレンドがいません。上から追加しましょう！': 'Você ainda não tem amigos. Adicione acima!',
      'グループの読み込みに失敗しました。': 'Falha ao carregar os grupos.',
      'フレンドの読み込みに失敗しました。': 'Falha ao carregar os amigos.',
      'メッセージの読み込みに失敗しました。': 'Falha ao carregar as mensagens.',
      'メンバーの読み込みに失敗しました。': 'Falha ao carregar os membros.',
      'リクエストの読み込みに失敗しました。': 'Falha ao carregar os pedidos.',
      '会話がまだありません。左のフレンドから「チャット」を押しましょう！': 'Ainda não há conversas. Toque em “Chat” em um amigo à esquerda!',
      '会話の読み込みに失敗しました。': 'Falha ao carregar as conversas.',
      '保留中のリクエストはありません。': 'Nenhum pedido pendente.',
      '招待できるフレンドがいません。': 'Nenhum amigo para convidar.',
      'アップロードに失敗しました': 'Falha no envio', 'グループの作成に失敗しました': 'Falha ao criar o grupo',
      'グループの削除に失敗しました': 'Falha ao excluir o grupo', 'グループの退出に失敗しました': 'Falha ao sair do grupo',
      'グループを作成': 'Criar grupo', 'グループを作成中...': 'Criando grupo...',
      'グループ名を入力してください。': 'Digite um nome de grupo.',
      'フレンドリクエストを送信しました！': 'Pedido de amizade enviado!',
      'リクエストの送信に失敗しました': 'Falha ao enviar o pedido', 'リクエストを送信中...': 'Enviando pedido...',
      '会話の削除に失敗しました': 'Falha ao excluir a conversa',
      '少なくとも1人選んでください。': 'Selecione ao menos uma pessoa.',
      '招待しました！': 'Convite enviado!', '招待に失敗しました': 'Falha ao convidar', '招待中...': 'Convidando...',
      // Fase 2 — eventos
      'イベントを作成': 'Criar evento', 'イベント名': 'Nome do evento', '時間': 'Horário',
      '場所': 'Local', '説明': 'Descrição', '📷 写真を追加': '📷 Adicionar foto',
      'イベントを読み込み中...': 'Carregando eventos...',
      '今後のイベントはありません。最初のイベントを作成しましょう！': 'Nenhum evento futuro. Crie o primeiro!',
      'イベントの読み込みに失敗しました。': 'Falha ao carregar os eventos.',
      '✓ 参加中（取消）': '✓ Participando (cancelar)', '参加する': 'Participar', 'イベントを削除': 'Excluir evento',
      'イベント名を入力してください。': 'Digite o nome do evento.',
      '日付を入力してください。': 'Digite a data.',
      '日付は YYYY/MM/DD の形式で入力してください。': 'Digite a data no formato YYYY/MM/DD.',
      'イベントを作成中...': 'Criando evento...', 'イベントを作成しました！': 'Evento criado!',
      'イベントの作成に失敗しました': 'Falha ao criar o evento',
      'イベントの削除に失敗しました': 'Falha ao excluir o evento',
      '参加状況の更新に失敗しました': 'Falha ao atualizar a participação',
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
      // Fase 3 — auth extras
      'パスワードの再設定': 'Redefinir sua senha', 'パスワードをお忘れですか': 'Esqueceu sua senha',
      '登録したメールアドレスを入力してください。再設定用のリンクをお送りします。': 'Digite o e-mail cadastrado e enviaremos um link de redefinição.',
      'リンクを送信': 'Enviar link', 'ログインに戻る': 'Voltar ao login', 'ログインへ': 'Ir para o login',
      '送信に失敗しました': 'Falha ao enviar', '送信中...': 'Enviando...',
      'パスワードを再設定': 'Redefinir senha', '新しいパスワード': 'Nova senha',
      '新しいパスワードを設定': 'Definir nova senha', '新しいパスワード（8文字以上）': 'Nova senha (8+ caracteres)',
      '新しいパスワード（確認）': 'Nova senha (confirmação)',
      'トークンがありません。リンクをもう一度確認してください。': 'Sem token. Verifique o link novamente.',
      'パスワードが一致しません。': 'As senhas não coincidem.',
      '再設定に失敗しました': 'Falha ao redefinir', '再設定中...': 'Redefinindo...',
      'メールを認証しています...': 'Verificando seu e-mail...', 'メール認証': 'Verificação de e-mail',
      '認証に失敗しました': 'Falha na verificação', '認証トークンがありません。': 'Sem token de verificação.',
      // Fase 3 — ferramentas
      '画像フォーマットコンバーター': 'Conversor de formato de imagem',
      '画像をアップロードして PNG・JPEG・GIF 間で変換します。': 'Envie uma imagem e converta entre PNG, JPEG e GIF.',
      '変換': 'Converter', '変換先:': 'Converter para:',
      '音声フォーマットコンバーター': 'Conversor de formato de áudio',
      '音声ファイルをアップロードして別のフォーマットに変換します。': 'Envie um arquivo de áudio e converta para outro formato.',
      'リンクを貼り付けて、動画（MP4）または音声（MP3）としてダウンロードします。': 'Cole um link para baixar como vídeo (MP4) ou áudio (MP3).',
      'ダウンロード': 'Baixar', 'ダウンロード形式:': 'Baixar como:', '動画 (MP4)': 'Vídeo (MP4)', '音声 (MP3)': 'Áudio (MP3)',
      '曲が選択されていません': 'Nenhuma música selecionada', '曲を選んで再生しましょう。': 'Escolha uma música para tocar.',
      'リンク・テキスト': 'Link ou texto', 'リンクやテキストを貼り付けて QR コードを生成します。': 'Cole um link ou texto para gerar um QR code.',
      '誤り訂正レベル:': 'Nível de correção de erros:', '低 (L)': 'Baixo (L)', '中 (M)': 'Médio (M)', 'やや高 (Q)': 'Quartil (Q)', '高 (H)': 'Alto (H)',
      '生成': 'Gerar', '生成された QR コード': 'QR code gerado',
      '無料のパブリックドメイン書籍': 'Livros de domínio público grátis',
      '合法的に無料の書籍 — パブリックドメイン、または著者・出版社が公開ライセンスで提供しているものです。': 'Livros legalmente gratuitos — de domínio público ou liberados pelos autores/editoras sob licença aberta.',
      'プロジェクト・グーテンベルク（ポルトガル語）': 'Projeto Gutenberg (Português)',
      '— 70,000冊以上の無料パブリックドメイン電子書籍。': '— Mais de 70.000 e-books gratuitos de domínio público.',
      '— ポルトガル語のパブリックドメイン書籍。': '— Livros de domínio público em português.',
      '— 無料のデジタル貸出図書館。': '— Uma biblioteca digital de empréstimo gratuita.',
      '— 無料の技術書・コンピュータサイエンス書籍。': '— Livros gratuitos de tecnologia e ciência da computação.',
      '— 無料の査読付き大学教科書。': '— Livros didáticos universitários revisados por pares, grátis.',
      '— 美しく整形されたパブリックドメインの名作。': '— Clássicos de domínio público lindamente formatados.',
      'Linuxディストリビューション': 'Distribuições Linux',
      '人気のある無料・オープンソースの Linux ディストロ公式ダウンロードリンク。': 'Links oficiais de download das distros Linux livres e open-source mais populares.',
      '— 最も人気のあるデスクトップ／サーバー用ディストロ。': '— A distro de desktop/servidor mais popular.',
      '— 初心者に優しいデスクトップ体験。': '— Uma experiência de desktop amigável para iniciantes.',
      '— 安定志向でコミュニティ主導。': '— Focada em estabilidade e conduzida pela comunidade.',
      '— 最先端、Red Hat がスポンサー。': '— De ponta, patrocinada pela Red Hat.',
      '— エンタープライズ向け、RHEL互換。': '— Nível empresarial, compatível com RHEL.',
      '— ミニマルで高いカスタマイズ性。': '— Minimalista e altamente personalizável.',
      '— セキュリティとペネトレーションテスト向け。': '— Para segurança e testes de penetração.',
      '便利な自動化スクリプト': 'Scripts úteis de automação',
      'ターミナルにコピー＆ペーストして使ってください。実行する前に必ずスクリプトを読みましょう。': 'Copie e cole no seu terminal. Sempre leia um script antes de executá-lo.',
      'コピー': 'Copiar', 'システム更新（Rocky／RHEL系）': 'Atualização do sistema (família Rocky / RHEL)',
      '開いているポートを確認': 'Verificar portas abertas',
      '特定のポートを使うプロセスを見つけて終了': 'Encontrar e encerrar o processo que usa uma porta específica',
      'ディスク使用量の概要を確認': 'Ver um resumo do uso de disco', 'ディスク上の大きなファイルを探す': 'Encontrar arquivos grandes no disco',
      'フォルダ内の30日より古いファイルを削除': 'Excluir arquivos com mais de 30 dias em uma pasta',
      'タイムスタンプ付きでフォルダをバックアップ': 'Fazer backup de uma pasta com data/hora',
      'システムリソースをリアルタイム監視': 'Monitorar recursos do sistema em tempo real',
      '実行中のサービスを一覧表示': 'Listar serviços em execução',
      'SSL証明書の自動更新（Certbotのcron確認）': 'Renovar certificados SSL automaticamente (verificar cron do Certbot)',
      'スワップファイルを作成（低メモリのVMに便利）': 'Criar um arquivo de swap (útil em VMs com pouca memória)',
      'ダウンロードフォルダをファイル種別で自動整理': 'Organizar a pasta Downloads por tipo de arquivo',
      'フォルダ内の全画像を圧縮（ImageMagickが必要）': 'Comprimir todas as imagens de uma pasta (precisa do ImageMagick)',
      'フォルダを監視して新しいファイルを自動仕分け（リアルタイム）': 'Monitorar uma pasta e organizar novos arquivos automaticamente (tempo real)',
      'ブラウザ上で動く使い捨ての Linux 環境です。コマンドを自由に試せます。ページを閉じるとすべて消えます。': 'Um ambiente Linux descartável que roda no navegador. Teste comandos à vontade; tudo é apagado ao fechar a página.',
      '⚠️ この環境はインターネットに接続されていません。': '⚠️ Este ambiente não está conectado à internet.',
      'すべてあなたのブラウザ内だけで動くため、ネットワークを必要とするコマンドは動きません：': 'Tudo roda apenas dentro do seu navegador, então comandos que precisam de rede não funcionam:',
      'でのダウンロード、': ' downloads, ', 'パッケージのインストール（': 'instalação de pacotes (',
      'など': 'etc.', 'など）': 'etc.)', 'ファイル操作（': 'operações de arquivo (',
      '）、テキスト処理（': '), processamento de texto (', '）、権限（': '), permissões (',
      '）、シェルスクリプトなど、ローカルで完結するコマンドは自由に試せます。': '), shell scripts e outros comandos totalmente locais podem ser testados à vontade.',
      '試せること：': 'O que você pode testar:', '再起動': 'Reiniciar',
      'すべてブラウザ内で動くのでサーバーには何も残りません。ページを閉じる・': 'Tudo roda no navegador, então nada fica no servidor. Fechar a página ou ',
      'するとすべてリセットされます。初回はイメージの読み込みに少し時間がかかります。画面をクリックしてから入力してください。': ' reinicia tudo. O primeiro carregamento da imagem demora um pouco. Clique na tela antes de digitar.',
      // Fase 3 — status de conversores
      'まず音声ファイルを選択してください。': 'Escolha um arquivo de áudio primeiro.',
      'エラーが発生しました。もう一度お試しください。': 'Ocorreu um erro. Tente novamente.',
      '変換に失敗しました': 'Falha na conversão', '変換中...': 'Convertendo...',
      '完了！ダウンロードが自動的に始まります。': 'Pronto! O download começará automaticamente.',
      'ダウンロードに失敗しました': 'Falha no download',
      'ダウンロード中... 少し時間がかかる場合があります。': 'Baixando... isso pode levar um tempo.',
      'まだ曲がありません。': 'Ainda não há músicas.', '曲を読み込めませんでした。': 'Não foi possível carregar as músicas.',
      'まずリンクかテキストを入力してください。': 'Digite um link ou texto primeiro.',
      'テキストが長すぎます。もっと短い内容でお試しください。': 'O texto é muito longo. Tente algo mais curto.',
      '生成しました！': 'Gerado!', 'コピーしました！': 'Copiado!',
      // Fase 3 — notificações / busca (global)
      '通知': 'Notificações', 'すべて既読にする': 'Marcar tudo como lido', '通知はまだありません。': 'Ainda não há notificações.',
      'たった今': 'agora mesmo', 'ユーザー': 'Usuários', '結果がありません': 'Sem resultados',
      // Fase 4a — campus
      'Enter を押してチャット…': 'Pressione Enter para conversar…', 'クリックで全体マップ': 'Clique para o mapa completo',
      'クリックで拡大': 'Clique para ampliar', '音楽': 'Música',
      '矢印キーまたは WASD で移動 · Enter でチャット': 'Mova com as setas ou WASD · Enter para conversar',
      // Fase 4a — digitação
      'カテゴリ': 'Categoria', 'ここに入力…': 'Digite aqui…', 'コマンドを解説 ▾': 'Explicar comando ▾',
      'デイリー': 'Diário', 'デイリーチャレンジ': 'Desafio diário', 'ミス': 'Erros', 'ランキング': 'Ranking',
      '実績': 'Conquistas', '履歴': 'Histórico', '新しい文': 'Nova frase', '精度': 'Precisão', '言語': 'Idioma',
      '「新しい文」を押して、下の入力欄にタイプしてください。': 'Pressione "Nova frase" e digite no campo abaixo.',
      '本日のランキング': 'Ranking de hoje', 'まだ履歴がありません。': 'Ainda não há histórico.', 'まだ記録がありません。': 'Ainda não há registros.',
      'WPM · 精度': 'WPM · Precisão', '— 実績解除:': '— Conquista desbloqueada:', 'すべて': 'Todos',
      'コマンドの解説を隠す ▴': 'Ocultar explicação ▴', '完了！': 'Concluído!', '本日の課題:': 'Desafio de hoje:',
      '読み込みに失敗しました': 'Falha ao carregar', '例': 'Exemplo', '概要': 'Visão geral', '用途': 'Uso',
      // Fase 4a — admin
      'ステータス — サーバー監視': 'Status — monitoramento do servidor', '更新': 'Atualizar',
      '管理パネル — アカウント': 'Painel admin — contas', '通報 — モデレーション': 'Denúncias — moderação',
      '停止': 'Banir', '却下': 'Rejeitar', '対応済みにする': 'Marcar como resolvido', '停止解除': 'Desbanir',
      '理由:': 'Motivo:', '投稿者:': 'Autor:', '通報者:': 'Denunciado por:', '接続数:': 'Conexões:',
      'オンラインのユーザー': 'Usuários online', '（削除済み）': '(excluído)', '通報はありません。': 'Nenhuma denúncia.',
      '有効': 'Ativo', '管理者': 'Admin', '停止中': 'Banido', '登録:': 'Cadastrado:', 'オフライン': 'Offline', 'オンライン': 'Online',
      'コア · 負荷:': 'Núcleos · carga:', 'サーバー': 'Servidor', 'スパム': 'Spam', 'ディスク': 'Disco', 'データベース': 'Banco de dados',
      '不明': 'Desconhecido', '不適切なコンテンツ': 'Conteúdo impróprio', '停止の理由（任意）:': 'Motivo do banimento (opcional):',
      '匿名の海賊': 'Pirata anônimo', '取得できません': 'Indisponível', '対応済み': 'Resolvido', '操作に失敗しました': 'Falha na operação',
      '攻撃的な内容': 'Conteúdo ofensivo', '最終更新:': 'Última atualização:', '未対応': 'Pendente', '稼働時間:': 'Tempo ativo:', '応答:': 'Resposta:',
      // Fase 4a — intro
      'Blackbeard Tavern とは？': 'O que é a Blackbeard Tavern?',
      'HTML・CSS・JavaScript（Vanilla）／ Phaser': 'HTML/CSS/JavaScript (Vanilla) / Phaser',
      'Node.js・Express ／ Socket.io ／ PM2': 'Node.js, Express / Socket.io / PM2',
      '⚙️ 使用技術': '⚙️ Tecnologias', 'ようこそ': 'Bem-vindo', 'インフラ': 'Infraestrutura',
      'キャラクターで歩き回り、他のユーザーと出会えます。': 'Ande como um personagem e encontre outros usuários.',
      'サイトに入る': 'Entrar no site', 'スクロールして見る ↓': 'Role para ver ↓',
      'タイピングゲーム（EN/JA・ランキング・実績）': 'Jogo de digitação (EN/JA · ranking · conquistas)',
      'バックエンド': 'Backend', 'フィード（投稿・いいね・コメント）': 'Feed (posts · curtidas · comentários)',
      'フレンド・チャット（リアルタイム）': 'Amigos e chat (tempo real)', 'フロントエンド': 'Frontend',
      'メディア処理': 'Processamento de mídia', 'メール': 'E-mail', 'リアルタイムのマルチプレイヤー空間。': 'Um espaço multiplayer em tempo real.',
      '便利なツール、SNS、バーチャルキャンパスが一つになった、': 'Ferramentas úteis, rede social e campus virtual, tudo em um —',
      '学生のためのオールインワン・プラットフォーム': 'uma plataforma tudo-em-um para estudantes',
      '学生のためのサイトです。': 'Um site para estudantes.', '準備はいい？': 'Pronto?', '認証': 'Autenticação',
      '💬 ソーシャル（SNS）': '💬 Social (SNS)', '🗺 バーチャルキャンパス': '🗺 Campus virtual', '🛠 ツール': '🛠 Ferramentas',
      // Fase 4b — calculadora de subnet
      'CIDR・VLSM・ネットワーク／ブロードキャスト・ホスト数・サブネット自動生成に対応。すべてブラウザ内で計算します。': 'Suporta CIDR, VLSM, rede/broadcast, contagem de hosts e geração automática de sub-redes. Tudo é calculado no navegador.',
      'IP アドレス（IPv4 / IPv6、CIDR 付きも可）': 'Endereço IP (IPv4 / IPv6, com CIDR também)',
      'VLSM を計算': 'Calcular VLSM', 'サブネットを生成': 'Gerar sub-redes', 'サブネット分割': 'Divisão de sub-redes',
      'サブネット計算機（IPv4 / IPv6）': 'Calculadora de sub-rede (IPv4 / IPv6)',
      'プレフィックス（CIDR）— IP に /xx が無い場合に使用': 'Prefixo (CIDR) — usado quando o IP não tem /xx',
      'ベースネットワーク': 'Rede base', 'ベースプレフィックス（IP に /xx が無い場合）': 'Prefixo base (quando o IP não tem /xx)',
      'ホスト要件（大きい順に自動で割り当てます）': 'Requisitos de host (atribuídos do maior para o menor automaticamente)',
      '例: 192.168.0.0/24': 'ex.: 192.168.0.0/24', '例: 192.168.0.0/24 または 2001:db8::/48': 'ex.: 192.168.0.0/24 ou 2001:db8::/48',
      '例: 192.168.1.10/24 または 2001:db8::1': 'ex.: 192.168.1.10/24 ou 2001:db8::1',
      '分割方法': 'Método de divisão', '履歴を消去': 'Limpar histórico', '必要なサブネット数': 'Número de sub-redes necessárias',
      '必要なサブネット数を指定': 'Especificar número de sub-redes', '新しいプレフィックス': 'Novo prefixo',
      '新しいプレフィックスを指定': 'Especificar novo prefixo', '計算する': 'Calcular', '計算履歴': 'Histórico de cálculos',
      '計算機': 'Calculadora', '＋ 要件を追加': '＋ Adicionar requisito',
      'CIDR 表記': 'Notação CIDR', 'D (マルチキャスト)': 'D (multicast)', 'E (実験用)': 'E (experimental)', 'IP クラス': 'Classe de IP',
      'IPv4 のプレフィックスは 0〜32 です。': 'O prefixo IPv4 deve ser 0–32.', 'IPv4 の値が不正です。': 'Valor IPv4 inválido.',
      'IPv4 は 4 つのオクテットが必要です。': 'IPv4 precisa de 4 octetos.', 'IPv6 が空です。': 'IPv6 está vazio.',
      'IPv6 のグループが多すぎます。': 'Grupos IPv6 em excesso.', 'IPv6 のグループ数が不正です。': 'Número de grupos IPv6 inválido.',
      'IPv6 のプレフィックスは 0〜128 です。': 'O prefixo IPv6 deve ser 0–128.',
      'アドレス数': 'Nº de endereços', 'グローバルユニキャスト': 'Unicast global', 'サブネット': 'Sub-rede',
      'サブネットマスク': 'Máscara de sub-rede', 'サブネット割り当て': 'Alocação de sub-redes', 'サブネット数を入力してください。': 'Digite o número de sub-redes.',
      'ドキュメント用 (2001:db8::/32)': 'Documentação (2001:db8::/32)', 'ネットワーク (2進)': 'Rede (binário)', 'ネットワーク (Prefix)': 'Rede (prefixo)',
      'ネットワークアドレス': 'Endereço de rede', 'パブリック': 'Público', 'ブロードキャストアドレス': 'Endereço de broadcast', 'プライベート': 'Privado',
      'プレフィックス（CIDR）を指定してください。': 'Especifique um prefixo (CIDR).', 'マスク (2進)': 'Máscara (binário)', 'マルチキャスト': 'Multicast',
      'ユニークローカル (ULA)': 'Local único (ULA)', 'リンクローカル': 'Link-local', 'リンクローカル (APIPA)': 'Link-local (APIPA)',
      'ループバック': 'Loopback', 'ループバック (::1)': 'Loopback (::1)', 'ワイルドカードマスク': 'Máscara curinga', '予約済み': 'Reservado',
      '使用可能ホスト数': 'Nº de hosts utilizáveis', '分割': 'Dividir', '各オクテットは 0〜255 の範囲です。': 'Cada octeto deve estar entre 0–255.',
      '圧縮なしの IPv6 は 8 グループ必要です。': 'IPv6 sem compressão precisa de 8 grupos.', '完全表記': 'Notação completa',
      '少なくとも 1 つのホスト要件を入力してください。': 'Digite ao menos um requisito de host.',
      '新しいプレフィックスはベースより大きくしてください。': 'O novo prefixo deve ser maior que o base.',
      '最初のアドレス': 'Primeiro endereço', '最初のホスト': 'Primeiro host', '最後のアドレス': 'Último endereço', '最後のホスト': 'Último host',
      '有効な IPv4 または IPv6 アドレスを入力してください。': 'Digite um endereço IPv4 ou IPv6 válido.', '未指定 (::)': 'Não especificado (::)',
      '種別': 'Tipo', '総アドレス数': 'Total de endereços', '計算': 'Calcular',
      'ネットワーク': 'Rede', 'アドレス範囲': 'Faixa de endereços', 'ホスト範囲': 'Faixa de hosts', 'ブロードキャスト': 'Broadcast', 'ホスト数': 'Nº de hosts',
      '名前': 'Nome', '要求': 'Requerido', 'マスク': 'Máscara', '範囲': 'Faixa', '使用可能': 'Utilizável', '再利用': 'Reutilizar',
      '必要ホスト数': 'Hosts necessários', '部署名（例: 営業部）': 'Nome do setor (ex.: Vendas)', 'まだ計算履歴がありません。': 'Ainda não há histórico de cálculos.', '合計': 'Total',
      // Fase 4b — Cisco lab (UI; a saída do terminal fica como está)
      'Cisco IOS のコマンドを練習できるシミュレーターです。ルーター／スイッチ／L3スイッチのコマンドを試せます。': 'Um simulador para praticar comandos do Cisco IOS. Teste comandos de roteador / switch / switch L3.',
      'L3スイッチ': 'Switch L3', 'スイッチ (L2)': 'Switch (L2)', 'ルーター': 'Roteador',
      'これは IOS のシミュレーターです（本物の IOS ではありません）。': 'Este é um simulador de IOS (não é o IOS real).',
      'デバイス:': 'Dispositivo:', 'ヒント：': 'Dica:', 'リセット': 'Redefinir', 'など。': 'etc.',
      '「enable」で特権モード、「configure terminal」で設定モード。「?」でヘルプ。': 'Use “enable” para o modo privilegiado, “configure terminal” para o modo de configuração e “?” para ajuda.',
      // Diálogos confirm() (os interpolados são tratados por PATTERNS)
      'このイベントを削除しますか？元に戻せません。': 'Excluir este evento? Esta ação não pode ser desfeita.',
      'この投稿を削除しますか？元に戻せません。': 'Excluir este post? Esta ação não pode ser desfeita.',
      'このコメントを削除しますか？': 'Excluir este comentário?',
      'このフレンドを削除しますか？': 'Remover este amigo?',
      'このグループを退出しますか？再度参加するには招待が必要です。': 'Sair deste grupo? Você precisará de um convite para voltar.',
      'このグループを全員のために削除しますか？すべてのメッセージが失われ、元に戻せません。': 'Excluir este grupo para todos? Todas as mensagens serão perdidas e não pode ser desfeito.',
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
      // Fase 2 — amigos / chat
      'フレンド': 'Amigos', '学校のメールでフレンド追加': 'Agregar amigo por correo escolar',
      'リクエストを送る': 'Enviar solicitud', '保留中のリクエスト': 'Solicitudes pendientes',
      'マイフレンド': 'Mis amigos', 'グループ': 'Grupos', '会話': 'Conversaciones',
      '読み込み中...': 'Cargando...', '招待して会話する': 'Invitar a conversar', '招待': 'Invitar',
      'メンバーを見る': 'Ver miembros', 'メンバー': 'Miembros', '閉じる': 'Cerrar',
      'メディアを追加': 'Agregar medio', 'メッセージを入力...': 'Escribe un mensaje...',
      'グループ名': 'Nombre del grupo', 'グループメンバー': 'Miembros del grupo',
      '承認': 'Aceptar', '拒否': 'Rechazar', 'チャット': 'Chat', '会話を削除': 'Eliminar conversación',
      'グループを退出': 'Salir del grupo', 'あいさつしよう！👋': '¡Saluda! 👋',
      'まだメッセージがありません。あいさつしよう！👋': 'Aún no hay mensajes. ¡Saluda! 👋',
      'まだどのグループにも参加していません。フレンドとのチャットから「＋」で作れます。': 'Aún no estás en ningún grupo. Crea uno desde un chat con un amigo usando el “+”.',
      'まだフレンドがいません。上から追加しましょう！': 'Aún no tienes amigos. ¡Agrega arriba!',
      'グループの読み込みに失敗しました。': 'Error al cargar los grupos.',
      'フレンドの読み込みに失敗しました。': 'Error al cargar los amigos.',
      'メッセージの読み込みに失敗しました。': 'Error al cargar los mensajes.',
      'メンバーの読み込みに失敗しました。': 'Error al cargar los miembros.',
      'リクエストの読み込みに失敗しました。': 'Error al cargar las solicitudes.',
      '会話がまだありません。左のフレンドから「チャット」を押しましょう！': 'Aún no hay conversaciones. ¡Pulsa “Chat” en un amigo a la izquierda!',
      '会話の読み込みに失敗しました。': 'Error al cargar las conversaciones.',
      '保留中のリクエストはありません。': 'No hay solicitudes pendientes.',
      '招待できるフレンドがいません。': 'No hay amigos para invitar.',
      'アップロードに失敗しました': 'Error al subir', 'グループの作成に失敗しました': 'Error al crear el grupo',
      'グループの削除に失敗しました': 'Error al eliminar el grupo', 'グループの退出に失敗しました': 'Error al salir del grupo',
      'グループを作成': 'Crear grupo', 'グループを作成中...': 'Creando grupo...',
      'グループ名を入力してください。': 'Escribe un nombre de grupo.',
      'フレンドリクエストを送信しました！': '¡Solicitud de amistad enviada!',
      'リクエストの送信に失敗しました': 'Error al enviar la solicitud', 'リクエストを送信中...': 'Enviando solicitud...',
      '会話の削除に失敗しました': 'Error al eliminar la conversación',
      '少なくとも1人選んでください。': 'Selecciona al menos una persona.',
      '招待しました！': '¡Invitación enviada!', '招待に失敗しました': 'Error al invitar', '招待中...': 'Invitando...',
      // Fase 2 — eventos
      'イベントを作成': 'Crear evento', 'イベント名': 'Nombre del evento', '時間': 'Hora',
      '場所': 'Lugar', '説明': 'Descripción', '📷 写真を追加': '📷 Añadir foto',
      'イベントを読み込み中...': 'Cargando eventos...',
      '今後のイベントはありません。最初のイベントを作成しましょう！': 'No hay eventos próximos. ¡Crea el primero!',
      'イベントの読み込みに失敗しました。': 'Error al cargar los eventos.',
      '✓ 参加中（取消）': '✓ Asistiendo (cancelar)', '参加する': 'Asistir', 'イベントを削除': 'Eliminar evento',
      'イベント名を入力してください。': 'Escribe el nombre del evento.',
      '日付を入力してください。': 'Escribe la fecha.',
      '日付は YYYY/MM/DD の形式で入力してください。': 'Escribe la fecha en formato YYYY/MM/DD.',
      'イベントを作成中...': 'Creando evento...', 'イベントを作成しました！': '¡Evento creado!',
      'イベントの作成に失敗しました': 'Error al crear el evento',
      'イベントの削除に失敗しました': 'Error al eliminar el evento',
      '参加状況の更新に失敗しました': 'Error al actualizar la asistencia',
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
      // Fase 3 — auth extras
      'パスワードの再設定': 'Restablecer tu contraseña', 'パスワードをお忘れですか': 'Olvidaste tu contraseña',
      '登録したメールアドレスを入力してください。再設定用のリンクをお送りします。': 'Introduce tu correo registrado y te enviaremos un enlace para restablecerla.',
      'リンクを送信': 'Enviar enlace', 'ログインに戻る': 'Volver al inicio de sesión', 'ログインへ': 'Ir al inicio de sesión',
      '送信に失敗しました': 'Error al enviar', '送信中...': 'Enviando...',
      'パスワードを再設定': 'Restablecer contraseña', '新しいパスワード': 'Nueva contraseña',
      '新しいパスワードを設定': 'Establecer nueva contraseña', '新しいパスワード（8文字以上）': 'Nueva contraseña (8+ caracteres)',
      '新しいパスワード（確認）': 'Nueva contraseña (confirmar)',
      'トークンがありません。リンクをもう一度確認してください。': 'Sin token. Revisa el enlace de nuevo.',
      'パスワードが一致しません。': 'Las contraseñas no coinciden.',
      '再設定に失敗しました': 'Error al restablecer', '再設定中...': 'Restableciendo...',
      'メールを認証しています...': 'Verificando tu correo...', 'メール認証': 'Verificación de correo',
      '認証に失敗しました': 'Error en la verificación', '認証トークンがありません。': 'Sin token de verificación.',
      // Fase 3 — herramientas
      '画像フォーマットコンバーター': 'Conversor de formato de imagen',
      '画像をアップロードして PNG・JPEG・GIF 間で変換します。': 'Sube una imagen y conviértela entre PNG, JPEG y GIF.',
      '変換': 'Convertir', '変換先:': 'Convertir a:',
      '音声フォーマットコンバーター': 'Conversor de formato de audio',
      '音声ファイルをアップロードして別のフォーマットに変換します。': 'Sube un archivo de audio y conviértelo a otro formato.',
      'リンクを貼り付けて、動画（MP4）または音声（MP3）としてダウンロードします。': 'Pega un enlace para descargarlo como video (MP4) o audio (MP3).',
      'ダウンロード': 'Descargar', 'ダウンロード形式:': 'Descargar como:', '動画 (MP4)': 'Video (MP4)', '音声 (MP3)': 'Audio (MP3)',
      '曲が選択されていません': 'Ninguna canción seleccionada', '曲を選んで再生しましょう。': 'Elige una canción para reproducir.',
      'リンク・テキスト': 'Enlace o texto', 'リンクやテキストを貼り付けて QR コードを生成します。': 'Pega un enlace o texto para generar un código QR.',
      '誤り訂正レベル:': 'Nivel de corrección de errores:', '低 (L)': 'Bajo (L)', '中 (M)': 'Medio (M)', 'やや高 (Q)': 'Cuartil (Q)', '高 (H)': 'Alto (H)',
      '生成': 'Generar', '生成された QR コード': 'Código QR generado',
      '無料のパブリックドメイン書籍': 'Libros de dominio público gratis',
      '合法的に無料の書籍 — パブリックドメイン、または著者・出版社が公開ライセンスで提供しているものです。': 'Libros legalmente gratuitos — de dominio público o publicados por los autores/editoriales con licencia abierta.',
      'プロジェクト・グーテンベルク（ポルトガル語）': 'Proyecto Gutenberg (Portugués)',
      '— 70,000冊以上の無料パブリックドメイン電子書籍。': '— Más de 70.000 e-books gratuitos de dominio público.',
      '— ポルトガル語のパブリックドメイン書籍。': '— Libros de dominio público en portugués.',
      '— 無料のデジタル貸出図書館。': '— Una biblioteca digital de préstamo gratuita.',
      '— 無料の技術書・コンピュータサイエンス書籍。': '— Libros gratuitos de tecnología e informática.',
      '— 無料の査読付き大学教科書。': '— Libros de texto universitarios revisados por pares, gratis.',
      '— 美しく整形されたパブリックドメインの名作。': '— Clásicos de dominio público bellamente formateados.',
      'Linuxディストリビューション': 'Distribuciones de Linux',
      '人気のある無料・オープンソースの Linux ディストロ公式ダウンロードリンク。': 'Enlaces oficiales de descarga de las distros Linux libres y de código abierto más populares.',
      '— 最も人気のあるデスクトップ／サーバー用ディストロ。': '— La distro de escritorio/servidor más popular.',
      '— 初心者に優しいデスクトップ体験。': '— Una experiencia de escritorio amigable para principiantes.',
      '— 安定志向でコミュニティ主導。': '— Centrada en la estabilidad y guiada por la comunidad.',
      '— 最先端、Red Hat がスポンサー。': '— De vanguardia, patrocinada por Red Hat.',
      '— エンタープライズ向け、RHEL互換。': '— De nivel empresarial, compatible con RHEL.',
      '— ミニマルで高いカスタマイズ性。': '— Minimalista y muy personalizable.',
      '— セキュリティとペネトレーションテスト向け。': '— Para seguridad y pruebas de penetración.',
      '便利な自動化スクリプト': 'Scripts útiles de automatización',
      'ターミナルにコピー＆ペーストして使ってください。実行する前に必ずスクリプトを読みましょう。': 'Copia y pega en tu terminal. Siempre lee un script antes de ejecutarlo.',
      'コピー': 'Copiar', 'システム更新（Rocky／RHEL系）': 'Actualización del sistema (familia Rocky / RHEL)',
      '開いているポートを確認': 'Ver puertos abiertos',
      '特定のポートを使うプロセスを見つけて終了': 'Encontrar y terminar el proceso que usa un puerto específico',
      'ディスク使用量の概要を確認': 'Ver un resumen del uso de disco', 'ディスク上の大きなファイルを探す': 'Buscar archivos grandes en el disco',
      'フォルダ内の30日より古いファイルを削除': 'Eliminar archivos con más de 30 días en una carpeta',
      'タイムスタンプ付きでフォルダをバックアップ': 'Hacer copia de una carpeta con fecha y hora',
      'システムリソースをリアルタイム監視': 'Monitorear recursos del sistema en tiempo real',
      '実行中のサービスを一覧表示': 'Listar servicios en ejecución',
      'SSL証明書の自動更新（Certbotのcron確認）': 'Renovar certificados SSL automáticamente (revisar cron de Certbot)',
      'スワップファイルを作成（低メモリのVMに便利）': 'Crear un archivo de swap (útil en VMs con poca memoria)',
      'ダウンロードフォルダをファイル種別で自動整理': 'Organizar la carpeta de Descargas por tipo de archivo',
      'フォルダ内の全画像を圧縮（ImageMagickが必要）': 'Comprimir todas las imágenes de una carpeta (requiere ImageMagick)',
      'フォルダを監視して新しいファイルを自動仕分け（リアルタイム）': 'Vigilar una carpeta y ordenar nuevos archivos automáticamente (tiempo real)',
      'ブラウザ上で動く使い捨ての Linux 環境です。コマンドを自由に試せます。ページを閉じるとすべて消えます。': 'Un entorno Linux desechable que corre en tu navegador. Prueba comandos libremente; todo se borra al cerrar la página.',
      '⚠️ この環境はインターネットに接続されていません。': '⚠️ Este entorno no está conectado a internet.',
      'すべてあなたのブラウザ内だけで動くため、ネットワークを必要とするコマンドは動きません：': 'Todo corre solo dentro de tu navegador, así que los comandos que necesitan red no funcionan:',
      'でのダウンロード、': ' descargas, ', 'パッケージのインストール（': 'instalación de paquetes (',
      'など': 'etc.', 'など）': 'etc.)', 'ファイル操作（': 'operaciones de archivos (',
      '）、テキスト処理（': '), procesamiento de texto (', '）、権限（': '), permisos (',
      '）、シェルスクリプトなど、ローカルで完結するコマンドは自由に試せます。': '), shell scripts y otros comandos totalmente locales se pueden probar sin problema.',
      '試せること：': 'Lo que puedes probar:', '再起動': 'Reiniciar',
      'すべてブラウザ内で動くのでサーバーには何も残りません。ページを閉じる・': 'Todo corre en el navegador, así que no queda nada en el servidor. Cerrar la página o ',
      'するとすべてリセットされます。初回はイメージの読み込みに少し時間がかかります。画面をクリックしてから入力してください。': ' lo reinicia todo. La primera carga de la imagen tarda un poco. Haz clic en la pantalla antes de escribir.',
      // Fase 3 — status de conversores
      'まず音声ファイルを選択してください。': 'Elige primero un archivo de audio.',
      'エラーが発生しました。もう一度お試しください。': 'Ocurrió un error. Inténtalo de nuevo.',
      '変換に失敗しました': 'Error en la conversión', '変換中...': 'Convirtiendo...',
      '完了！ダウンロードが自動的に始まります。': '¡Listo! La descarga comenzará automáticamente.',
      'ダウンロードに失敗しました': 'Error en la descarga',
      'ダウンロード中... 少し時間がかかる場合があります。': 'Descargando... esto puede tardar un momento.',
      'まだ曲がありません。': 'Aún no hay canciones.', '曲を読み込めませんでした。': 'No se pudieron cargar las canciones.',
      'まずリンクかテキストを入力してください。': 'Introduce primero un enlace o texto.',
      'テキストが長すぎます。もっと短い内容でお試しください。': 'El texto es demasiado largo. Intenta con algo más corto.',
      '生成しました！': '¡Generado!', 'コピーしました！': '¡Copiado!',
      // Fase 3 — notificações / busca (global)
      '通知': 'Notificaciones', 'すべて既読にする': 'Marcar todo como leído', '通知はまだありません。': 'Aún no hay notificaciones.',
      'たった今': 'justo ahora', 'ユーザー': 'Usuarios', '結果がありません': 'Sin resultados',
      // Fase 4a — campus
      'Enter を押してチャット…': 'Pulsa Enter para chatear…', 'クリックで全体マップ': 'Clic para el mapa completo',
      'クリックで拡大': 'Clic para ampliar', '音楽': 'Música',
      '矢印キーまたは WASD で移動 · Enter でチャット': 'Muévete con flechas o WASD · Enter para chatear',
      // Fase 4a — mecanografía
      'カテゴリ': 'Categoría', 'ここに入力…': 'Escribe aquí…', 'コマンドを解説 ▾': 'Explicar comando ▾',
      'デイリー': 'Diario', 'デイリーチャレンジ': 'Desafío diario', 'ミス': 'Errores', 'ランキング': 'Ranking',
      '実績': 'Logros', '履歴': 'Historial', '新しい文': 'Nueva frase', '精度': 'Precisión', '言語': 'Idioma',
      '「新しい文」を押して、下の入力欄にタイプしてください。': 'Pulsa "Nueva frase" y escribe en el campo de abajo.',
      '本日のランキング': 'Ranking de hoy', 'まだ履歴がありません。': 'Aún no hay historial.', 'まだ記録がありません。': 'Aún no hay registros.',
      'WPM · 精度': 'WPM · Precisión', '— 実績解除:': '— Logro desbloqueado:', 'すべて': 'Todos',
      'コマンドの解説を隠す ▴': 'Ocultar explicación ▴', '完了！': '¡Completado!', '本日の課題:': 'Desafío de hoy:',
      '読み込みに失敗しました': 'Error al cargar', '例': 'Ejemplo', '概要': 'Resumen', '用途': 'Uso',
      // Fase 4a — admin
      'ステータス — サーバー監視': 'Estado — monitoreo del servidor', '更新': 'Actualizar',
      '管理パネル — アカウント': 'Panel admin — cuentas', '通報 — モデレーション': 'Reportes — moderación',
      '停止': 'Banear', '却下': 'Descartar', '対応済みにする': 'Marcar como resuelto', '停止解除': 'Desbanear',
      '理由:': 'Motivo:', '投稿者:': 'Autor:', '通報者:': 'Reportado por:', '接続数:': 'Conexiones:',
      'オンラインのユーザー': 'Usuarios en línea', '（削除済み）': '(eliminado)', '通報はありません。': 'Sin reportes.',
      '有効': 'Activo', '管理者': 'Admin', '停止中': 'Baneado', '登録:': 'Registrado:', 'オフライン': 'Offline', 'オンライン': 'Online',
      'コア · 負荷:': 'Núcleos · carga:', 'サーバー': 'Servidor', 'スパム': 'Spam', 'ディスク': 'Disco', 'データベース': 'Base de datos',
      '不明': 'Desconocido', '不適切なコンテンツ': 'Contenido inapropiado', '停止の理由（任意）:': 'Motivo del baneo (opcional):',
      '匿名の海賊': 'Pirata anónimo', '取得できません': 'No disponible', '対応済み': 'Resuelto', '操作に失敗しました': 'Error en la operación',
      '攻撃的な内容': 'Contenido ofensivo', '最終更新:': 'Última actualización:', '未対応': 'Pendiente', '稼働時間:': 'Tiempo activo:', '応答:': 'Respuesta:',
      // Fase 4a — intro
      'Blackbeard Tavern とは？': '¿Qué es Blackbeard Tavern?',
      'HTML・CSS・JavaScript（Vanilla）／ Phaser': 'HTML/CSS/JavaScript (Vanilla) / Phaser',
      'Node.js・Express ／ Socket.io ／ PM2': 'Node.js, Express / Socket.io / PM2',
      '⚙️ 使用技術': '⚙️ Tecnologías', 'ようこそ': 'Bienvenido', 'インフラ': 'Infraestructura',
      'キャラクターで歩き回り、他のユーザーと出会えます。': 'Camina como un personaje y conoce a otros usuarios.',
      'サイトに入る': 'Entrar al sitio', 'スクロールして見る ↓': 'Desplázate para ver ↓',
      'タイピングゲーム（EN/JA・ランキング・実績）': 'Juego de mecanografía (EN/JA · ranking · logros)',
      'バックエンド': 'Backend', 'フィード（投稿・いいね・コメント）': 'Feed (publicaciones · me gusta · comentarios)',
      'フレンド・チャット（リアルタイム）': 'Amigos y chat (tiempo real)', 'フロントエンド': 'Frontend',
      'メディア処理': 'Procesamiento de medios', 'メール': 'Correo', 'リアルタイムのマルチプレイヤー空間。': 'Un espacio multijugador en tiempo real.',
      '便利なツール、SNS、バーチャルキャンパスが一つになった、': 'Herramientas útiles, red social y campus virtual, todo en uno —',
      '学生のためのオールインワン・プラットフォーム': 'una plataforma todo en uno para estudiantes',
      '学生のためのサイトです。': 'Un sitio para estudiantes.', '準備はいい？': '¿Listo?', '認証': 'Autenticación',
      '💬 ソーシャル（SNS）': '💬 Social (SNS)', '🗺 バーチャルキャンパス': '🗺 Campus virtual', '🛠 ツール': '🛠 Herramientas',
      // Fase 4b — calculadora de subredes
      'CIDR・VLSM・ネットワーク／ブロードキャスト・ホスト数・サブネット自動生成に対応。すべてブラウザ内で計算します。': 'Compatible con CIDR, VLSM, red/broadcast, conteo de hosts y generación automática de subredes. Todo se calcula en el navegador.',
      'IP アドレス（IPv4 / IPv6、CIDR 付きも可）': 'Dirección IP (IPv4 / IPv6, con CIDR también)',
      'VLSM を計算': 'Calcular VLSM', 'サブネットを生成': 'Generar subredes', 'サブネット分割': 'División de subredes',
      'サブネット計算機（IPv4 / IPv6）': 'Calculadora de subredes (IPv4 / IPv6)',
      'プレフィックス（CIDR）— IP に /xx が無い場合に使用': 'Prefijo (CIDR) — se usa cuando la IP no tiene /xx',
      'ベースネットワーク': 'Red base', 'ベースプレフィックス（IP に /xx が無い場合）': 'Prefijo base (cuando la IP no tiene /xx)',
      'ホスト要件（大きい順に自動で割り当てます）': 'Requisitos de host (asignados de mayor a menor automáticamente)',
      '例: 192.168.0.0/24': 'ej.: 192.168.0.0/24', '例: 192.168.0.0/24 または 2001:db8::/48': 'ej.: 192.168.0.0/24 o 2001:db8::/48',
      '例: 192.168.1.10/24 または 2001:db8::1': 'ej.: 192.168.1.10/24 o 2001:db8::1',
      '分割方法': 'Método de división', '履歴を消去': 'Borrar historial', '必要なサブネット数': 'Número de subredes necesarias',
      '必要なサブネット数を指定': 'Especificar número de subredes', '新しいプレフィックス': 'Nuevo prefijo',
      '新しいプレフィックスを指定': 'Especificar nuevo prefijo', '計算する': 'Calcular', '計算履歴': 'Historial de cálculos',
      '計算機': 'Calculadora', '＋ 要件を追加': '＋ Añadir requisito',
      'CIDR 表記': 'Notación CIDR', 'D (マルチキャスト)': 'D (multicast)', 'E (実験用)': 'E (experimental)', 'IP クラス': 'Clase de IP',
      'IPv4 のプレフィックスは 0〜32 です。': 'El prefijo IPv4 debe ser 0–32.', 'IPv4 の値が不正です。': 'Valor IPv4 no válido.',
      'IPv4 は 4 つのオクテットが必要です。': 'IPv4 requiere 4 octetos.', 'IPv6 が空です。': 'IPv6 está vacío.',
      'IPv6 のグループが多すぎます。': 'Demasiados grupos IPv6.', 'IPv6 のグループ数が不正です。': 'Número de grupos IPv6 no válido.',
      'IPv6 のプレフィックスは 0〜128 です。': 'El prefijo IPv6 debe ser 0–128.',
      'アドレス数': 'Nº de direcciones', 'グローバルユニキャスト': 'Unicast global', 'サブネット': 'Subred',
      'サブネットマスク': 'Máscara de subred', 'サブネット割り当て': 'Asignación de subredes', 'サブネット数を入力してください。': 'Introduce el número de subredes.',
      'ドキュメント用 (2001:db8::/32)': 'Documentación (2001:db8::/32)', 'ネットワーク (2進)': 'Red (binario)', 'ネットワーク (Prefix)': 'Red (prefijo)',
      'ネットワークアドレス': 'Dirección de red', 'パブリック': 'Pública', 'ブロードキャストアドレス': 'Dirección de broadcast', 'プライベート': 'Privada',
      'プレフィックス（CIDR）を指定してください。': 'Especifica un prefijo (CIDR).', 'マスク (2進)': 'Máscara (binario)', 'マルチキャスト': 'Multicast',
      'ユニークローカル (ULA)': 'Local única (ULA)', 'リンクローカル': 'Enlace local', 'リンクローカル (APIPA)': 'Enlace local (APIPA)',
      'ループバック': 'Loopback', 'ループバック (::1)': 'Loopback (::1)', 'ワイルドカードマスク': 'Máscara wildcard', '予約済み': 'Reservada',
      '使用可能ホスト数': 'Nº de hosts utilizables', '分割': 'Dividir', '各オクテットは 0〜255 の範囲です。': 'Cada octeto debe estar entre 0–255.',
      '圧縮なしの IPv6 は 8 グループ必要です。': 'IPv6 sin comprimir requiere 8 grupos.', '完全表記': 'Notación completa',
      '少なくとも 1 つのホスト要件を入力してください。': 'Introduce al menos un requisito de host.',
      '新しいプレフィックスはベースより大きくしてください。': 'El nuevo prefijo debe ser mayor que el base.',
      '最初のアドレス': 'Primera dirección', '最初のホスト': 'Primer host', '最後のアドレス': 'Última dirección', '最後のホスト': 'Último host',
      '有効な IPv4 または IPv6 アドレスを入力してください。': 'Introduce una dirección IPv4 o IPv6 válida.', '未指定 (::)': 'No especificada (::)',
      '種別': 'Tipo', '総アドレス数': 'Total de direcciones', '計算': 'Calcular',
      'ネットワーク': 'Red', 'アドレス範囲': 'Rango de direcciones', 'ホスト範囲': 'Rango de hosts', 'ブロードキャスト': 'Broadcast', 'ホスト数': 'Nº de hosts',
      '名前': 'Nombre', '要求': 'Requerido', 'マスク': 'Máscara', '範囲': 'Rango', '使用可能': 'Utilizable', '再利用': 'Reutilizar',
      '必要ホスト数': 'Hosts necesarios', '部署名（例: 営業部）': 'Nombre del departamento (ej.: Ventas)', 'まだ計算履歴がありません。': 'Aún no hay historial de cálculos.', '合計': 'Total',
      // Fase 4b — Cisco lab (UI; la salida del terminal queda igual)
      'Cisco IOS のコマンドを練習できるシミュレーターです。ルーター／スイッチ／L3スイッチのコマンドを試せます。': 'Un simulador para practicar comandos de Cisco IOS. Prueba comandos de router / switch / switch L3.',
      'L3スイッチ': 'Switch L3', 'スイッチ (L2)': 'Switch (L2)', 'ルーター': 'Router',
      'これは IOS のシミュレーターです（本物の IOS ではありません）。': 'Este es un simulador de IOS (no es el IOS real).',
      'デバイス:': 'Dispositivo:', 'ヒント：': 'Pista:', 'リセット': 'Restablecer', 'など。': 'etc.',
      '「enable」で特権モード、「configure terminal」で設定モード。「?」でヘルプ。': 'Usa “enable” para el modo privilegiado, “configure terminal” para el modo de configuración y “?” para la ayuda.',
      // Diálogos confirm() (los interpolados los maneja PATTERNS)
      'このイベントを削除しますか？元に戻せません。': '¿Eliminar este evento? No se puede deshacer.',
      'この投稿を削除しますか？元に戻せません。': '¿Eliminar esta publicación? No se puede deshacer.',
      'このコメントを削除しますか？': '¿Eliminar este comentario?',
      'このフレンドを削除しますか？': '¿Eliminar a este amigo?',
      'このグループを退出しますか？再度参加するには招待が必要です。': '¿Salir de este grupo? Necesitarás una invitación para volver.',
      'このグループを全員のために削除しますか？すべてのメッセージが失われ、元に戻せません。': '¿Eliminar este grupo para todos? Se perderán todos los mensajes y no se puede deshacer.',
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

  // Padrões (regex) para textos com partes variáveis (números, datas, nomes)
  // que não casam com uma chave fixa do dicionário.
  function pad(s) { s = String(s); return s.length < 2 ? '0' + s : s; }
  var WK = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    pt: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
    es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  };
  var JP_WK = ['日', '月', '火', '水', '木', '金', '土'];
  var PATTERNS = [
    { // data no estilo japonês: 2026年10月29日（水） [· hora]
      re: /^(📅\s*)?(\d{4})年(\d{1,2})月(\d{1,2})日（([日月火水木金土])）([\s\S]*)$/,
      fn: function (m) {
        var i = JP_WK.indexOf(m[5]);
        var w = (WK[LANG] || WK.en)[i] || m[5];
        var date = LANG === 'en' ? (m[2] + '/' + pad(m[3]) + '/' + pad(m[4]))
                                 : (pad(m[4]) + '/' + pad(m[3]) + '/' + m[2]);
        return (m[1] || '') + date + ' (' + w + ')' + m[6];
      }
    },
    { re: /^(\d+)人参加$/, fn: function (m) { return m[1] + (LANG === 'en' ? ' attending' : LANG === 'pt' ? ' participando' : ' asistiendo'); } },
    { re: /^(\d+)人のメンバー$/, fn: function (m) { return m[1] + (LANG === 'en' ? ' members' : LANG === 'pt' ? ' membros' : ' miembros'); } },
    { re: /^作成者:\s*([\s\S]*)$/, fn: function (m) { return (LANG === 'en' ? 'Created by: ' : LANG === 'pt' ? 'Criado por: ' : 'Creado por: ') + m[1]; } },
    // "tempo atrás" (feed e notificações): 5分前 / 3時間前 / 2日前
    { re: /^(\d+)分前$/, fn: function (m) { return LANG === 'en' ? m[1] + ' min ago' : LANG === 'pt' ? 'há ' + m[1] + ' min' : 'hace ' + m[1] + ' min'; } },
    { re: /^(\d+)時間前$/, fn: function (m) { return LANG === 'en' ? m[1] + ' h ago' : LANG === 'pt' ? 'há ' + m[1] + ' h' : 'hace ' + m[1] + ' h'; } },
    { re: /^(\d+)日前$/, fn: function (m) { var one = m[1] === '1'; return LANG === 'en' ? m[1] + (one ? ' day ago' : ' days ago') : LANG === 'pt' ? 'há ' + m[1] + (one ? ' dia' : ' dias') : 'hace ' + m[1] + (one ? ' día' : ' días'); } },
    // contador de presença no campus: "🟢 3人" / "3人"
    { re: /^(🟢\s*)?(\d+)人$/, fn: function (m) { return (m[1] || '') + m[2] + (LANG === 'es' ? ' en línea' : ' online'); } },
    // subnet: "N件のサブネットを生成しました。"
    { re: /^(\d+)件のサブネットを生成しました。$/, fn: function (m) { return LANG === 'en' ? 'Generated ' + m[1] + ' subnets.' : LANG === 'pt' ? 'Geramos ' + m[1] + ' sub-redes.' : 'Se generaron ' + m[1] + ' subredes.'; } },
    // --- Corpos de notificação (gerados pelo backend com o nome do ator) ---
    { re: /^(.+)さんがあなたの投稿にいいねしました$/, fn: function (m) { return LANG === 'en' ? m[1] + ' liked your post' : LANG === 'pt' ? m[1] + ' curtiu seu post' : 'A ' + m[1] + ' le gustó tu publicación'; } },
    { re: /^(.+)さんがあなたの投稿にコメントしました$/, fn: function (m) { return LANG === 'en' ? m[1] + ' commented on your post' : LANG === 'pt' ? m[1] + ' comentou no seu post' : m[1] + ' comentó tu publicación'; } },
    { re: /^(.+)さんがグループ「(.+)」にあなたを追加しました$/, fn: function (m) { return LANG === 'en' ? m[1] + ' added you to the group “' + m[2] + '”' : LANG === 'pt' ? m[1] + ' adicionou você ao grupo “' + m[2] + '”' : m[1] + ' te añadió al grupo “' + m[2] + '”'; } },
    { re: /^(.+)さんからフレンドリクエストが届きました$/, fn: function (m) { return LANG === 'en' ? 'Friend request from ' + m[1] : LANG === 'pt' ? 'Pedido de amizade de ' + m[1] : 'Solicitud de amistad de ' + m[1]; } },
    { re: /^(.+)さんがフレンドリクエストを承認しました$/, fn: function (m) { return LANG === 'en' ? m[1] + ' accepted your friend request' : LANG === 'pt' ? m[1] + ' aceitou seu pedido de amizade' : m[1] + ' aceptó tu solicitud de amistad'; } },
    { re: /^(.+) 画像を送信しました 🖼️$/, fn: function (m) { return LANG === 'en' ? m[1] + ' sent an image 🖼️' : LANG === 'pt' ? m[1] + ' enviou uma imagem 🖼️' : m[1] + ' envió una imagen 🖼️'; } },
    { re: /^(.+) 動画を送信しました 🎥$/, fn: function (m) { return LANG === 'en' ? m[1] + ' sent a video 🎥' : LANG === 'pt' ? m[1] + ' enviou um vídeo 🎥' : m[1] + ' envió un vídeo 🎥'; } },
    // confirm() interpolado do chat (apagar conversa com <nome>)
    { re: /^(.+) とのチャットをすべて削除しますか？両方の履歴が消え、元に戻せません。$/, fn: function (m) { return LANG === 'en' ? 'Delete all chat with ' + m[1] + '? Both sides’ history will be lost and this can’t be undone.' : LANG === 'pt' ? 'Excluir toda a conversa com ' + m[1] + '? O histórico dos dois lados será perdido e não pode ser desfeito.' : 'Eliminar todo el chat con ' + m[1] + '? Se perderá el historial de ambos y no se puede deshacer.'; } }
  ];

  function translateString(core) {
    if (!TABLE) return undefined;
    if (TABLE[core] !== undefined) return TABLE[core];
    for (var i = 0; i < PATTERNS.length; i++) {
      var mm = core.match(PATTERNS[i].re);
      if (mm) return PATTERNS[i].fn(mm);
    }
    return undefined;
  }

  // ---- Tradução de nós de texto (preservando espaços nas bordas) ----
  function translateTextNode(node) {
    var raw = node.nodeValue;
    if (!raw) return;
    var m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!m) return;
    var core = m[2];
    if (!core) return;
    var t = translateString(core);
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
      var t = translateString(tv);
      if (t !== undefined && t !== tv) el.setAttribute(a, t);
    }
    // valor de botões/inputs do tipo submit/button
    if (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) {
      var vv = el.value && el.value.trim();
      if (vv) { var tt = translateString(vv); if (tt !== undefined && tt !== vv) el.value = tt; }
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
      var t = translateString(parts[0].trim());
      if (t !== undefined) { parts[0] = t; document.title = parts.join(sep); }
    } else {
      var tt = translateString(title.trim());
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

  // Seletor flutuante para páginas sem header (ex.: intro), com estilos inline
  // (não depende do style.css). Linha de 4 botões no canto superior direito.
  function buildFloatingSwitcher() {
    if (document.querySelector('.i18n-switch')) return;
    var box = document.createElement('div');
    box.className = 'i18n-switch';
    box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:3000;display:flex;gap:6px;' +
      'background:rgba(20,14,8,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
      'padding:5px;border-radius:999px;border:1px solid rgba(232,181,58,.35);font-family:sans-serif;';
    SUPPORTED.forEach(function (code) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-no-i18n', '');
      b.textContent = SHORT[code];
      var active = code === LANG;
      b.style.cssText = 'cursor:pointer;border:none;border-radius:999px;padding:5px 10px;font-size:12px;' +
        'font-weight:700;background:' + (active ? 'linear-gradient(135deg,#f0c24a,#c8860b)' : 'transparent') +
        ';color:' + (active ? '#231405' : '#e8d9b8') + ';';
      b.addEventListener('click', function () { setLang(code); });
      box.appendChild(b);
    });
    document.body.appendChild(box);
  }

  function buildSwitcher() {
    var header = document.querySelector('header');
    if (header && header.querySelector('.i18n-switch')) return;
    if (!header) { buildFloatingSwitcher(); return; }

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

  // Exposto para outros scripts:
  //  - t(s): traduz uma string manualmente
  //  - apply(root): traduz o DOM agora (usado pela intro ANTES de fragmentar os
  //    títulos em <span> por caractere, senão não casaria mais com o dicionário)
  window.__i18n = {
    t: function (s) { var r = translateString(String(s)); return r === undefined ? s : r; },
    apply: function (root) { if (TABLE) { translateElement(root || document.body); translateTitle(); } },
    lang: LANG
  };
})();
