const express = require('express');
const multer = require('multer');
const path = require('path');
const { updateProfile, uploadProfilePicture, deleteProfilePicture } = require('./profileController');
const { requireAuth } = require('../../middleware/authMiddleware');
const { heavyLimiter } = require('../../middleware/rateLimiters');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads'),
  limits: { fileSize: 8 * 1024 * 1024 } // 8MB max para fotos de perfil
});

router.put('/', requireAuth, updateProfile);
router.post('/picture', requireAuth, heavyLimiter, upload.single('picture'), uploadProfilePicture);
router.delete('/picture', requireAuth, deleteProfilePicture);

module.exports = router;
