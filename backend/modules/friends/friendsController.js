const pool = require('../../db/pool');

async function sendRequestByEmail(req, res) {
  try {
    const requesterId = req.user.userId;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'メールアドレスは必須です' });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'そのメールアドレスのユーザーが見つかりません' });
    }

    const addresseeId = userResult.rows[0].id;

    if (requesterId === addresseeId) {
      return res.status(400).json({ error: '自分自身をフレンドに追加することはできません' });
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
        return res.status(409).json({ error: 'すでにフレンドです' });
      }
      if (rel.status === 'pending') {
        return res.status(409).json({ error: 'フレンドリクエストはすでに保留中です' });
      }
      await pool.query('DELETE FROM friendships WHERE id = $1', [rel.id]);
    }

    await pool.query(
      'INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, $3)',
      [requesterId, addresseeId, 'pending']
    );

    const { createNotification } = require('../notifications/notificationService');
    const actorName = await pool.query(
      `SELECT CASE WHEN is_anonymous THEN '匿名の海賊' ELSE COALESCE(display_name, email) END AS name FROM users WHERE id = $1`,
      [requesterId]
    );
    await createNotification(req.app.get('io'), req.app.get('onlineUsers'), {
      userId: addresseeId,
      actorId: requesterId,
      type: 'friend_request',
      referenceId: null,
      message: `${actorName.rows[0].name}さんからフレンドリクエストが届きました`
    });

    res.status(201).json({ message: 'フレンドリクエストを送信しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'フレンドリクエストの送信に失敗しました' });
  }
}

async function sendRequest(req, res) {
  try {
    const requesterId = req.user.userId;
    const addresseeId = parseInt(req.params.userId);

    if (requesterId === addresseeId) {
      return res.status(400).json({ error: '自分自身をフレンドに追加することはできません' });
    }

    const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [addresseeId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    const existing = await pool.query(
      `SELECT id, status, requester_id FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [requesterId, addresseeId]
    );

    if (existing.rows.length > 0) {
      const rel = existing.rows[0];
      if (rel.status === 'accepted') {
        return res.status(409).json({ error: 'すでにフレンドです' });
      }
      if (rel.status === 'pending') {
        return res.status(409).json({ error: 'フレンドリクエストはすでに保留中です' });
      }
      await pool.query('DELETE FROM friendships WHERE id = $1', [rel.id]);
    }

    await pool.query(
      'INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, $3)',
      [requesterId, addresseeId, 'pending']
    );

    const { createNotification } = require('../notifications/notificationService');
    const actorName = await pool.query(
      `SELECT CASE WHEN is_anonymous THEN '匿名の海賊' ELSE COALESCE(display_name, email) END AS name FROM users WHERE id = $1`,
      [requesterId]
    );
    await createNotification(req.app.get('io'), req.app.get('onlineUsers'), {
      userId: addresseeId,
      actorId: requesterId,
      type: 'friend_request',
      referenceId: null,
      message: `${actorName.rows[0].name}さんからフレンドリクエストが届きました`
    });

    res.status(201).json({ message: 'フレンドリクエストを送信しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'フレンドリクエストの送信に失敗しました' });
  }
}

async function respondRequest(req, res) {
  try {
    const userId = req.user.userId;
    const friendshipId = parseInt(req.params.friendshipId);
    const { action } = req.body;

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: '無効な操作です' });
    }

    const result = await pool.query('SELECT * FROM friendships WHERE id = $1', [friendshipId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'フレンドリクエストが見つかりません' });
    }

    const friendship = result.rows[0];

    if (friendship.addressee_id !== userId) {
      return res.status(403).json({ error: '自分宛てのリクエストにのみ応答できます' });
    }

    if (friendship.status !== 'pending') {
      return res.status(409).json({ error: 'このリクエストにはすでに応答済みです' });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    await pool.query(
      'UPDATE friendships SET status = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, friendshipId]
    );

    if (newStatus === 'accepted') {
      const { createNotification } = require('../notifications/notificationService');
      const actorName = await pool.query(
        `SELECT CASE WHEN is_anonymous THEN '匿名の海賊' ELSE COALESCE(display_name, email) END AS name FROM users WHERE id = $1`,
        [userId]
      );
      await createNotification(req.app.get('io'), req.app.get('onlineUsers'), {
        userId: friendship.requester_id,
        actorId: userId,
        type: 'friend_accept',
        referenceId: null,
        message: `${actorName.rows[0].name}さんがフレンドリクエストを承認しました`
      });
    }

    res.json({ message: `フレンドリクエストに応答しました` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'フレンドリクエストへの応答に失敗しました' });
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
      return res.status(404).json({ error: 'フレンド関係が見つかりません' });
    }

    res.json({ message: 'フレンドを削除しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'フレンドの削除に失敗しました' });
  }
}

async function listFriends(req, res) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT
        u.id,
        CASE WHEN u.is_anonymous THEN '匿名の海賊' ELSE COALESCE(u.display_name, u.email) END AS display_name,
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
    res.status(500).json({ error: 'フレンドの読み込みに失敗しました' });
  }
}

async function listPendingRequests(req, res) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT
        f.id AS friendship_id,
        u.id AS requester_id,
        CASE WHEN u.is_anonymous THEN '匿名の海賊' ELSE COALESCE(u.display_name, u.email) END AS display_name,
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
    res.status(500).json({ error: '保留中のリクエストの読み込みに失敗しました' });
  }
}

module.exports = { sendRequest, sendRequestByEmail, respondRequest, removeFriend, listFriends, listPendingRequests };
