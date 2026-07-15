const pool = require('../../db/pool');

async function getNotifications(req, res) {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT n.id, n.type, n.reference_id, n.message, n.read_at, n.created_at, n.actor_id,
              CASE WHEN u.is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(u.display_name, u.email) END AS actor_name
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const unreadCountResult = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadCountResult.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
}

async function markAsRead(req, res) {
  try {
    const userId = req.user.userId;
    const notificationId = parseInt(req.params.notificationId);

    await pool.query(
      'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );

    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
}

async function markAllAsRead(req, res) {
  try {
    const userId = req.user.userId;

    await pool.query(
      'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );

    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
}

module.exports = { getNotifications, markAsRead, markAllAsRead };
