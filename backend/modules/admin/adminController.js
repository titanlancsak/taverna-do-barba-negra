const pool = require('../../db/pool');
const { isAdminEmail } = require('../../config/admins');

// Lista todas as contas do site
async function listUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, email, display_name, course, is_anonymous, is_banned, ban_reason, email_verified, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ユーザーの読み込みに失敗しました' });
  }
}

// Bloqueia (bane) uma conta
async function banUser(req, res) {
  try {
    const targetId = parseInt(req.params.id);

    const target = await pool.query('SELECT email FROM users WHERE id = $1', [targetId]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    // Não deixa banir um admin
    if (isAdminEmail(target.rows[0].email)) {
      return res.status(403).json({ error: '管理者は停止できません' });
    }

    const reason = (req.body && req.body.reason ? String(req.body.reason).trim() : '') || null;
    await pool.query('UPDATE users SET is_banned = TRUE, ban_reason = $1 WHERE id = $2', [reason, targetId]);

    // Desconecta na hora os sockets do usuário banido
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    if (io && onlineUsers) {
      const sockets = onlineUsers.get(targetId);
      if (sockets) {
        sockets.forEach((socketId) => io.sockets.sockets.get(socketId)?.disconnect(true));
      }
    }

    res.json({ message: 'ユーザーを停止しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '停止に失敗しました' });
  }
}

// Desbloqueia uma conta
async function unbanUser(req, res) {
  try {
    const targetId = parseInt(req.params.id);
    await pool.query('UPDATE users SET is_banned = FALSE, ban_reason = NULL WHERE id = $1', [targetId]);
    res.json({ message: 'ユーザーの停止を解除しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '解除に失敗しました' });
  }
}

module.exports = { listUsers, banUser, unbanUser };
