const express = require('express');
const { listUsers, banUser, unbanUser } = require('./adminController');
const { requireAuth, requireAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

router.get('/users', requireAuth, requireAdmin, listUsers);
router.post('/users/:id/ban', requireAuth, requireAdmin, banUser);
router.post('/users/:id/unban', requireAuth, requireAdmin, unbanUser);

module.exports = router;
