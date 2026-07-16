// Campus Virtual — Fase 1: mundo local, personagem (círculo) andando, câmera seguindo.
// Sem multiplayer ainda. A arte (sprites/tileset) e a rede (Socket.io) entram nas
// próximas fases sem precisar mudar esta base de movimento.

const WORLD_W = 1600;
const WORLD_H = 1200;
const PLAYER_SPEED = 220;

class CampusScene extends Phaser.Scene {
  constructor() {
    super('campus');
  }

  preload() {
    // Gera uma textura de círculo pro personagem (será trocada por sprite depois)
    const size = 32;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x4fc3f7, 1);
    g.fillCircle(size / 2, size / 2, size / 2 - 2);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeCircle(size / 2, size / 2, size / 2 - 2);
    g.generateTexture('player', size, size);
    g.destroy();
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // Gramado + grade (só pra dar noção de movimento nesta fase)
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x3f7a3f);
    this.add.grid(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 64, 64, 0x000000, 0, 0x336633, 0.6);

    // Personagem
    this.player = this.physics.add.image(WORLD_W / 2, WORLD_H / 2, 'player');
    this.player.setCollideWorldBounds(true);

    // Câmera segue o personagem, com um leve amortecimento
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Controles: setas + WASD
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    // Impede que as setas rolem a página
    this.input.keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D']);
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

    // Normaliza pra diagonal não ficar mais rápida (não faz nada se estiver parado)
    body.velocity.normalize().scale(PLAYER_SPEED);
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
