// Campus Virtual — Fase 2: multiplayer via Socket.io.
// Ao entrar, você entra na "sala do campus"; sua posição é enviada ~10x/s;
// outros jogadores aparecem, se movem em tempo real e somem ao desconectar.
// A arte (sprites/tileset) e a identidade (nomes/cores) entram nas próximas fases.

const WORLD_W = 4000;
const WORLD_H = 3000;
const PLAYER_SPEED = 220;
const SEND_INTERVAL = 100; // ms (~10x por segundo)

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
    this.makeCircleTexture('player', 0x4fc3f7); // eu (azul)
    this.makeCircleTexture('other', 0xff9800);  // outros (laranja) — cores por jogador vêm na Fase 3
  }

  makeCircleTexture(key, color) {
    const size = 32;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 1);
    g.fillCircle(size / 2, size / 2, size / 2 - 2);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeCircle(size / 2, size / 2, size / 2 - 2);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // Gramado + grade (só pra dar noção de movimento nesta fase)
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x3f7a3f);
    this.add.grid(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 64, 64, 0x000000, 0, 0x336633, 0.6);

    // Meu personagem
    this.player = this.physics.add.image(WORLD_W / 2, WORLD_H / 2, 'player');
    this.player.setCollideWorldBounds(true);

    // Câmera segue o personagem
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Controles: setas + WASD
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.input.keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D']);

    this.others = {}; // socketId -> sprite (com targetX/targetY pra interpolar)
    this.lastSent = { x: Math.round(this.player.x), y: Math.round(this.player.y) };

    // HUD de diagnóstico (fixo na tela) — mostra conexão e nº de outros jogadores
    this.hud = this.add.text(10, 10, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 5 }
    }).setScrollFactor(0).setDepth(1000);

    this.setupNetwork();

    // Envia a posição ~10x/s (só quando muda)
    this.time.addEvent({ delay: SEND_INTERVAL, loop: true, callback: () => this.sendPosition() });
  }

  setupNetwork() {
    const join = () => campusSocket.emit('campus_join', {
      x: Math.round(this.player.x),
      y: Math.round(this.player.y)
    });

    // Entra na sala agora (se já conectado) e também a cada reconexão
    console.log('[campus] socket conectado?', campusSocket.connected, 'id:', campusSocket.id);
    if (campusSocket.connected) join();
    campusSocket.on('connect', () => {
      console.log('[campus] connect -> join', campusSocket.id);
      join();
    });
    campusSocket.on('connect_error', (err) => console.error('[campus] connect_error:', err.message));

    campusSocket.on('campus_players', (players) => {
      console.log('[campus] campus_players:', players);
      players.forEach(p => this.addOther(p.id, p.x, p.y));
    });
    campusSocket.on('campus_player_joined', (p) => {
      console.log('[campus] player_joined:', p);
      this.addOther(p.id, p.x, p.y);
    });
    campusSocket.on('campus_player_moved', (p) => {
      const s = this.others[p.id];
      if (s) {
        s.targetX = p.x;
        s.targetY = p.y;
      } else {
        this.addOther(p.id, p.x, p.y);
      }
    });
    campusSocket.on('campus_player_left', (p) => {
      console.log('[campus] player_left:', p);
      this.removeOther(p.id);
    });

    // Ao sair da página, avisa que deixei o campus (o disconnect também cobre isso)
    window.addEventListener('beforeunload', () => campusSocket.emit('campus_leave'));
  }

  addOther(id, x, y) {
    if (this.others[id]) return;
    const s = this.add.image(x, y, 'other');
    s.targetX = x;
    s.targetY = y;
    this.others[id] = s;
  }

  removeOther(id) {
    const s = this.others[id];
    if (s) {
      s.destroy();
      delete this.others[id];
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

    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    if (left) body.setVelocityX(-PLAYER_SPEED);
    else if (right) body.setVelocityX(PLAYER_SPEED);

    if (up) body.setVelocityY(-PLAYER_SPEED);
    else if (down) body.setVelocityY(PLAYER_SPEED);

    body.velocity.normalize().scale(PLAYER_SPEED);

    // Interpola a posição dos outros jogadores pra suavizar entre os updates da rede
    for (const id in this.others) {
      const s = this.others[id];
      s.x = Phaser.Math.Linear(s.x, s.targetX, 0.2);
      s.y = Phaser.Math.Linear(s.y, s.targetY, 0.2);
    }

    if (this.hud) {
      const conn = campusSocket.connected ? 'OK' : '未接続';
      this.hud.setText(`接続: ${conn}  他のプレイヤー: ${Object.keys(this.others).length}`);
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
