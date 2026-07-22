Linuxラボ (v86) — arquivos necessários nesta pasta
===================================================

Estes binários NÃO vão pro git (são grandes). Baixe e coloque aqui,
tanto no seu PC (pra testar local) quanto na VM
(em /var/www/taverna-do-barba-negra/frontend/assets/v86/).

Arquivos (5):
  - libv86.js     (loader do v86)
  - v86.wasm      (emulador em WebAssembly)
  - seabios.bin   (BIOS)
  - vgabios.bin   (VGA BIOS)
  - linux.iso     (imagem do Linux que dá boot num shell)

Comandos pra baixar tudo (URLs testadas, retornam 200):
  cd /var/www/taverna-do-barba-negra/frontend/assets/v86/
  curl -L -o libv86.js   https://cdn.jsdelivr.net/npm/v86/build/libv86.js
  curl -L -o v86.wasm    https://cdn.jsdelivr.net/npm/v86/build/v86.wasm
  curl -L -o seabios.bin https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin
  curl -L -o vgabios.bin https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin
  curl -L -o linux.iso   https://raw.githubusercontent.com/copy/images/master/linux.iso

Confira os tamanhos (ls -lh): libv86.js ~350KB, v86.wasm ~2MB,
seabios.bin ~128KB, vgabios.bin ~36KB, linux.iso ~5.6MB.

Depois a página /pages/linux-lab.html funciona.
Se a tela ficar preta, abra o Console (F12) e veja se:
  - algum arquivo deu 404 (faltou baixar), ou
  - o v86.wasm veio com MIME errado (o Nginx precisa servir .wasm como
    application/wasm; normalmente já vem no mime.types).
