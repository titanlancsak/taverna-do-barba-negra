const express = require('express');
const { register, verifyEmail, login, getMe, forgotPassword, resetPassword, deleteAccount } = require('./authController');
const { requireAuth } = require('../../middleware/authMiddleware');
const { authLimiter } = require('../../middleware/rateLimiters');

const router = express.Router();

router.post('/register', authLimiter, register);
router.get('/verify-email', verifyEmail);
router.post('/login', authLimiter, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.get('/me', requireAuth, getMe);
router.delete('/account', requireAuth, deleteAccount);

module.exports = router;
