// Página de apresentação (intro): revela os elementos conforme entram na tela
// e reverte quando saem (ou seja, ao rolar de volta pra cima eles somem de novo).

// Traduz o conteúdo ANTES de qualquer fragmentação de texto (wrapChars abaixo
// quebra os títulos em <span> por caractere, o que impediria o i18n de casar).
if (window.__i18n && window.__i18n.apply) window.__i18n.apply();

const revealEls = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
    } else {
      entry.target.classList.remove('in-view'); // reverte ao sair da tela
    }
  });
}, {
  threshold: 0.15,
  rootMargin: '0px 0px -10% 0px'
});

revealEls.forEach((el) => observer.observe(el));

// Ao clicar em "entrar no site", marca a sessão pra o index não redirecionar de volta pra intro
document.querySelectorAll('a[href="index.html"]').forEach((btn) => {
  btn.addEventListener('click', () => sessionStorage.setItem('introSeen', '1'));
});

// ===== Onda de cor por letra nos títulos =====
// Divide em "grafemas" (mantém emojis inteiros como 🏴‍☠️) e envolve cada um num <span>.
function splitGraphemes(str) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(str), (s) => s.segment);
  }
  return Array.from(str);
}

// Aplica o efeito só nos títulos de display (H1, H2 e a citação), pra manter
// o ar editorial sem fragmentar parágrafos longos em spans por letra.
const waveEls = document.querySelectorAll('.ed-h1, .ed-h2, .ed-quote');

// Envolve cada letra num <span>, percorrendo os nós filhos pra preservar <br> etc.
function wrapChars(el) {
  const nodes = Array.from(el.childNodes);
  el.textContent = '';
  let i = 0;
  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      splitGraphemes(node.textContent).forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = ch;
        span.style.animationDelay = (i * 0.05) + 's'; // uma letra por vez
        el.appendChild(span);
        i++;
      });
    } else {
      el.appendChild(node); // mantém <br> e outros elementos
    }
  });
}

waveEls.forEach(wrapChars);

const charObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    // remove e re-adiciona pra a animação tocar de novo a cada vez que entra na tela
    entry.target.classList.remove('chars-in');
    if (entry.isIntersecting) {
      void entry.target.offsetWidth; // força o navegador a reiniciar a animação
      entry.target.classList.add('chars-in');
    }
  });
}, { threshold: 0.25 });

waveEls.forEach((el) => charObserver.observe(el));
