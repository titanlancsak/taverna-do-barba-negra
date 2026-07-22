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

const adminRoutes = require('./modules/admin/adminRoutes');
app.use('/api/admin', adminRoutes);

// --- Socket.io: autenticação da conexão via token JWT ---
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('認証が必要です'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Bloqueia usuários banidos também no tempo real
    const pool = require('./db/pool');
    const result = await pool.query('SELECT is_banned FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0 || result.rows[0].is_banned) {
      return next(new Error('このアカウントは停止されています'));
    }

    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('トークンが無効または期限切れです'));
  }
});

// Guarda quais sockets pertencem a qual usuário (um usuário pode ter várias abas abertas)
const onlineUsers = new Map(); // userId -> Set de socket ids

// Jogadores presentes no campus virtual (chaveado por socket.id — um por conexão)
const campusPlayers = new Map(); // socketId -> { userId, x, y, name, color }

// Paleta de cores estável por usuário (cada jogador ganha uma cor consistente)
const CAMPUS_COLORS = [
  0xef5350, 0xab47bc, 0x5c6bc0, 0x29b6f6, 0x26a69a, 0x66bb6a,
  0xffca28, 0xff7043, 0x8d6e63, 0xec407a, 0x7e57c2, 0x42a5f5
];
function colorForUser(userId) {
  const i = ((userId % CAMPUS_COLORS.length) + CAMPUS_COLORS.length) % CAMPUS_COLORS.length;
  return CAMPUS_COLORS[i];
}

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
        return socket.emit('error_message', { error: 'メッセージのデータが無効です' });
      }

      if (content && content.length > 2000) {
        return socket.emit('error_message', { error: 'メッセージが長すぎます' });
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
          `SELECT CASE WHEN is_anonymous THEN '匿名の海賊' ELSE COALESCE(display_name, email) END AS name FROM users WHERE id = $1`,
          [userId]
        );
        const senderName = senderInfo.rows[0]?.name || '誰か';
        const trimmed = content && content.trim();
        const preview = trimmed
          ? (trimmed.length > 60 ? trimmed.slice(0, 60) + '…' : trimmed)
          : (mediaType === 'video' ? '動画を送信しました 🎥' : '画像を送信しました 🖼️');
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
      socket.emit('error_message', { error: 'メッセージの送信に失敗しました' });
    }
  });

  socket.on('delete_message', async (data) => {
    try {
      const { messageId } = data;
      const pool = require('./db/pool');

      const result = await pool.query('SELECT sender_id, receiver_id FROM messages WHERE id = $1', [messageId]);

      if (result.rows.length === 0) {
        return socket.emit('error_message', { error: 'メッセージが見つかりません' });
      }

      const msg = result.rows[0];

      if (msg.sender_id !== userId) {
        return socket.emit('error_message', { error: '自分のメッセージのみ削除できます' });
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
      socket.emit('error_message', { error: 'メッセージの削除に失敗しました' });
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
        return socket.emit('error_message', { error: 'このグループのメンバーではありません' });
      }

      socket.join(`group_${groupId}`);
    } catch (err) {
      console.error(err);
      socket.emit('error_message', { error: 'グループへの参加に失敗しました' });
    }
  });

  socket.on('leave_group_room', (data) => {
    socket.leave(`group_${data.groupId}`);
  });

  socket.on('send_group_message', async (data) => {
    try {
      const { groupId, content, mediaUrl, mediaType } = data;

      if (!groupId || ((!content || !content.trim()) && !mediaUrl)) {
        return socket.emit('error_message', { error: 'メッセージのデータが無効です' });
      }

      if (content && content.length > 2000) {
        return socket.emit('error_message', { error: 'メッセージが長すぎます' });
      }

      const pool = require('./db/pool');

      const membership = await pool.query(
        'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );
      if (membership.rows.length === 0) {
        return socket.emit('error_message', { error: 'このグループのメンバーではありません' });
      }

      const userResult = await pool.query(
        `SELECT CASE WHEN is_anonymous THEN '匿名の海賊' ELSE COALESCE(display_name, email) END AS name
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
      socket.emit('error_message', { error: 'グループメッセージの送信に失敗しました' });
    }
  });

  // --- Campus virtual (multiplayer) ---
  socket.on('campus_join', async (data) => {
    const x = Number(data?.x);
    const y = Number(data?.y);
    const px = Number.isFinite(x) ? x : 2000;
    const py = Number.isFinite(y) ? y : 1500;

    // Nome real do usuário (respeitando anonimato) e cor estável
    let name = '匿名の海賊';
    try {
      const pool = require('./db/pool');
      const r = await pool.query(
        `SELECT CASE WHEN is_anonymous THEN '匿名の海賊' ELSE COALESCE(display_name, email) END AS name
         FROM users WHERE id = $1`,
        [userId]
      );
      if (r.rows[0]?.name) name = r.rows[0].name;
    } catch (err) {
      console.error('campus_join name lookup failed:', err);
    }
    const color = colorForUser(userId);

    campusPlayers.set(socket.id, { userId, x: px, y: py, name, color });
    socket.join('campus');

    // Informa ao próprio jogador a sua identidade (nome/cor autoritativos)
    socket.emit('campus_me', { id: socket.id, name, color });

    // Envia ao recém-chegado a lista de quem já está no campus
    const others = [];
    campusPlayers.forEach((p, id) => {
      if (id !== socket.id) others.push({ id, x: p.x, y: p.y, name: p.name, color: p.color });
    });
    socket.emit('campus_players', others);

    // Avisa os demais que um novo jogador entrou
    socket.to('campus').emit('campus_player_joined', { id: socket.id, x: px, y: py, name, color });
  });

  socket.on('campus_move', (data) => {
    const p = campusPlayers.get(socket.id);
    if (!p) return;
    const x = Number(data?.x);
    const y = Number(data?.y);
    if (Number.isFinite(x)) p.x = x;
    if (Number.isFinite(y)) p.y = y;
    socket.to('campus').emit('campus_player_moved', { id: socket.id, x: p.x, y: p.y });
  });

  socket.on('campus_chat', (data) => {
    if (!campusPlayers.has(socket.id)) return;
    let text = (data?.text || '').toString().trim();
    if (!text) return;
    if (text.length > 100) text = text.slice(0, 100);
    socket.to('campus').emit('campus_chat', { id: socket.id, text });
  });

  socket.on('campus_leave', () => {
    if (campusPlayers.delete(socket.id)) {
      socket.leave('campus');
      socket.to('campus').emit('campus_player_left', { id: socket.id });
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.get(userId)?.delete(socket.id);
    if (onlineUsers.get(userId)?.size === 0) {
      onlineUsers.delete(userId);
    }

    // Remove do campus e avisa os outros jogadores
    if (campusPlayers.delete(socket.id)) {
      socket.to('campus').emit('campus_player_left', { id: socket.id });
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
