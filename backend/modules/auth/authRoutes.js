const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, verifyEmail, login, getMe } = require('./authController');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again later.' }
});

router.post('/register', authLimiter, register);
router.get('/verify-email', verifyEmail);
router.post('/login', authLimiter, login);
router.get('/me', requireAuth, getMe);

module.exports = router;
