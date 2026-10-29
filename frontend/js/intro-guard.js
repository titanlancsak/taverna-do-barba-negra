// Sem conta: mostra a intro a cada nova sessão. Logado: vai direto pro site.
// Externalizado do index.html para permitir um CSP estrito (script-src 'self').
// Precisa rodar de forma síncrona no <head>, antes do body renderizar, pra evitar flash.
(function () {
  var token = localStorage.getItem('taverna_token');
  if (!token && !sessionStorage.getItem('introSeen')) {
    window.location.replace('intro.html');
  }
})();
