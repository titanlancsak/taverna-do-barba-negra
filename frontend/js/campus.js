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

  // ---- Monta o mundo a partir do layout (campus-map.js) ----
  buildWorld() {
    const W = (typeof CAMPUS_WORLD !== 'undefined') ? CAMPUS_WORLD : { w: 3600, h: 2500 };
    this.worldW = W.w;
    this.worldH = W.h;

    // Fundo de gramado
    this.add.rectangle(W.w / 2, W.h / 2, W.w, W.h, 0x5c9a4f).setDepth(-1000);

    this.solids = this.physics.add.staticGroup();

    // Terreno (caminhos, campos, água, jardim...) — sempre embaixo dos prédios
    const g = this.add.graphics().setDepth(-900);
    if (typeof CAMPUS_TERRAIN !== 'undefined') {
      CAMPUS_TERRAIN.forEach(f => this.drawTerrain(g, f));
    }

    // Prédios (blocos 2.5D com nome e colisão)
    if (typeof CAMPUS_BUILDINGS !== 'undefined') {
      CAMPUS_BUILDINGS.forEach(b => this.drawBuildingBox(b));
    }

    this.spawnPoint = (typeof CAMPUS_SPAWN !== 'undefined')
      ? { x: CAMPUS_SPAWN.x, y: CAMPUS_SPAWN.y }
      : { x: W.w / 2, y: W.h / 2 };
  }

  // Desenha uma feature de terreno de acordo com seu tipo
  drawTerrain(g, f) {
    switch (f.type) {
      case 'zone':
        g.fillStyle(f.color != null ? f.color : 0x4f8f3e, 1);
        g.fillRect(f.x, f.y, f.w, f.h);
        break;

      case 'path':
        g.fillStyle(0xcdb891, 1);
        g.fillRect(f.x, f.y, f.w, f.h);
        break;

      case 'road':
        g.lineStyle(f.width || 60, 0x9a9a9a, 1);
        g.beginPath();
        f.points.forEach((p, i) => (i === 0 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1])));
        g.strokePath();
        break;

      case 'track': {
        const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
        g.fillStyle(0xa9603f, 1); g.fillEllipse(cx, cy, f.w, f.h);              // pista
        g.fillStyle(0x4f9e43, 1); g.fillEllipse(cx, cy, f.w * 0.72, f.h * 0.6); // campo
        g.lineStyle(3, 0xffffff, 0.7); g.strokeEllipse(cx, cy, f.w * 0.86, f.h * 0.78);
        break;
      }

      case 'tennis': {
        g.fillStyle(0x2e7d32, 1); g.fillRect(f.x, f.y, f.w, f.h);
        g.lineStyle(2, 0xffffff, 0.85);
        const cols = f.cols || 3, rows = f.rows || 2;
        for (let i = 0; i <= cols; i++) g.lineBetween(f.x + (f.w / cols) * i, f.y, f.x + (f.w / cols) * i, f.y + f.h);
        for (let j = 0; j <= rows; j++) g.lineBetween(f.x, f.y + (f.h / rows) * j, f.x + f.w, f.y + (f.h / rows) * j);
        break;
      }

      case 'water':
        g.fillStyle(0x5aa0d8, 1);
        if (f.round) g.fillEllipse(f.x + f.w / 2, f.y + f.h / 2, f.w, f.h);
        else g.fillRect(f.x, f.y, f.w, f.h);
        this.addSolid(f.x + f.w / 2, f.y + f.h / 2, f.w * (f.round ? 0.8 : 1), f.h * (f.round ? 0.8 : 1));
        break;

      case 'garden':
        g.fillStyle(0xcdb891, 1); g.fillCircle(f.x, f.y, f.r);        // caminho circular
        g.fillStyle(0x66b34f, 1); g.fillCircle(f.x, f.y, f.r * 0.62); // centro verde
        break;
    }
  }

  // Desenha um prédio como caixa "3D": sombra + parede + telhado + janelas + nome
  drawBuildingBox(b) {
    const H = 34; // altura aparente 2.5D
    const roof = (b.color != null) ? b.color : 0xdfe6ee;
    const wall = this.darken(roof, 0.72);
    const g = this.add.graphics();

    g.fillStyle(0x000000, 0.16);
    g.fillRect(b.x + 7, b.y + 7, b.w, b.h);            // sombra

    g.fillStyle(wall, 1);
    g.fillRect(b.x, b.y - H + b.h, b.w, H);            // parede frontal

    const r = b.round ? Math.min(b.w, b.h) * 0.35 : 0;
    g.fillStyle(roof, 1);
    if (r) g.fillRoundedRect(b.x, b.y - H, b.w, b.h, r);
    else g.fillRect(b.x, b.y - H, b.w, b.h);           // telhado

    g.lineStyle(1.5, 0x66727f, 1);
    if (r) g.strokeRoundedRect(b.x, b.y - H, b.w, b.h, r);
    else g.strokeRect(b.x, b.y - H, b.w, b.h);
    g.strokeRect(b.x, b.y - H + b.h, b.w, H);          // contorno da parede

    g.lineStyle(1, this.darken(wall, 0.85), 0.7);      // "janelas"
    for (let wy = b.y - H + b.h + 6; wy < b.y + b.h - 3; wy += 9) {
      g.lineBetween(b.x + 4, wy, b.x + b.w - 4, wy);
    }

    g.setDepth(b.y + b.h); // ordena pela base (2.5D)
    this.addSolid(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h);

    if (b.name) {
      this.add.text(b.x + b.w / 2, b.y - H - 4, b.name, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 1).setDepth(90000);
    }
  }

  // Escurece uma cor 0xRRGGBB por um fator (0..1)
  darken(c, f) {
    const r = Math.floor(((c >> 16) & 0xff) * f);
    const g = Math.floor(((c >> 8) & 0xff) * f);
    const b = Math.floor((c & 0xff) * f);
    return (r << 16) | (g << 8) | b;
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
    }).setOrigin(0.5, 1).setDepth(100000);
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
      }).setOrigin(0.5, 1).setDepth(100001);
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
    this.player.setDepth(this.player.y); // ordena com o mundo (2.5D)
    this.updateEntry(this.me);

    for (const id in this.others) {
      const e = this.others[id];
      const moving = Math.abs(e.sprite.x - e.targetX) > 0.5 || Math.abs(e.sprite.y - e.targetY) > 0.5;
      e.sprite.x = Phaser.Math.Linear(e.sprite.x, e.targetX, 0.2);
      e.sprite.y = Phaser.Math.Linear(e.sprite.y, e.targetY, 0.2);
      this.applyWalk(e.sprite, moving);
      e.sprite.setDepth(e.sprite.y);
      this.updateEntry(e);
    }
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#2d572d',
  pixelArt: true, // mantém os sprites nítidos ao ampliar (sem borrão)
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
