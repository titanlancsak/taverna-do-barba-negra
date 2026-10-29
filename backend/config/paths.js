const path = require('path');
const fs = require('fs');

// Raiz onde a mídia enviada por usuários é gravada.
// - Local / VM: dentro de frontend/assets (comportamento histórico, inalterado).
// - Em container (ECS Fargate): aponta para o volume EFS montado, via env MEDIA_ROOT,
//   de modo que os uploads sobrevivam a deploys e sejam compartilhados entre instâncias.
const MEDIA_ROOT =
  process.env.MEDIA_ROOT || path.join(__dirname, '..', '..', 'frontend', 'assets');

// Subdiretórios de mídia persistente (precisam sobreviver a deploys / troca de container).
const MEDIA_SUBDIRS = ['profile-pictures', 'chat-media', 'feed-media', 'event-media'];

function mediaDir(sub) {
  return path.join(MEDIA_ROOT, sub);
}

// Garante que os diretórios de mídia existam. Um volume EFS novo começa vazio,
// e o sharp/ffmpeg falham ao gravar se o diretório de destino não existir.
function ensureMediaDirs() {
  for (const sub of MEDIA_SUBDIRS) {
    fs.mkdirSync(mediaDir(sub), { recursive: true });
  }
}

module.exports = { MEDIA_ROOT, MEDIA_SUBDIRS, mediaDir, ensureMediaDirs };
