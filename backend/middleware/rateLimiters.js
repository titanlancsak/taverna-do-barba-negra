const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { error: 'Too many requests. Please try again later.' }
});

const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests to this tool. Please wait before trying again.' }
});

module.exports = { generalLimiter, heavyLimiter };
