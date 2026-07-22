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

Onde baixar:
  1) libv86.js e v86.wasm
     -> Releases do v86: https://github.com/copy/v86/releases
        (baixe o pacote da release; os arquivos ficam em build/)

  2) seabios.bin e vgabios.bin  (pasta bios/ do v86)
     https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin
     https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin

  3) linux.iso  (imagem oficial usada no exemplo do v86, repo copy/images)
     https://raw.githubusercontent.com/copy/images/master/linux.iso
     (alternativa, se existir: https://k.copy.sh/linux.iso)

Exemplo na VM:
  cd /var/www/taverna-do-barba-negra/frontend/assets/v86/
  curl -L -o seabios.bin https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin
  curl -L -o vgabios.bin https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin
  curl -L -o linux.iso   https://raw.githubusercontent.com/copy/images/master/linux.iso
  # e coloque libv86.js e v86.wasm (do release do v86)

Depois de colocar os 5 arquivos, a página /pages/linux-lab.html funciona.
Se a tela ficar preta, abra o Console (F12) e veja se algum arquivo deu 404.
