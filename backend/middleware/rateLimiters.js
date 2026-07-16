const rateLimit = require('express-rate-limit');

// Limite geral, aplicado globalmente — só pega uso realmente abusivo
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'リクエストが多すぎます。しばらくしてからもう一度お試しください。' }
});

// Rotas pesadas de verdade: conversão de arquivo, download de vídeo
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'このツールへのリクエストが多すぎます。少し待ってからもう一度お試しください。' }
});

// Criação de posts (mais generoso que heavyLimiter, mais restrito que uso geral)
const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: '投稿が速すぎます。少し待ってからもう一度投稿してください。' }
});

// Login/registro — proteção contra força bruta
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '試行回数が多すぎます。しばらくしてからもう一度お試しください。' }
});

module.exports = { generalLimiter, heavyLimiter, postLimiter, authLimiter };
