const express = require('express');
const { getConversations, getHistory } = require('./chatController');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

router.get('/conversations', requireAuth, getConversations);
router.get('/history/:userId', requireAuth, getHistory);

module.exports = router;
