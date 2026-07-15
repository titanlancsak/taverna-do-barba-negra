const express = require('express');
const {
  createGroup, listMyGroups, getGroupMembers, inviteMember, leaveGroup, getGroupHistory
} = require('./groupsController');
const { requireAuth } = require('../../middleware/authMiddleware');
const { postLimiter } = require('../../middleware/rateLimiters');

const router = express.Router();

router.post('/', requireAuth, postLimiter, createGroup);
router.get('/', requireAuth, listMyGroups);
router.get('/:groupId/members', requireAuth, getGroupMembers);
router.post('/:groupId/invite', requireAuth, inviteMember);
router.delete('/:groupId/leave', requireAuth, leaveGroup);
router.get('/:groupId/messages', requireAuth, getGroupHistory);

module.exports = router;
