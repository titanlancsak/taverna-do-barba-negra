// Acervo da Typing Game. Cada item é um COMANDO (ASCII, sem IME) com explicação
// bilíngue: s = resumo, u = para que serve, ex = exemplos. O seletor de idioma
// escolhe o idioma da explicação (o texto digitado é o mesmo). Adicionar 'pt' é
// só incluir a chave em cada item e em TYPING_LANGUAGES.
const TYPING_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' }
];

const TYPING_CATEGORIES = [
  { value: 'linux', label: 'Linux' },
  { value: 'sql', label: 'SQL' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'aws', label: 'AWS' },
  { value: 'cisco', label: 'Cisco' }
];

const TYPING_SNIPPETS = {
  linux: [
    { text: 'sudo apt update && sudo apt upgrade -y',
      en: { s: 'Refreshes the package index, then upgrades all installed packages.', u: 'Keep a Debian/Ubuntu system up to date and patched.', ex: ['sudo apt update — only refresh the package list', 'sudo apt upgrade -y — upgrade without prompts'] },
      ja: { s: 'パッケージ一覧を更新し、インストール済みを全てアップグレードします。', u: 'Debian/Ubuntu 系を最新・安全に保つために使います。', ex: ['sudo apt update — 一覧だけ更新', 'sudo apt upgrade -y — 確認なしで更新'] } },
    { text: 'grep -rn "error" /var/log/syslog',
      en: { s: 'Recursively searches for "error", showing file and line numbers.', u: 'Find where a keyword appears across log files.', ex: ['grep -i "fail" app.log — case-insensitive search', 'grep -c "warn" app.log — count matches'] },
      ja: { s: '「error」を再帰的に検索し、ファイル名と行番号を表示します。', u: 'ログからキーワードの出現箇所を探すのに使います。', ex: ['grep -i "fail" app.log — 大文字小文字を無視', 'grep -c "warn" app.log — 一致数を数える'] } },
    { text: 'chmod 755 deploy.sh',
      en: { s: 'Sets file permissions to rwxr-xr-x (owner full, others read/exec).', u: 'Make a script executable while keeping it safe.', ex: ['chmod +x run.sh — just add execute', 'chmod 644 notes.txt — read/write owner, read others'] },
      ja: { s: '権限を rwxr-xr-x（所有者は全権、他は読取/実行）に設定します。', u: 'スクリプトを実行可能にしつつ安全に保ちます。', ex: ['chmod +x run.sh — 実行権だけ付与', 'chmod 644 notes.txt — 所有者読書き/他は読取'] } },
    { text: 'tar czf backup.tar.gz /home/user',
      en: { s: 'Creates a gzip-compressed archive of a directory.', u: 'Bundle and compress files for backup or transfer.', ex: ['tar xzf backup.tar.gz — extract it', 'tar tzf backup.tar.gz — list contents'] },
      ja: { s: 'ディレクトリを gzip 圧縮したアーカイブを作成します。', u: 'バックアップや転送のためにファイルをまとめて圧縮します。', ex: ['tar xzf backup.tar.gz — 展開する', 'tar tzf backup.tar.gz — 中身を一覧'] } },
    { text: 'ps aux | grep nginx',
      en: { s: 'Lists running processes and filters lines containing nginx.', u: 'Check whether a process is running and see its PID.', ex: ['ps aux | grep node — find node processes', 'kill -9 <PID> — force stop a process'] },
      ja: { s: '実行中プロセスを一覧し、nginx を含む行だけ抽出します。', u: 'プロセスが動いているか、PID を確認します。', ex: ['ps aux | grep node — node を探す', 'kill -9 <PID> — 強制終了'] } },
    { text: 'find / -name "*.conf" -type f',
      en: { s: 'Searches the whole filesystem for files ending in .conf.', u: 'Locate configuration files anywhere on the system.', ex: ['find . -mtime -1 — files changed in last day', 'find /tmp -size +100M — large files in /tmp'] },
      ja: { s: 'ファイルシステム全体から .conf で終わるファイルを探します。', u: '設定ファイルの場所をシステム全体から探します。', ex: ['find . -mtime -1 — 過去1日で変更', 'find /tmp -size +100M — 100MB超のファイル'] } },
    { text: 'df -h && du -sh /var/log',
      en: { s: 'Shows disk usage per filesystem, then the size of /var/log.', u: 'Diagnose which mount or folder is filling the disk.', ex: ['df -h — human-readable free space', 'du -sh * — size of each item here'] },
      ja: { s: 'ディスク使用量と /var/log のサイズを表示します。', u: 'どのマウントやフォルダが容量を食っているか調べます。', ex: ['df -h — 空き容量を見やすく表示', 'du -sh * — 各項目のサイズ'] } }
  ],
  sql: [
    { text: 'SELECT id, name FROM users WHERE active = true;',
      en: { s: 'Reads the id and name columns for rows where active is true.', u: 'Fetch a filtered subset of columns from a table.', ex: ['SELECT * FROM users; — every column', 'SELECT name FROM users LIMIT 10; — first 10'] },
      ja: { s: 'active が true の行から id と name を取得します。', u: 'テーブルから条件で絞った列を取り出します。', ex: ['SELECT * FROM users; — 全列', 'SELECT name FROM users LIMIT 10; — 先頭10件'] } },
    { text: "UPDATE orders SET status = 'shipped' WHERE id = 42;",
      en: { s: 'Changes the status of the order with id 42 to shipped.', u: 'Modify existing rows that match a condition.', ex: ["UPDATE users SET active = false WHERE id = 5;", 'Always include WHERE to avoid updating all rows'] },
      ja: { s: 'id が 42 の注文の status を shipped に変更します。', u: '条件に合う既存の行を更新します。', ex: ["UPDATE users SET active = false WHERE id = 5;", 'WHERE を忘れると全行が更新されるので注意'] } },
    { text: "INSERT INTO logs (level, message) VALUES ('info', 'ok');",
      en: { s: 'Adds a new row to the logs table with the given values.', u: 'Store a new record in a table.', ex: ["INSERT INTO tags (name) VALUES ('sql');", 'Column list and VALUES must line up in order'] },
      ja: { s: 'logs テーブルに指定した値の行を追加します。', u: 'テーブルに新しいレコードを保存します。', ex: ["INSERT INTO tags (name) VALUES ('sql');", '列の並びと VALUES の並びを合わせる'] } },
    { text: 'DELETE FROM sessions WHERE expires_at < NOW();',
      en: { s: 'Removes session rows whose expiry time is in the past.', u: 'Clean up stale or expired records.', ex: ['DELETE FROM cart WHERE user_id = 3;', 'Without WHERE, DELETE empties the table'] },
      ja: { s: '有効期限が過去のセッション行を削除します。', u: '古い・期限切れのレコードを掃除します。', ex: ['DELETE FROM cart WHERE user_id = 3;', 'WHERE なしだと全行が消える'] } },
    { text: 'SELECT user_id, COUNT(*) FROM orders GROUP BY user_id;',
      en: { s: 'Counts orders per user by grouping rows on user_id.', u: 'Aggregate data into per-group summaries.', ex: ['... HAVING COUNT(*) > 5 — filter groups', 'SUM(total) — total spent per group'] },
      ja: { s: 'user_id ごとに行をまとめて注文数を数えます。', u: 'データをグループ単位で集計します。', ex: ['... HAVING COUNT(*) > 5 — グループを絞る', 'SUM(total) — グループ毎の合計'] } },
    { text: 'CREATE INDEX idx_users_email ON users(email);',
      en: { s: 'Builds an index on the email column of the users table.', u: 'Speed up lookups and joins on a column.', ex: ['CREATE UNIQUE INDEX ... — enforce uniqueness', 'DROP INDEX idx_users_email; — remove it'] },
      ja: { s: 'users テーブルの email 列にインデックスを作成します。', u: '列での検索や結合を高速化します。', ex: ['CREATE UNIQUE INDEX ... — 一意制約付き', 'DROP INDEX idx_users_email; — 削除'] } },
    { text: 'SELECT * FROM a JOIN b ON a.id = b.a_id;',
      en: { s: 'Combines rows from tables a and b where their keys match.', u: 'Query related data spread across tables.', ex: ['LEFT JOIN — keep all rows from the left table', 'ON defines how the tables relate'] },
      ja: { s: 'キーが一致する a と b の行を結合します。', u: '複数テーブルにまたがる関連データを取得します。', ex: ['LEFT JOIN — 左テーブルの行を全て残す', 'ON で結合条件を指定'] } }
  ],
  python: [
    { text: 'def add(a, b): return a + b',
      en: { s: 'Defines a function that returns the sum of two arguments.', u: 'Package reusable logic behind a name.', ex: ['add(2, 3) → 5', 'def greet(n): return f"hi {n}"'] },
      ja: { s: '2 つの引数の和を返す関数を定義します。', u: '再利用できる処理を名前でまとめます。', ex: ['add(2, 3) → 5', 'def greet(n): return f"hi {n}"'] } },
    { text: 'nums = [x * 2 for x in range(10)]',
      en: { s: 'Builds a list by doubling each number from 0 to 9.', u: 'Create/transform lists concisely (list comprehension).', ex: ['[x for x in xs if x > 0] — filter', '{k: v for k, v in pairs} — dict version'] },
      ja: { s: '0〜9 を 2 倍した値のリストを作ります。', u: 'リストを簡潔に生成・変換します（内包表記）。', ex: ['[x for x in xs if x > 0] — 絞り込み', '{k: v for k, v in pairs} — 辞書版'] } },
    { text: "with open('data.txt') as f: data = f.read()",
      en: { s: 'Opens a file and reads it, closing it automatically after.', u: 'Safely handle files without leaking handles.', ex: ["with open('x','w') as f: f.write(s)", 'for line in f: — read line by line'] },
      ja: { s: 'ファイルを開いて読み込み、終了後に自動で閉じます。', u: 'ファイルを安全に扱い、閉じ忘れを防ぎます。', ex: ["with open('x','w') as f: f.write(s)", 'for line in f: — 1行ずつ読む'] } },
    { text: 'items.sort(key=lambda x: x.score, reverse=True)',
      en: { s: 'Sorts a list in place by each item score, highest first.', u: 'Order objects by a custom field.', ex: ['sorted(xs) — new sorted list', 'key=len — sort by length'] },
      ja: { s: 'score を基準に降順でリストをその場で並べ替えます。', u: 'オブジェクトを任意の項目で並べ替えます。', ex: ['sorted(xs) — 新しいソート済みリスト', 'key=len — 長さでソート'] } },
    { text: 'import json; obj = json.loads(text)',
      en: { s: 'Parses a JSON string into a Python dict/list.', u: 'Read JSON from APIs, files, or config.', ex: ['json.dumps(obj) — back to a string', 'json.load(f) — parse from a file'] },
      ja: { s: 'JSON 文字列を Python の辞書/リストに変換します。', u: 'API・ファイル・設定の JSON を読み込みます。', ex: ['json.dumps(obj) — 文字列に戻す', 'json.load(f) — ファイルから読む'] } },
    { text: 'try: run() except Exception as e: print(e)',
      en: { s: 'Runs code and catches any error instead of crashing.', u: 'Handle failures gracefully.', ex: ['except ValueError: — catch a specific error', 'finally: — always run cleanup'] },
      ja: { s: 'コードを実行し、落ちる代わりに例外を捕まえます。', u: 'エラーを適切に処理します。', ex: ['except ValueError: — 特定の例外を捕捉', 'finally: — 後処理を必ず実行'] } },
    { text: 'app = Flask(__name__)',
      en: { s: 'Creates a Flask web application instance.', u: 'Start building a small web server/API.', ex: ["@app.route('/') — define a route", 'app.run() — start the server'] },
      ja: { s: 'Flask の Web アプリのインスタンスを作ります。', u: '小さな Web サーバー/API を作り始めます。', ex: ["@app.route('/') — ルートを定義", 'app.run() — サーバー起動'] } }
  ],
  java: [
    { text: 'List<String> names = new ArrayList<>();',
      en: { s: 'Declares a growable list of strings.', u: 'Store an ordered, resizable collection.', ex: ['names.add("a"); — append', 'names.get(0); — read by index'] },
      ja: { s: '拡張可能な文字列リストを宣言します。', u: '順序付きで可変のコレクションを保持します。', ex: ['names.add("a"); — 追加', 'names.get(0); — 添字で取得'] } },
    { text: 'System.out.println("Hello, world");',
      en: { s: 'Prints a line of text to standard output.', u: 'Display output or debug values.', ex: ['System.out.print(x); — no newline', 'System.err.println(e); — to stderr'] },
      ja: { s: '標準出力に 1 行のテキストを表示します。', u: '出力やデバッグ値を表示します。', ex: ['System.out.print(x); — 改行なし', 'System.err.println(e); — 標準エラーへ'] } },
    { text: 'Map<String, Integer> counts = new HashMap<>();',
      en: { s: 'Creates a key-value map from strings to integers.', u: 'Look up values by a unique key.', ex: ['counts.put("a", 1);', 'counts.getOrDefault("a", 0)'] },
      ja: { s: '文字列→整数のキー値マップを作ります。', u: '一意のキーで値を引きます。', ex: ['counts.put("a", 1);', 'counts.getOrDefault("a", 0)'] } },
    { text: 'for (int i = 0; i < n; i++) sum += i;',
      en: { s: 'Loops from 0 to n-1, accumulating into sum.', u: 'Repeat an action a fixed number of times.', ex: ['for (String s : list) — for-each loop', 'while (cond) — condition loop'] },
      ja: { s: '0 から n-1 まで繰り返し、sum に加算します。', u: '決まった回数だけ処理を繰り返します。', ex: ['for (String s : list) — 拡張 for', 'while (cond) — 条件ループ'] } },
    { text: 'public static void main(String[] args) {}',
      en: { s: 'The entry point method where a Java program starts.', u: 'Define what runs when the program launches.', ex: ['args holds command-line arguments', 'Must be in a public class'] },
      ja: { s: 'Java プログラムが開始するエントリーポイントです。', u: '起動時に実行される処理を定義します。', ex: ['args にコマンドライン引数が入る', 'public クラス内に置く'] } },
    { text: 'String csv = String.join(",", list);',
      en: { s: 'Joins list elements into one comma-separated string.', u: 'Turn a collection into text.', ex: ['"a,b,c".split(",") — the reverse', 'String.join("-", parts)'] },
      ja: { s: 'リストの要素をカンマ区切りの 1 文字列に連結します。', u: 'コレクションをテキストに変換します。', ex: ['"a,b,c".split(",") — 逆の操作', 'String.join("-", parts)'] } },
    { text: 'Optional<User> u = repo.findById(id);',
      en: { s: 'Returns a value that may or may not be present.', u: 'Avoid null by making absence explicit.', ex: ['u.isPresent() — check first', 'u.orElse(defaultUser)'] },
      ja: { s: '存在するかもしれない値を返します。', u: 'null を避け、不在を明示します。', ex: ['u.isPresent() — 有無を確認', 'u.orElse(defaultUser)'] } }
  ],
  aws: [
    { text: 'aws s3 cp file.txt s3://my-bucket/',
      en: { s: 'Uploads a local file to an S3 bucket.', u: 'Move files between your machine and S3.', ex: ['aws s3 cp s3://b/f.txt . — download', 'aws s3 ls s3://my-bucket/ — list objects'] },
      ja: { s: 'ローカルファイルを S3 バケットにアップロードします。', u: 'ローカルと S3 間でファイルを移動します。', ex: ['aws s3 cp s3://b/f.txt . — ダウンロード', 'aws s3 ls s3://my-bucket/ — 一覧'] } },
    { text: 'aws ec2 describe-instances',
      en: { s: 'Lists your EC2 instances and their details.', u: 'Inspect running/stopped virtual servers.', ex: ['--filters "Name=instance-state-name,Values=running"', 'aws ec2 start-instances --instance-ids i-123'] },
      ja: { s: 'EC2 インスタンスとその詳細を一覧します。', u: '稼働/停止中の仮想サーバーを確認します。', ex: ['--filters "Name=instance-state-name,Values=running"', 'aws ec2 start-instances --instance-ids i-123'] } },
    { text: 'aws lambda invoke --function-name proc out.json',
      en: { s: 'Runs a Lambda function and writes its response to a file.', u: 'Test or trigger serverless functions from the CLI.', ex: ['--payload \'{"k":"v"}\' — pass input', 'aws lambda list-functions'] },
      ja: { s: 'Lambda 関数を実行し、応答をファイルに書き出します。', u: 'CLI からサーバーレス関数を実行/テストします。', ex: ['--payload \'{"k":"v"}\' — 入力を渡す', 'aws lambda list-functions'] } },
    { text: 'aws s3 sync ./dist s3://my-site',
      en: { s: 'Syncs a local folder to S3, uploading only changes.', u: 'Deploy a static site or mirror a directory.', ex: ['--delete — remove files missing locally', 'aws s3 sync s3://b ./local — pull'] },
      ja: { s: 'ローカルフォルダを S3 に同期し、差分だけ送ります。', u: '静的サイトの公開やフォルダのミラーに使います。', ex: ['--delete — ローカルに無い物を削除', 'aws s3 sync s3://b ./local — 取得'] } },
    { text: 'aws iam list-users',
      en: { s: 'Lists the IAM users in the account.', u: 'Audit who has access and manage identities.', ex: ['aws iam create-user --user-name app', 'aws iam attach-user-policy ...'] },
      ja: { s: 'アカウント内の IAM ユーザーを一覧します。', u: 'アクセス権の監査や ID 管理に使います。', ex: ['aws iam create-user --user-name app', 'aws iam attach-user-policy ...'] } },
    { text: 'aws logs tail /aws/lambda/proc --follow',
      en: { s: 'Streams CloudWatch logs for a log group in real time.', u: 'Watch application/function logs live.', ex: ['--since 1h — start from an hour ago', '--format short — compact output'] },
      ja: { s: 'ロググループの CloudWatch ログをリアルタイムで流します。', u: 'アプリ/関数のログをライブで監視します。', ex: ['--since 1h — 1時間前から', '--format short — 簡潔表示'] } }
  ],
  cisco: [
    { text: 'enable',
      en: { s: 'Enters privileged EXEC mode on the device.', u: 'Unlock configuration and show commands.', ex: ['disable — leave privileged mode', 'Prompt changes from > to #'] },
      ja: { s: 'デバイスの特権 EXEC モードに入ります。', u: '設定コマンドや詳細表示を有効にします。', ex: ['disable — 特権モードを抜ける', 'プロンプトが > から # に変わる'] } },
    { text: 'configure terminal',
      en: { s: 'Enters global configuration mode.', u: 'Start changing the device configuration.', ex: ['end — return to privileged mode', 'exit — go up one level'] },
      ja: { s: 'グローバル設定モードに入ります。', u: 'デバイスの設定変更を始めます。', ex: ['end — 特権モードに戻る', 'exit — 一つ上の階層へ'] } },
    { text: 'show running-config',
      en: { s: 'Displays the active running configuration.', u: 'Review the current device settings.', ex: ['| include hostname — filter output', 'copy run start — save config'] },
      ja: { s: '現在動作中の設定を表示します。', u: 'デバイスの現在の設定を確認します。', ex: ['| include hostname — 出力を絞る', 'copy run start — 設定を保存'] } },
    { text: 'interface GigabitEthernet0/1',
      en: { s: 'Selects a specific interface to configure.', u: 'Enter interface config to set IP, VLAN, etc.', ex: ['no shutdown — enable the port', 'description UPLINK'] },
      ja: { s: '設定対象のインターフェースを選択します。', u: 'IP や VLAN 等を設定するために入ります。', ex: ['no shutdown — ポートを有効化', 'description UPLINK'] } },
    { text: 'ip address 192.168.1.1 255.255.255.0',
      en: { s: 'Assigns an IP address and mask to an interface.', u: 'Give a device/interface network reachability.', ex: ['ip address dhcp — obtain via DHCP', 'no ip address — remove it'] },
      ja: { s: 'インターフェースに IP アドレスとマスクを割り当てます。', u: 'デバイス/ポートにネットワーク到達性を与えます。', ex: ['ip address dhcp — DHCP で取得', 'no ip address — 削除'] } },
    { text: 'switchport access vlan 10',
      en: { s: 'Puts a switch port into access mode on VLAN 10.', u: 'Assign an endpoint port to a VLAN.', ex: ['switchport mode access — set the mode', 'show vlan brief — verify'] },
      ja: { s: 'スイッチポートを VLAN 10 のアクセスモードにします。', u: '端末用ポートを VLAN に割り当てます。', ex: ['switchport mode access — モード設定', 'show vlan brief — 確認'] } }
  ]
};

// Metadados das conquistas (ícone + rótulo/descrição em japonês)
const TYPING_ACHIEVEMENTS = {
  first_run:      { icon: '🎉', label: 'はじめの一歩', desc: '初めてのタイピングを完了' },
  speed_40:       { icon: '🚀', label: '40 WPM',       desc: '40 WPM を達成' },
  speed_60:       { icon: '⚡', label: '60 WPM',       desc: '60 WPM を達成' },
  speed_80:       { icon: '🔥', label: '80 WPM',       desc: '80 WPM を達成' },
  speed_100:      { icon: '💯', label: '100 WPM',      desc: '100 WPM を達成' },
  accuracy_100:   { icon: '🎯', label: 'パーフェクト',  desc: '精度 100% を達成' },
  daily_done:     { icon: '📅', label: 'デイリー参加',  desc: 'デイリーチャレンジに挑戦' },
  all_categories: { icon: '🗂️', label: 'オールラウンダー', desc: '全カテゴリをプレイ' },
  streak_7:       { icon: '🏆', label: '7日連続',      desc: '7日連続でデイリーを達成' }
};

// Trecho aleatório de uma categoria (retorna o item completo com explicação).
function randomSnippet(category) {
  const list = TYPING_SNIPPETS[category] || [];
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

// Desafio diário: item escolhido de forma determinística pela data (igual para todos).
function getDailySnippet() {
  const flat = [];
  for (const cat of TYPING_CATEGORIES) {
    (TYPING_SNIPPETS[cat.value] || []).forEach((entry) => flat.push({ category: cat.value, entry }));
  }
  const now = new Date();
  const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  return flat[dayNumber % flat.length];
}
