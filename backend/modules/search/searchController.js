const pool = require('../../db/pool');

// Busca global: usuários, posts, eventos e grupos (do usuário) que combinam com o termo
async function search(req, res) {
  try {
    const userId = req.user.userId;
    const q = (req.query.q || '').toString().trim();

    if (q.length < 2) {
      return res.json({ users: [], posts: [], events: [], groups: [] });
    }
    const like = `%${q}%`;

    const [users, posts, events, groups] = await Promise.all([
      // Usuários (não anônimos, não banidos, exceto eu)
      pool.query(
        `SELECT id, COALESCE(display_name, email) AS display_name, profile_picture_url
         FROM users
         WHERE is_anonymous = FALSE AND is_banned = FALSE AND id <> $2
           AND (display_name ILIKE $1 OR email ILIKE $1)
         ORDER BY display_name NULLS LAST
         LIMIT 6`,
        [like, userId]
      ),
      // Posts do feed
      pool.query(
        `SELECT p.id, p.content,
                CASE WHEN u.is_anonymous THEN '匿名の海賊' ELSE COALESCE(u.display_name, u.email) END AS author_name
         FROM posts p
         JOIN users u ON u.id = p.user_id
         WHERE p.content ILIKE $1
         ORDER BY p.created_at DESC
         LIMIT 6`,
        [like]
      ),
      // Eventos futuros
      pool.query(
        `SELECT id, name, TO_CHAR(event_date, 'YYYY-MM-DD') AS event_date
         FROM events
         WHERE event_date >= CURRENT_DATE AND (name ILIKE $1 OR location ILIKE $1)
         ORDER BY event_date ASC
         LIMIT 6`,
        [like]
      ),
      // Grupos dos quais o usuário é membro
      pool.query(
        `SELECT g.id, g.name
         FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.user_id = $2 AND g.name ILIKE $1
         ORDER BY g.name
         LIMIT 6`,
        [like, userId]
      )
    ]);

    res.json({
      users: users.rows,
      posts: posts.rows,
      events: events.rows,
      groups: groups.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '検索に失敗しました' });
  }
}

module.exports = { search };
