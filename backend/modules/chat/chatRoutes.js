const express = require('express');
const multer = require('multer');
const path = require('path');
const { getConversations, getHistory, uploadMedia } = require('./chatController');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads'),
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.get('/conversations', requireAuth, getConversations);
router.get('/history/:userId', requireAuth, getHistory);
router.post('/media', requireAuth, upload.single('media'), uploadMedia);

module.exports = router;
