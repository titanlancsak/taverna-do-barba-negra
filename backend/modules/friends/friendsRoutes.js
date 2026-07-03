const express = require('express');
const {
  sendRequest, respondRequest, removeFriend, listFriends, listPendingRequests
} = require('./friendsController');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

router.post('/request/:userId', requireAuth, sendRequest);
router.post('/respond/:friendshipId', requireAuth, respondRequest);
router.delete('/:userId', requireAuth, removeFriend);
router.get('/', requireAuth, listFriends);
router.get('/pending', requireAuth, listPendingRequests);

module.exports = router;
