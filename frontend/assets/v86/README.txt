Linuxラボ (v86) — arquivos necessários nesta pasta
===================================================

Estes binários NÃO vão pro git (são grandes). Baixe e coloque aqui,
tanto no seu PC (pra testar local) quanto na VM (em /var/www/.../frontend/assets/v86/).

Arquivos:
  - libv86.js                (o loader do v86)
  - v86.wasm                 (o emulador em WebAssembly)
  - seabios.bin              (BIOS)
  - vgabios.bin              (VGA BIOS)
  - buildroot-bzimage.bin    (imagem do Linux que dá boot num shell)

Onde baixar:
  1) libv86.js, v86.wasm, seabios.bin, vgabios.bin
     -> Projeto v86 (BSD): https://github.com/copy/v86
        Baixe uma "release" (ou clone e use a pasta build/ + bios/).
        Ex.: build/libv86.js, build/v86.wasm, bios/seabios.bin, bios/vgabios.bin

  2) buildroot-bzimage.bin (Linux pequeno que boota num shell)
     -> https://k.copy.sh/buildroot-bzimage.bin
        (imagens oficiais do v86; pesa poucos MB)

Depois de colocar os 5 arquivos aqui, a página /pages/linux-lab.html funciona.

Dica de deploy na VM:
  cd /var/www/taverna-do-barba-negra/frontend/assets/v86/
  curl -LO https://k.copy.sh/buildroot-bzimage.bin
  # e coloque libv86.js, v86.wasm, seabios.bin, vgabios.bin (do release do v86)
