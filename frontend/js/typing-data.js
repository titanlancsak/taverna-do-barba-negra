// Acervo de trechos da Typing Game. Tudo em ASCII (sem IME): EN em inglês,
// JA em romaji. Adicionar 'pt' aqui no futuro é só incluir a chave.
const TYPING_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語 (ローマ字)' }
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
  linux: {
    en: [
      'sudo apt update && sudo apt upgrade -y',
      'find /var/log -name "*.log" -mtime +7 -delete',
      'grep -rn "error" /var/log/syslog | tail -20',
      'chmod 640 config.env && chown root:www-data config.env'
    ],
    ja: [
      'ls -la de kakureta fairu mo issho ni hyouji suru',
      'tar czf backup.tar.gz /home/user no naka wo asshuku suru',
      'ps aux to grep de purosesu wo sagashite kill suru',
      'systemctl status nginx de saabisu no joutai wo kakunin'
    ]
  },
  sql: {
    en: [
      'SELECT id, name FROM users WHERE active = true ORDER BY name;',
      'UPDATE orders SET status = "shipped" WHERE id = 42;',
      'INSERT INTO logs (level, message) VALUES ("info", "started");',
      'SELECT count(*) FROM sessions GROUP BY user_id HAVING count(*) > 3;'
    ],
    ja: [
      'SELECT bun de user teeburu kara zenken wo shutoku suru',
      'WHERE ku de jouken wo shitei shite kekka wo shiboru',
      'JOIN wo tsukatte fukusuu no teeburu wo ketsugou suru',
      'INDEX wo tsukuru to kensaku ga hayaku naru'
    ]
  },
  python: {
    en: [
      'def add(a, b): return a + b',
      'nums = [x * 2 for x in range(10) if x % 2 == 0]',
      'with open("data.txt") as f: lines = f.readlines()',
      'result = sorted(items, key=lambda item: item.score, reverse=True)'
    ],
    ja: [
      'def kansuu wo teigi shite hikisuu wo uketoru',
      'list naihou hyouki de list wo kantan ni tsukuru',
      'with bun de fairu wo anzen ni hiraite tojiru',
      'try to except de reigai wo tekisetsu ni shori suru'
    ]
  },
  java: {
    en: [
      'public static void main(String[] args) { System.out.println("hi"); }',
      'List<String> names = new ArrayList<>();',
      'for (int i = 0; i < items.size(); i++) { process(items.get(i)); }',
      'Map<String, Integer> counts = new HashMap<>();'
    ],
    ja: [
      'public class de kurasu wo teigi shite method wo tsukuru',
      'ArrayList wo tsukatte youso wo doutekini kanri suru',
      'for loop de hairetsu no youso wo junban ni shori suru',
      'try catch de reigai wo captyaa shite shori suru'
    ]
  },
  aws: {
    en: [
      'aws s3 cp file.txt s3://my-bucket/backups/',
      'aws ec2 describe-instances --filters "Name=state,Values=running"',
      'aws lambda invoke --function-name process out.json',
      'aws iam attach-role-policy --role-name app --policy-arn arn:aws:iam::policy'
    ],
    ja: [
      'aws s3 cp de fairu wo bucket ni appuroodo suru',
      'ec2 no insutansu wo kidou shite web saabaa wo tateru',
      'lambda kansuu wo tsukatte saabaaresu de shori suru',
      'iam de kengen wo tekisetsu ni settei shite anzen wo mamoru'
    ]
  },
  cisco: {
    en: [
      'enable then configure terminal to enter global config mode',
      'interface GigabitEthernet0/1 then ip address 192.168.1.1',
      'show running-config | include hostname',
      'switchport mode access then switchport access vlan 10'
    ],
    ja: [
      'enable de tokken moodo ni haitte settei wo hajimeru',
      'interface wo erande ip adoresu wo wariateru',
      'show ip route de ruuteingu teeburu wo kakunin suru',
      'vlan wo sakusei shite pooto wo wariateru'
    ]
  }
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

// Trecho do desafio diário: escolhido de forma determinística pela data
// (igual para todos os usuários no mesmo dia).
function getDailySnippet() {
  const flat = [];
  for (const cat of TYPING_CATEGORIES) {
    for (const lang of TYPING_LANGUAGES) {
      (TYPING_SNIPPETS[cat.value][lang.value] || []).forEach((text) => {
        flat.push({ language: lang.value, category: cat.value, text });
      });
    }
  }
  const now = new Date();
  const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  return flat[dayNumber % flat.length];
}

function randomSnippet(language, category) {
  const list = (TYPING_SNIPPETS[category] && TYPING_SNIPPETS[category][language]) || [];
  if (!list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}
