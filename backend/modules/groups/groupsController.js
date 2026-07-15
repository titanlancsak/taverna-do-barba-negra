const pool = require('../../db/pool');

async function createGroup(req, res) {
  try {
    const userId = req.user.userId;
    const { name, memberIds } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'Group name is too long (max 100 characters)' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const groupResult = await client.query(
        'INSERT INTO groups (name, creator_id) VALUES ($1, $2) RETURNING id, created_at',
        [name.trim(), userId]
      );
      const groupId = groupResult.rows[0].id;

      // Adiciona o criador como owner
      await client.query(
        'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
        [groupId, userId, 'owner']
      );

      // Adiciona os membros convidados (se houver), só se forem amigos de verdade
      if (Array.isArray(memberIds) && memberIds.length > 0) {
        for (const memberId of memberIds) {
          if (memberId === userId) continue;

          const isFriend = await client.query(
            `SELECT id FROM friendships
             WHERE status = 'accepted'
               AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
            [userId, memberId]
          );

          if (isFriend.rows.length > 0) {
            await client.query(
              'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [groupId, memberId, 'member']
            );
          }
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ message: 'Group created', group: { id: groupId, name: name.trim() } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
}

async function listMyGroups(req, res) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT g.id, g.name, g.created_at, gm.role,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [userId]
    );

    res.json({ groups: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load groups' });
  }
}

async function getGroupMembers(req, res) {
  try {
    const userId = req.user.userId;
    const groupId = parseInt(req.params.groupId);

    const membership = await pool.query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const result = await pool.query(
      `SELECT u.id,
        CASE WHEN u.is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(u.display_name, u.email) END AS display_name,
        CASE WHEN u.is_anonymous THEN NULL ELSE u.profile_picture_url END AS profile_picture_url,
        gm.role
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.role = 'owner' DESC, gm.joined_at ASC`,
      [groupId]
    );

    res.json({ members: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load group members' });
  }
}

async function inviteMember(req, res) {
  try {
    const userId = req.user.userId;
    const groupId = parseInt(req.params.groupId);
    const { friendId } = req.body;

    const membership = await pool.query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const isFriend = await pool.query(
      `SELECT id FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
      [userId, friendId]
    );
    if (isFriend.rows.length === 0) {
      return res.status(400).json({ error: 'You can only invite friends to the group' });
    }

    await pool.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [groupId, friendId, 'member']
    );

    res.json({ message: 'Member added to group' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to invite member' });
  }
}

async function leaveGroup(req, res) {
  try {
    const userId = req.user.userId;
    const groupId = parseInt(req.params.groupId);

    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);

    // Se não sobrou ninguém, apaga o grupo
    const remaining = await pool.query('SELECT id FROM group_members WHERE group_id = $1', [groupId]);
    if (remaining.rows.length === 0) {
      await pool.query('DELETE FROM groups WHERE id = $1', [groupId]);
    }

    res.json({ message: 'Left the group' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to leave group' });
  }
}

async function getGroupHistory(req, res) {
  try {
    const userId = req.user.userId;
    const groupId = parseInt(req.params.groupId);
    const page = parseInt(req.query.page) || 1;
    const limit = 30;
    const offset = (page - 1) * limit;

    const membership = await pool.query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const result = await pool.query(
      `SELECT gm.id, gm.sender_id, gm.content, gm.media_url, gm.media_type, gm.created_at,
        CASE WHEN u.is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(u.display_name, u.email) END AS sender_name
       FROM group_messages gm
       JOIN users u ON u.id = gm.sender_id
       WHERE gm.group_id = $1
       ORDER BY gm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [groupId, limit, offset]
    );

    res.json({ messages: result.rows.reverse(), hasMore: result.rows.length === limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load group messages' });
  }
}

module.exports = {
  createGroup, listMyGroups, getGroupMembers, inviteMember, leaveGroup, getGroupHistory
};
