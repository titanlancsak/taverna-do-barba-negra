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
