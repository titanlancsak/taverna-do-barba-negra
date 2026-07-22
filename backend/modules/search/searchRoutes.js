const express = require('express');
const { search } = require('./searchController');
const { requireAuth } = require('../../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, search);

module.exports = router;
