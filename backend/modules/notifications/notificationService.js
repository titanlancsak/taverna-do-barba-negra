const pool = require('../../db/pool');

/**
 * Cria uma notificação no banco e emite em tempo real via Socket.io, se o usuário estiver online.
 * @param {object} io - instância do Socket.io
 * @param {Map} onlineUsers - mapa de userId -> Set de socket ids
 * @param {object} params - { userId, actorId, type, referenceId, message }
 */
async function createNotification(io, onlineUsers, { userId, actorId, type, referenceId, message }) {
  try {
    // Não notifica a si mesmo (ex: curtir o próprio post não gera notificação)
    if (userId === actorId) return;

    const result = await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, reference_id, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [userId, actorId, type, referenceId || null, message]
    );

    const notification = {
      id: result.rows[0].id,
      type,
      reference_id: referenceId || null,
      message,
      created_at: result.rows[0].created_at,
      read_at: null
    };

    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        io.to(socketId).emit('new_notification', notification);
      });
    }
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

module.exports = { createNotification };
