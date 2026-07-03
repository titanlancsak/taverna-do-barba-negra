const pool = require('../../db/pool');

async function sendRequestByEmail(req, res) {
  try {
    const requesterId = req.user.userId;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with that email' });
    }

    const addresseeId = userResult.rows[0].id;

    if (requesterId === addresseeId) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    const existing = await pool.query(
      `SELECT id, status FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [requesterId, addresseeId]
    );

    if (existing.rows.length > 0) {
      const rel = existing.rows[0];
      if (rel.status === 'accepted') {
        return res.status(409).json({ error: 'You are already friends' });
      }
      if (rel.status === 'pending') {
        return res.status(409).json({ error: 'A friend request is already pending' });
      }
      await pool.query('DELETE FROM friendships WHERE id = $1', [rel.id]);
    }

    await pool.query(
      'INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, $3)',
      [requesterId, addresseeId, 'pending']
    );

    res.status(201).json({ message: 'Friend request sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
}

async function sendRequest(req, res) {
  try {
    const requesterId = req.user.userId;
    const addresseeId = parseInt(req.params.userId);

    if (requesterId === addresseeId) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [addresseeId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verifica se já existe alguma relação entre os dois (em qualquer direção)
    const existing = await pool.query(
      `SELECT id, status, requester_id FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [requesterId, addresseeId]
    );

    if (existing.rows.length > 0) {
      const rel = existing.rows[0];
      if (rel.status === 'accepted') {
        return res.status(409).json({ error: 'You are already friends' });
      }
      if (rel.status === 'pending') {
        return res.status(409).json({ error: 'A friend request is already pending' });
      }
      // Se foi 'declined' antes, permite reenviar removendo o registro antigo
      await pool.query('DELETE FROM friendships WHERE id = $1', [rel.id]);
    }

    await pool.query(
      'INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, $3)',
      [requesterId, addresseeId, 'pending']
    );

    res.status(201).json({ message: 'Friend request sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
}

async function respondRequest(req, res) {
  try {
    const userId = req.user.userId;
    const friendshipId = parseInt(req.params.friendshipId);
    const { action } = req.body; // 'accept' ou 'decline'

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const result = await pool.query('SELECT * FROM friendships WHERE id = $1', [friendshipId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const friendship = result.rows[0];

    if (friendship.addressee_id !== userId) {
      return res.status(403).json({ error: 'You can only respond to requests sent to you' });
    }

    if (friendship.status !== 'pending') {
      return res.status(409).json({ error: 'This request has already been responded to' });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    await pool.query(
      'UPDATE friendships SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, friendshipId]
    );

    res.json({ message: `Friend request ${newStatus}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to respond to friend request' });
  }
}

async function removeFriend(req, res) {
  try {
    const userId = req.user.userId;
    const otherUserId = parseInt(req.params.userId);

    const result = await pool.query(
      `DELETE FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
       RETURNING id`,
      [userId, otherUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    res.json({ message: 'Friend removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
}

async function listFriends(req, res) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT
        u.id,
        CASE WHEN u.is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(u.display_name, u.email) END AS display_name,
        CASE WHEN u.is_anonymous THEN NULL ELSE u.profile_picture_url END AS profile_picture_url,
        u.course
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
      WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)`,
      [userId]
    );

    res.json({ friends: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load friends' });
  }
}

async function listPendingRequests(req, res) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT
        f.id AS friendship_id,
        u.id AS requester_id,
        CASE WHEN u.is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(u.display_name, u.email) END AS display_name,
        CASE WHEN u.is_anonymous THEN NULL ELSE u.profile_picture_url END AS profile_picture_url,
        f.created_at
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load pending requests' });
  }
}

module.exports = { sendRequest, sendRequestByEmail, respondRequest, removeFriend, listFriends, listPendingRequests };
