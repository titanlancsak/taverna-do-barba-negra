const rateLimit = require('express-rate-limit');

// Limite geral, aplicado globalmente — só pega uso realmente abusivo
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests. Please try again later.' }
});

// Rotas pesadas de verdade: conversão de arquivo, download de vídeo
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests to this tool. Please wait before trying again.' }
});

// Criação de posts (mais generoso que heavyLimiter, mais restrito que uso geral)
const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'You are posting too fast. Please wait a bit before posting again.' }
});

// Login/registro — proteção contra força bruta
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again later.' }
});

module.exports = { generalLimiter, heavyLimiter, postLimiter, authLimiter };
