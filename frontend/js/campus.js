// Campus Virtual — Fase 4: polish.
// Mapa montado a partir da grade ASCII (campus-map.js), com colisões reais,
// animação de caminhada (bob) e música ambiente opcional. A rede, os nomes,
// as cores e os balões de chat vêm das fases 2 e 3.

const PLAYER_SPEED = 220;
const SEND_INTERVAL = 100;  // ms (~10x por segundo)
const BUBBLE_MS = 4000;     // tempo que o balão de chat fica visível

const campusToken = localStorage.getItem('taverna_token');
if (!campusToken) {
  window.location.href = 'login.html';
}

const CAMPUS_API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
// Reutiliza a conexão global (a mesma das notificações/chat), sem abrir socket duplicado
const campusSocket = window.__tavernaSocket || io(CAMPUS_API_BASE || window.location.origin, { auth: { token: campusToken } });
window.__tavernaSocket = campusSocket;

class CampusScene extends Phaser.Scene {
  constructor() {
    super('campus');
  }

  preload() {
    // Um único disco branco; a cor de cada jogador é aplicada por tint
    const size = 32;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(size / 2, size / 2, size / 2 - 2);
    g.lineStyle(2, 0x000000, 0.4);
    g.strokeCircle(size / 2, size / 2, size / 2 - 2);
    g.generateTexture('dot', size, size);
    g.destroy();
  }

  create() {
    this.walkT = 0;
    this.buildWorld();

    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    // Meu personagem
    this.player = this.physics.add.image(this.spawnPoint.x, this.spawnPoint.y, 'dot');
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.solids);

    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Controles: setas + WASD. Só as setas são capturadas (pra não rolar a página).
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']);

    this.others = {}; // socketId -> { sprite, label, bubble, bubbleUntil, targetX, targetY }
    this.me = { sprite: this.player, label: this.createLabel(''), bubble: null, bubbleUntil: 0 };
    this.lastSent = { x: Math.round(this.player.x), y: Math.round(this.player.y) };

    this.setupChatInput();
    this.setupNetwork();

    this.time.addEvent({ delay: SEND_INTERVAL, loop: true, callback: () => this.sendPosition() });
  }

  // ---- Monta o mundo a partir da grade ASCII ----
  buildWorld() {
    const rows = CAMPUS_MAP.replace(/^\n+|\n+$/g, '').split('\n');
    const cols = Math.max(...rows.map(r => r.length));
    this.map = rows.map(r => r.padEnd(cols, '.'));
    const T = CAMPUS_TILE;
    this.worldW = cols * T;
    this.worldH = this.map.length * T;

    // Fundo de gramado
    this.add.rectangle(this.worldW / 2, this.worldH / 2, this.worldW, this.worldH, 0x3f7a3f).setDepth(-10);

    const paths = this.add.graphics().setDepth(-9);
    const water = this.add.graphics().setDepth(-9);
    const buildings = this.add.graphics().setDepth(-8);
    const trees = this.add.graphics().setDepth(-7);

    this.solids = this.physics.add.staticGroup();
    let spawn = null;

    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < cols; x++) {
        const ch = this.map[y][x];
        const wx = x * T;
        const wy = y * T;
        const cx = wx + T / 2;
        const cy = wy + T / 2;

        if (ch === 'P' || ch === '@') {
          paths.fillStyle(0xb99a6b, 1);
          paths.fillRect(wx, wy, T, T);
          if (ch === '@') spawn = { x: cx, y: cy };
        } else if (ch === '#') {
          buildings.fillStyle(0x8d8478, 1);
          buildings.fillRect(wx, wy, T, T);
          buildings.lineStyle(1, 0x5b544a, 1);
          buildings.strokeRect(wx, wy, T, T);
          this.addSolid(cx, cy, T, T);
        } else if (ch === 'T') {
          trees.fillStyle(0x5d4037, 1);
          trees.fillRect(cx - 4, cy, 8, T / 2);       // tronco
          trees.fillStyle(0x2e7d32, 1);
          trees.fillCircle(cx, cy - 4, T * 0.42);      // copa
          this.addSolid(cx, cy, T * 0.7, T * 0.7);
        } else if (ch === '~') {
          water.fillStyle(0x4a90d9, 1);
          water.fillRect(wx, wy, T, T);
          this.addSolid(cx, cy, T, T);
        }
        // '.' = gramado (já coberto pelo fundo)
      }
    }

    this.spawnPoint = spawn || { x: this.worldW / 2, y: this.worldH / 2 };

    // Nomes dos prédios
    if (typeof CAMPUS_LABELS !== 'undefined') {
      CAMPUS_LABELS.forEach(l => {
        this.add.text(l.x * T + T / 2, l.y * T + T / 2, l.text, {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#00000099',
          padding: { x: 5, y: 3 }
        }).setOrigin(0.5).setDepth(5);
      });
    }
  }

  addSolid(cx, cy, w, h) {
    const zone = this.add.zone(cx, cy, w, h);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
  }

  createLabel(name) {
    return this.add.text(0, 0, name, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(10);
  }

  setupChatInput() {
    this.chatInput = document.getElementById('campus-chat-input');
    this.chatFocused = false;
    if (!this.chatInput) return;

    this.chatInput.addEventListener('focus', () => {
      this.chatFocused = true;
      this.input.keyboard.enabled = false;
    });
    this.chatInput.addEventListener('blur', () => {
      this.chatFocused = false;
      this.input.keyboard.enabled = true;
    });
    this.chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = this.chatInput.value.trim();
        if (text) {
          campusSocket.emit('campus_chat', { text });
          this.showBubble(this.me, text);
        }
        this.chatInput.value = '';
        this.chatInput.blur();
      }
    });

    this.onDocKeydown = (e) => {
      if (e.key === 'Enter' && document.activeElement !== this.chatInput) {
        this.chatInput.focus();
      }
    };
    document.addEventListener('keydown', this.onDocKeydown);
    this.events.once('shutdown', () => document.removeEventListener('keydown', this.onDocKeydown));
  }

  setupNetwork() {
    const join = () => campusSocket.emit('campus_join', {
      x: Math.round(this.player.x),
      y: Math.round(this.player.y)
    });

    if (campusSocket.connected) join();
    campusSocket.on('connect', join);
    campusSocket.on('connect_error', (err) => console.error('[campus] connect_error:', err.message));

    campusSocket.on('campus_me', (info) => {
      this.myId = info.id;
      this.player.setTint(info.color);
      this.me.label.setText(info.name || '');
    });

    campusSocket.on('campus_players', (players) => {
      players.forEach(p => this.addOther(p.id, p.x, p.y, p.name, p.color));
    });
    campusSocket.on('campus_player_joined', (p) => this.addOther(p.id, p.x, p.y, p.name, p.color));
    campusSocket.on('campus_player_moved', (p) => {
      const e = this.others[p.id];
      if (e) {
        e.targetX = p.x;
        e.targetY = p.y;
      } else {
        this.addOther(p.id, p.x, p.y);
      }
    });
    campusSocket.on('campus_player_left', (p) => this.removeOther(p.id));
    campusSocket.on('campus_chat', (m) => {
      const e = this.others[m.id];
      if (e) this.showBubble(e, m.text);
    });

    window.addEventListener('beforeunload', () => campusSocket.emit('campus_leave'));
  }

  addOther(id, x, y, name, color) {
    if (this.others[id]) return;
    const sprite = this.add.image(x, y, 'dot');
    if (color != null) sprite.setTint(color);
    this.others[id] = {
      sprite,
      label: this.createLabel(name || ''),
      bubble: null,
      bubbleUntil: 0,
      targetX: x,
      targetY: y
    };
  }

  removeOther(id) {
    const e = this.others[id];
    if (!e) return;
    e.sprite.destroy();
    e.label.destroy();
    if (e.bubble) e.bubble.destroy();
    delete this.others[id];
  }

  showBubble(entry, text) {
    if (!entry || !text) return;
    if (!entry.bubble) {
      entry.bubble = this.add.text(0, 0, '', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#1b1b1b',
        backgroundColor: '#ffffffee',
        padding: { x: 6, y: 4 },
        align: 'center',
        wordWrap: { width: 180 }
      }).setOrigin(0.5, 1).setDepth(20);
    }
    entry.bubble.setText(text).setVisible(true);
    entry.bubbleUntil = this.time.now + BUBBLE_MS;
  }

  applyWalk(sprite, moving) {
    if (moving) {
      const s = Math.sin(this.walkT) * 0.08;
      sprite.scaleX = 1 + s;
      sprite.scaleY = 1 - s;
    } else {
      sprite.scaleX = 1;
      sprite.scaleY = 1;
    }
  }

  updateEntry(e) {
    const s = e.sprite;
    e.label.setPosition(s.x, s.y - 22);
    if (e.bubble) {
      e.bubble.setPosition(s.x, s.y - 40);
      if (e.bubbleUntil && this.time.now > e.bubbleUntil) e.bubble.setVisible(false);
    }
  }

  sendPosition() {
    if (!this.player) return;
    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);
    if (x !== this.lastSent.x || y !== this.lastSent.y) {
      this.lastSent = { x, y };
      campusSocket.emit('campus_move', { x, y });
    }
  }

  update(time, delta) {
    if (!this.player) return;

    const body = this.player.body;
    body.setVelocity(0);

    if (!this.chatFocused) {
      const left = this.cursors.left.isDown || this.wasd.A.isDown;
      const right = this.cursors.right.isDown || this.wasd.D.isDown;
      const up = this.cursors.up.isDown || this.wasd.W.isDown;
      const down = this.cursors.down.isDown || this.wasd.S.isDown;

      if (left) body.setVelocityX(-PLAYER_SPEED);
      else if (right) body.setVelocityX(PLAYER_SPEED);

      if (up) body.setVelocityY(-PLAYER_SPEED);
      else if (down) body.setVelocityY(PLAYER_SPEED);

      body.velocity.normalize().scale(PLAYER_SPEED);
    }

    // Animação de caminhada (bob) — baseada no movimento
    this.walkT += delta * 0.015;
    this.applyWalk(this.player, body.velocity.lengthSq() > 1);
    this.updateEntry(this.me);

    for (const id in this.others) {
      const e = this.others[id];
      const moving = Math.abs(e.sprite.x - e.targetX) > 0.5 || Math.abs(e.sprite.y - e.targetY) > 0.5;
      e.sprite.x = Phaser.Math.Linear(e.sprite.x, e.targetX, 0.2);
      e.sprite.y = Phaser.Math.Linear(e.sprite.y, e.targetY, 0.2);
      this.applyWalk(e.sprite, moving);
      this.updateEntry(e);
    }
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#2d572d',
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: CampusScene
};

new Phaser.Game(config);

// Música ambiente (opcional) — começa no 1º clique (navegadores bloqueiam autoplay)
(function setupMusic() {
  const btn = document.getElementById('campus-music-btn');
  if (!btn) return;

  const audio = new Audio();
  audio.loop = true;
  audio.volume = 0.4;
  let loaded = false;

  btn.addEventListener('click', async () => {
    try {
      if (!loaded) {
        const res = await fetch(`${CAMPUS_API_BASE}/api/music/list`);
        const tracks = await res.json();
        if (!tracks.length) {
          btn.textContent = '🚫';
          return;
        }
        audio.src = `../assets/music/${tracks[0].file}`;
        loaded = true;
      }
      if (audio.paused) {
        await audio.play();
        btn.textContent = '🔊';
      } else {
        audio.pause();
        btn.textContent = '🎵';
      }
    } catch (err) {
      console.error('[campus] music error:', err);
    }
  });
})();
