const express = require('express');
const { submitResult, getHistory, getRanking, getDaily, getAchievements } = require('./typingController');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

router.post('/results', requireAuth, submitResult);
router.get('/history', requireAuth, getHistory);
router.get('/ranking', requireAuth, getRanking);
router.get('/daily', requireAuth, getDaily);
router.get('/achievements', requireAuth, getAchievements);

module.exports = router;
