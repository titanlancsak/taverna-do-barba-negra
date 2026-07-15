const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  createEvent, listEvents, attendEvent, cancelAttendance, deleteEvent
} = require('./eventsController');
const { requireAuth } = require('../../middleware/authMiddleware');
const { heavyLimiter } = require('../../middleware/rateLimiters');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads'),
  limits: { fileSize: 20 * 1024 * 1024 }
});

router.post('/', requireAuth, heavyLimiter, upload.single('photo'), createEvent);
router.get('/', requireAuth, listEvents);
router.post('/:eventId/attend', requireAuth, attendEvent);
router.delete('/:eventId/attend', requireAuth, cancelAttendance);
router.delete('/:eventId', requireAuth, deleteEvent);

module.exports = router;
