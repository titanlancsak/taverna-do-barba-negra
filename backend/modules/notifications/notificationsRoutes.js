const express = require('express');
const { getNotifications, markAsRead, markAllAsRead } = require('./notificationsController');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, getNotifications);
router.post('/:notificationId/read', requireAuth, markAsRead);
router.post('/read-all', requireAuth, markAllAsRead);

module.exports = router;
