const express = require('express');
const multer = require('multer');
const path = require('path');
const { createPost, getFeed, toggleLike, addComment, getComments, deleteComment, deletePost } = require('./feedController');
const { requireAuth } = require('../../middleware/authMiddleware');
const { heavyLimiter } = require('../../middleware/rateLimiters');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/posts', requireAuth, heavyLimiter, upload.single('media'), createPost);
router.get('/posts', getFeed);
router.post('/posts/:postId/like', requireAuth, toggleLike);
router.post('/posts/:postId/comments', requireAuth, addComment);
router.get('/posts/:postId/comments', getComments);
router.delete('/comments/:commentId', requireAuth, deleteComment);
router.delete('/posts/:postId', requireAuth, deletePost);

module.exports = router;
