// Linuxラボ — Linux efêmero no navegador via v86 (emulador x86 em WASM).
// Roda 100% no navegador do usuário; nada fica no servidor.
// Requer os arquivos em ../assets/v86/ (veja o README nessa pasta).

const V86Class = window.V86 || window.V86Starter;
const terminalEl = document.getElementById('lab-terminal');
const statusEl = document.getElementById('lab-status');
const restartBtn = document.getElementById('lab-restart');

let emulator = null;

function boot() {
  if (!V86Class) {
    statusEl.textContent = 'v86 が読み込めませんでした（libv86.js が見つかりません）。';
    return;
  }

  statusEl.textContent = '起動中…（初回は少し時間がかかります）';

  try {
    emulator = new V86Class({
      wasm_path: '../assets/v86/v86.wasm',
      memory_size: 128 * 1024 * 1024,
      vga_memory_size: 2 * 1024 * 1024,
      bios: { url: '../assets/v86/seabios.bin' },
      vga_bios: { url: '../assets/v86/vgabios.bin' },
      bzimage: { url: '../assets/v86/buildroot-bzimage.bin' },
      cmdline: 'tsc=reliable mitigations=off random.trust_cpu=on console=ttyS0',
      autostart: true,
      disable_keyboard: false,
      serial_container_xtermjs: terminalEl
    });

    emulator.add_listener('emulator-ready', () => {
      statusEl.textContent = '';
    });
  } catch (err) {
    console.error('[linux-lab] boot error:', err);
    statusEl.textContent = 'Linux環境の起動に失敗しました。';
  }
}

// Reiniciar = recarregar a página (reset total, efêmero)
restartBtn.addEventListener('click', () => {
  window.location.reload();
});

boot();
