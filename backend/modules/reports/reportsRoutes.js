const express = require('express');
const { createReport, listReports, resolveReport, dismissReport } = require('./reportsController');
const { requireAuth, requireAdmin } = require('../../middleware/authMiddleware');

const router = express.Router();

// Denunciar (qualquer usuário logado)
router.post('/', requireAuth, createReport);

// Moderação (só admin)
router.get('/', requireAuth, requireAdmin, listReports);
router.post('/:id/resolve', requireAuth, requireAdmin, resolveReport);
router.post('/:id/dismiss', requireAuth, requireAdmin, dismissReport);

module.exports = router;
