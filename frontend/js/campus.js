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

    // Árvore com aparência 3D (sombra + tronco + copa com brilho)
    const tw = 52;
    const th = 60;
    const tg = this.make.graphics({ x: 0, y: 0, add: false });
    tg.fillStyle(0x000000, 0.18);
    tg.fillEllipse(tw / 2, th - 4, tw * 0.7, 12);          // sombra no chão
    tg.fillStyle(0x6d4c33, 1);
    tg.fillRect(tw / 2 - 3, th - 18, 6, 16);               // tronco
    tg.fillStyle(0x2f6b34, 1);
    tg.fillCircle(tw / 2, th - 30, 19);                    // copa (base)
    tg.fillStyle(0x3f8b45, 1);
    tg.fillCircle(tw / 2 - 3, th - 33, 14);                // meio-tom
    tg.fillStyle(0x5aa862, 1);
    tg.fillCircle(tw / 2 - 6, th - 37, 8);                 // brilho (topo/esquerda)
    tg.generateTexture('tree', tw, th);
    tg.destroy();

    // Sprites dos prédios (imagens do Piskel)
    if (typeof CAMPUS_BUILDINGS !== 'undefined') {
      CAMPUS_BUILDINGS.forEach(b => this.load.image('bld_' + b.file, '../assets/campus/' + b.file));
    }
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
    this.cols = cols;
    this.worldW = cols * T;
    this.worldH = this.map.length * T;

    // Fundo de gramado
    this.add.rectangle(this.worldW / 2, this.worldH / 2, this.worldW, this.worldH, 0x5c9a4f).setDepth(-1000);

    // Chão plano: caminhos e água (sempre embaixo de tudo)
    const ground = this.add.graphics().setDepth(-900);
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
          ground.fillStyle(0xcdb891, 1);
          ground.fillRect(wx, wy, T, T);
          if (ch === '@') spawn = { x: cx, y: cy };
        } else if (ch === '~') {
          ground.fillStyle(0x5aa0d8, 1);
          ground.fillRect(wx, wy, T, T);
          this.addSolid(cx, cy, T, T);
        }
      }
    }

    // Prédios: junta os '#' conectados numa caixa 3D só (extrusão)
    this.drawBuildings(T);

    // Colisão dos prédios (por tile) + árvores 3D (imagem) com colisão
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < cols; x++) {
        const ch = this.map[y][x];
        const wx = x * T;
        const wy = y * T;
        const cx = wx + T / 2;
        const cy = wy + T / 2;

        if (ch === '#') {
          this.addSolid(cx, cy, T, T);
        } else if (ch === 'T') {
          const baseY = wy + T;
          this.add.image(cx, baseY, 'tree').setOrigin(0.5, 1).setDepth(baseY);
          this.addSolid(cx, cy, T * 0.7, T * 0.7);
        }
      }
    }

    this.spawnPoint = spawn || { x: this.worldW / 2, y: this.worldH / 2 };

    // Nomes dos prédios (sempre visíveis por cima)
    if (typeof CAMPUS_LABELS !== 'undefined') {
      CAMPUS_LABELS.forEach(l => {
        this.add.text(l.x * T + T / 2, l.y * T + T / 2, l.text, {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#00000099',
          padding: { x: 5, y: 3 }
        }).setOrigin(0.5).setDepth(90000);
      });
    }

    // Prédios em sprite (imagens do Piskel), posicionados por CAMPUS_BUILDINGS
    this.placeBuildings();
  }

  // Coloca os prédios (imagens) com colisão, ordenação 2.5D e nome flutuante
  placeBuildings() {
    if (typeof CAMPUS_BUILDINGS === 'undefined') return;
    const BW = 128, BH = 96;
    const gscale = (typeof CAMPUS_BUILDING_SCALE !== 'undefined') ? CAMPUS_BUILDING_SCALE : 1;
    CAMPUS_BUILDINGS.forEach(b => {
      const key = 'bld_' + b.file;
      if (!this.textures.exists(key)) return; // imagem não carregou
      const s = b.scale || gscale;
      const W = BW * s, H = BH * s;
      this.add.image(b.x, b.y, key).setOrigin(0, 0).setScale(s).setDepth(b.y + H);
      if (b.collide !== false) this.addSolid(b.x + W / 2, b.y + H / 2, W, H);
      if (b.name) {
        this.add.text(b.x + W / 2, b.y - 4, b.name, {
          fontFamily: 'sans-serif',
          fontSize: '12px',
          color: '#ffffff',
          backgroundColor: '#00000099',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 1).setDepth(90000);
      }
    });
  }

  // Encontra regiões conectadas de '#' e desenha cada uma como uma caixa 3D
  drawBuildings(T) {
    const rowsN = this.map.length;
    const seen = Array.from({ length: rowsN }, () => new Array(this.cols).fill(false));

    for (let y = 0; y < rowsN; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.map[y][x] !== '#' || seen[y][x]) continue;

        let minX = x, maxX = x, minY = y, maxY = y;
        const stack = [[x, y]];
        seen[y][x] = true;
        while (stack.length) {
          const [cx0, cy0] = stack.pop();
          minX = Math.min(minX, cx0); maxX = Math.max(maxX, cx0);
          minY = Math.min(minY, cy0); maxY = Math.max(maxY, cy0);
          const neigh = [[cx0 + 1, cy0], [cx0 - 1, cy0], [cx0, cy0 + 1], [cx0, cy0 - 1]];
          for (const [nx, ny] of neigh) {
            if (ny >= 0 && ny < rowsN && nx >= 0 && nx < this.cols && !seen[ny][nx] && this.map[ny][nx] === '#') {
              seen[ny][nx] = true;
              stack.push([nx, ny]);
            }
          }
        }

        this.drawBuilding(minX * T, minY * T, (maxX - minX + 1) * T, (maxY - minY + 1) * T);
      }
    }
  }

  // Desenha um prédio como caixa "3D": sombra + parede frontal + telhado + janelas
  drawBuilding(bx, by, bw, bh) {
    const H = 30; // altura aparente
    const g = this.add.graphics();

    g.fillStyle(0x000000, 0.16);
    g.fillRect(bx + 6, by + 6, bw, bh);            // sombra

    g.fillStyle(0x9aa7b4, 1);
    g.fillRect(bx, by - H + bh, bw, H);            // parede frontal (sombreada)

    g.fillStyle(0xdfe6ee, 1);
    g.fillRect(bx, by - H, bw, bh);                // telhado (topo, claro)

    g.lineStyle(1.5, 0x66727f, 1);
    g.strokeRect(bx, by - H, bw, bh);              // contorno do telhado
    g.strokeRect(bx, by - H + bh, bw, H);          // contorno da parede

    g.lineStyle(1, 0x8593a1, 0.7);                 // "janelas" na parede
    for (let wy = by - H + bh + 6; wy < by + bh - 3; wy += 8) {
      g.lineBetween(bx + 3, wy, bx + bw - 3, wy);
    }

    g.setDepth(by + bh); // ordena pela base, pro efeito 2.5D
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
