const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, verifyEmail, login, getMe } = require('./authController');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '試行回数が多すぎます。しばらくしてからもう一度お試しください。' }
});

router.post('/register', authLimiter, register);
router.get('/verify-email', verifyEmail);
router.post('/login', authLimiter, login);
router.get('/me', requireAuth, getMe);

module.exports = router;
