const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
	cors: { origin: ['https://blackbeardtavern.me', 'http://localhost:8080'] }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const { generalLimiter } = require('./middleware/rateLimiters');
app.use(generalLimiter);

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Blackbeard\'s Tavern backend is running' });
});

// Rotas específicas
const imageRoutes = require('./routes/image');
app.use('/api/image', imageRoutes);

const downloadRoutes = require('./routes/download');
app.use('/api/download', downloadRoutes);

const audioRoutes = require('./routes/audio');
app.use('/api/audio', audioRoutes);

const musicRoutes = require('./routes/music');
app.use('/api/music', musicRoutes);

const authRoutes = require('./modules/auth/authRoutes');
app.use('/api/auth', authRoutes);

const profileRoutes = require('./modules/profile/profileRoutes');
app.use('/api/profile', profileRoutes);

const feedRoutes = require('./modules/feed/feedRoutes');
app.use('/api/feed', feedRoutes);

const friendsRoutes = require('./modules/friends/friendsRoutes');
app.use('/api/friends', friendsRoutes);

const chatRoutes = require('./modules/chat/chatRoutes');
app.use('/api/chat', chatRoutes);

const groupsRoutes = require('./modules/groups/groupsRoutes');
app.use('/api/groups', groupsRoutes);

const notificationsRoutes = require('./modules/notifications/notificationsRoutes');
app.use('/api/notifications', notificationsRoutes);

const eventsRoutes = require('./modules/events/eventsRoutes');
app.use('/api/events', eventsRoutes);

// --- Socket.io: autenticação da conexão via token JWT ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
});

// Guarda quais sockets pertencem a qual usuário (um usuário pode ter várias abas abertas)
const onlineUsers = new Map(); // userId -> Set de socket ids

io.on('connection', (socket) => {
  const userId = socket.userId;

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  console.log(`User ${userId} connected (socket ${socket.id})`);

  socket.on('send_message', async (data) => {
    try {
      const { receiverId, content, mediaUrl, mediaType } = data;

      if (!receiverId || (!content || !content.trim()) && !mediaUrl) {
        return socket.emit('error_message', { error: 'Invalid message data' });
      }

      if (content && content.length > 2000) {
        return socket.emit('error_message', { error: 'Message is too long' });
      }

      const pool = require('./db/pool');
      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, content, media_url, media_type)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
        [userId, receiverId, content ? content.trim() : null, mediaUrl || null, mediaType || null]
      );

      const message = {
        id: result.rows[0].id,
        sender_id: userId,
        receiver_id: receiverId,
        content: content ? content.trim() : null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        created_at: result.rows[0].created_at
      };

      socket.emit('new_message', message);

      const receiverSockets = onlineUsers.get(receiverId);
      if (receiverSockets) {
        receiverSockets.forEach(socketId => {
          io.to(socketId).emit('new_message', message);
        });
      }

      // Notifica o destinatário no sino. Falha aqui não deve quebrar o envio da mensagem.
      try {
        if (receiverId === userId) return; // não notifica a si mesmo
        const senderInfo = await pool.query(
          `SELECT CASE WHEN is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(display_name, email) END AS name FROM users WHERE id = $1`,
          [userId]
        );
        const senderName = senderInfo.rows[0]?.name || 'Someone';
        const trimmed = content && content.trim();
        const preview = trimmed
          ? (trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed)
          : (mediaType === 'video' ? 'sent a video 🎥' : 'sent an image 🖼️');
        const notifMessage = trimmed ? `${senderName}: ${preview}` : `${senderName} ${preview}`;

        // Agrupa por remetente: se já há uma notificação de mensagem não-lida desse usuário, atualiza em vez de empilhar
        const updated = await pool.query(
          `UPDATE notifications SET message = $1, created_at = NOW()
           WHERE user_id = $2 AND actor_id = $3 AND type = 'message' AND read_at IS NULL
           RETURNING id, created_at`,
          [notifMessage, receiverId, userId]
        );

        let notifRow = updated.rows[0];
        if (!notifRow) {
          const inserted = await pool.query(
            `INSERT INTO notifications (user_id, actor_id, type, reference_id, message)
             VALUES ($1, $2, 'message', $3, $4) RETURNING id, created_at`,
            [receiverId, userId, userId, notifMessage]
          );
          notifRow = inserted.rows[0];
        }

        const unreadForReceiver = await pool.query(
          'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL',
          [receiverId]
        );

        if (receiverSockets) {
          const notifPayload = {
            id: notifRow.id,
            type: 'message',
            reference_id: userId, // remetente, pra abrir a conversa ao clicar
            message: notifMessage,
            created_at: notifRow.created_at,
            read_at: null,
            unreadCount: parseInt(unreadForReceiver.rows[0].count)
          };
          receiverSockets.forEach(socketId => io.to(socketId).emit('new_notification', notifPayload));
        }
      } catch (notifErr) {
        console.error('Failed to create message notification:', notifErr);
      }
    } catch (err) {
      console.error(err);
      socket.emit('error_message', { error: 'Failed to send message' });
    }
  });

  socket.on('delete_message', async (data) => {
    try {
      const { messageId } = data;
      const pool = require('./db/pool');

      const result = await pool.query('SELECT sender_id, receiver_id FROM messages WHERE id = $1', [messageId]);

      if (result.rows.length === 0) {
        return socket.emit('error_message', { error: 'Message not found' });
      }

      const msg = result.rows[0];

      if (msg.sender_id !== userId) {
        return socket.emit('error_message', { error: 'You can only delete your own messages' });
      }

      await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);

      const payload = { messageId };
      socket.emit('message_deleted', payload);

      const receiverSockets = onlineUsers.get(msg.receiver_id);
      if (receiverSockets) {
        receiverSockets.forEach(socketId => {
          io.to(socketId).emit('message_deleted', payload);
        });
      }
    } catch (err) {
      console.error(err);
      socket.emit('error_message', { error: 'Failed to delete message' });
    }
  });

  socket.on('join_group', async (data) => {
    try {
      const { groupId } = data;
      const pool = require('./db/pool');

      const membership = await pool.query(
        'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );

      if (membership.rows.length === 0) {
        return socket.emit('error_message', { error: 'You are not a member of this group' });
      }

      socket.join(`group_${groupId}`);
    } catch (err) {
      console.error(err);
      socket.emit('error_message', { error: 'Failed to join group' });
    }
  });

  socket.on('leave_group_room', (data) => {
    socket.leave(`group_${data.groupId}`);
  });

  socket.on('send_group_message', async (data) => {
    try {
      const { groupId, content, mediaUrl, mediaType } = data;

      if (!groupId || ((!content || !content.trim()) && !mediaUrl)) {
        return socket.emit('error_message', { error: 'Invalid message data' });
      }

      if (content && content.length > 2000) {
        return socket.emit('error_message', { error: 'Message is too long' });
      }

      const pool = require('./db/pool');

      const membership = await pool.query(
        'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );
      if (membership.rows.length === 0) {
        return socket.emit('error_message', { error: 'You are not a member of this group' });
      }

      const userResult = await pool.query(
        `SELECT CASE WHEN is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(display_name, email) END AS name
         FROM users WHERE id = $1`,
        [userId]
      );

      const result = await pool.query(
        `INSERT INTO group_messages (group_id, sender_id, content, media_url, media_type)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
        [groupId, userId, content ? content.trim() : null, mediaUrl || null, mediaType || null]
      );

      const message = {
        id: result.rows[0].id,
        group_id: groupId,
        sender_id: userId,
        sender_name: userResult.rows[0].name,
        content: content ? content.trim() : null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        created_at: result.rows[0].created_at
      };

      io.to(`group_${groupId}`).emit('new_group_message', message);
    } catch (err) {
      console.error(err);
      socket.emit('error_message', { error: 'Failed to send group message' });
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.get(userId)?.delete(socket.id);
    if (onlineUsers.get(userId)?.size === 0) {
      onlineUsers.delete(userId);
    }
    console.log(`User ${userId} disconnected (socket ${socket.id})`);
  });
});

// Disponibiliza io e onlineUsers pros outros módulos usarem (chat, notificações)
app.set('io', io);
app.set('onlineUsers', onlineUsers);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (with WebSocket support)`);
});
