// Página de apresentação (intro): revela os elementos conforme entram na tela
// e reverte quando saem (ou seja, ao rolar de volta pra cima eles somem de novo).

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

// Ao clicar em "entrar", marca a sessão pra o index não redirecionar de volta pra intro
document.querySelectorAll('.intro-enter-btn').forEach((btn) => {
  btn.addEventListener('click', () => sessionStorage.setItem('introSeen', '1'));
});
