const pool = require('../../db/pool');

// Lista as conversas do usuário (uma linha por pessoa com quem já trocou mensagem)
async function getConversations(req, res) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT DISTINCT ON (other_user_id)
        other_user_id,
        CASE WHEN u.is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(u.display_name, u.email) END AS display_name,
        CASE WHEN u.is_anonymous THEN NULL ELSE u.profile_picture_url END AS profile_picture_url,
        last_message,
        last_message_at,
        unread_count
      FROM (
        SELECT
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS other_user_id,
          content AS last_message,
          created_at AS last_message_at,
          (SELECT COUNT(*) FROM messages m2
            WHERE m2.sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
              AND m2.receiver_id = $1 AND m2.read_at IS NULL) AS unread_count
        FROM messages m
        WHERE sender_id = $1 OR receiver_id = $1
        ORDER BY created_at DESC
      ) AS conv
      JOIN users u ON u.id = conv.other_user_id
      ORDER BY other_user_id, last_message_at DESC`,
      [userId]
    );

    res.json({ conversations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
}

// Histórico de mensagens com uma pessoa específica
async function getHistory(req, res) {
  try {
    const userId = req.user.userId;
    const otherUserId = parseInt(req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const limit = 30;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT id, sender_id, receiver_id, content, media_url, media_type, read_at, created_at
       FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, otherUserId, limit, offset]
    );

    // Marca como lidas as mensagens que o outro usuário me enviou
    await pool.query(
      `UPDATE messages SET read_at = NOW()
       WHERE sender_id = $1 AND receiver_id = $2 AND read_at IS NULL`,
      [otherUserId, userId]
    );

    res.json({ messages: result.rows.reverse(), hasMore: result.rows.length === limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load message history' });
  }
}

module.exports = { getConversations, getHistory };
