// Campus Virtual — Fase 3: identidade e social.
// Nome real flutuando sobre o personagem, cor diferente por jogador (tint),
// e balões de chat rápido. Continua sobre a base de rede da Fase 2.

const WORLD_W = 4000;
const WORLD_H = 3000;
const PLAYER_SPEED = 220;
const SEND_INTERVAL = 100;  // ms (~10x por segundo)
const BUBBLE_MS = 4000;     // quanto tempo o balão de chat fica visível

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
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // Gramado + grade (a arte de verdade entra na Fase 4)
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x3f7a3f);
    this.add.grid(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 64, 64, 0x000000, 0, 0x336633, 0.6);

    // Meu personagem
    this.player = this.physics.add.image(WORLD_W / 2, WORLD_H / 2, 'dot');
    this.player.setCollideWorldBounds(true);

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Controles: setas + WASD. Só as setas são capturadas (pra não rolar a página);
    // WASD não é capturado pra poder digitar no chat sem problema.
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']);

    this.others = {}; // socketId -> { sprite, label, bubble, bubbleUntil, targetX, targetY }
    this.me = { sprite: this.player, label: this.createLabel(''), bubble: null, bubbleUntil: 0 };
    this.lastSent = { x: Math.round(this.player.x), y: Math.round(this.player.y) };

    this.setupChatInput();
    this.setupNetwork();

    // Envia a posição ~10x/s (só quando muda)
    this.time.addEvent({ delay: SEND_INTERVAL, loop: true, callback: () => this.sendPosition() });
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

    // Enquanto digita, congela o movimento e desliga o teclado do Phaser
    this.chatInput.addEventListener('focus', () => {
      this.chatFocused = true;
      this.input.keyboard.enabled = false;
    });
    this.chatInput.addEventListener('blur', () => {
      this.chatFocused = false;
      this.input.keyboard.enabled = true;
    });
    this.chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation(); // não deixa o Enter re-focar via listener do documento
      if (e.key === 'Enter') {
        const text = this.chatInput.value.trim();
        if (text) {
          campusSocket.emit('campus_chat', { text });
          this.showBubble(this.me, text); // mostra meu próprio balão na hora
        }
        this.chatInput.value = '';
        this.chatInput.blur();
      }
    });

    // Enter fora do input abre o chat
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

    // Minha identidade autoritativa (nome + cor)
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

  update() {
    if (!this.player) return;

    const body = this.player.body;
    body.setVelocity(0);

    // Não anda enquanto está digitando no chat
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

    // Meu nome/balão acompanham meu personagem
    this.updateEntry(this.me);

    // Interpola e atualiza rótulos/balões dos outros
    for (const id in this.others) {
      const e = this.others[id];
      e.sprite.x = Phaser.Math.Linear(e.sprite.x, e.targetX, 0.2);
      e.sprite.y = Phaser.Math.Linear(e.sprite.y, e.targetY, 0.2);
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
