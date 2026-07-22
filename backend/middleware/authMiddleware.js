const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { isAdminEmail } = require('../config/admins');
require('dotenv').config();

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, email }

    // Bloqueia usuários banidos (mesmo com token ainda válido)
    const result = await pool.query('SELECT is_banned FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (result.rows[0].is_banned) {
      return res.status(403).json({ error: 'このアカウントは停止されています', banned: true });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Exige que o usuário autenticado seja admin
function requireAdmin(req, res, next) {
  if (!isAdminEmail(req.user && req.user.email)) {
    return res.status(403).json({ error: '権限がありません' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
