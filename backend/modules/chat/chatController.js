const pool = require('../../db/pool');
const sharp = require('sharp');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const MEDIA_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'assets', 'chat-media');

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

    // Abrir a conversa também limpa as notificações de mensagem desse remetente no sino
    await pool.query(
      `UPDATE notifications SET read_at = NOW()
       WHERE user_id = $1 AND actor_id = $2 AND type = 'message' AND read_at IS NULL`,
      [userId, otherUserId]
    );

    res.json({ messages: result.rows.reverse(), hasMore: result.rows.length === limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load message history' });
  }
}

async function uploadMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const inputPath = req.file.path;
    const mimetype = req.file.mimetype;
    let mediaUrl, mediaType;

    if (mimetype.startsWith('image/')) {
      let metadata;
      try {
        metadata = await sharp(inputPath).metadata();
      } catch {
        fs.unlinkSync(inputPath);
        return res.status(400).json({ error: 'Invalid image file' });
      }

      const allowedFormats = ['jpeg', 'png', 'webp', 'gif'];
      if (!allowedFormats.includes(metadata.format)) {
        fs.unlinkSync(inputPath);
        return res.status(400).json({ error: 'Unsupported image format' });
      }

      const filename = `${crypto.randomBytes(16).toString('hex')}.webp`;
      const outputPath = path.join(MEDIA_DIR, filename);

      await sharp(inputPath)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outputPath);

      fs.unlinkSync(inputPath);
      mediaUrl = `/assets/chat-media/${filename}`;
      mediaType = 'image';

    } else if (mimetype.startsWith('video/')) {
      const filename = `${crypto.randomBytes(16).toString('hex')}.mp4`;
      const outputPath = path.join(MEDIA_DIR, filename);

      await new Promise((resolve, reject) => {
        execFile('ffmpeg', [
          '-i', inputPath,
          '-t', '30',
          '-vf', "scale='min(720,iw)':-2",
          '-c:v', 'libx264', '-crf', '28', '-preset', 'fast',
          '-c:a', 'aac', '-b:a', '96k',
          outputPath
        ], (err) => {
          fs.unlinkSync(inputPath);
          if (err) return reject(err);
          resolve();
        });
      }).catch(() => {
        throw new Error('Invalid or unsupported video file');
      });

      mediaUrl = `/assets/chat-media/${filename}`;
      mediaType = 'video';

    } else {
      fs.unlinkSync(inputPath);
      return res.status(400).json({ error: 'Only image or video files are allowed' });
    }

    res.json({ mediaUrl, mediaType });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to upload media' });
  }
}

// Apaga toda a conversa 1-a-1 entre o usuário e outra pessoa (some pra ambos os lados)
async function deleteConversation(req, res) {
  try {
    const userId = req.user.userId;
    const otherUserId = parseInt(req.params.userId);

    if (!otherUserId || otherUserId === userId) {
      return res.status(400).json({ error: 'Invalid conversation' });
    }

    await pool.query(
      `DELETE FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
      [userId, otherUserId]
    );

    // Remove as notificações de mensagem trocadas entre os dois, dos dois lados
    await pool.query(
      `DELETE FROM notifications
       WHERE type = 'message'
         AND ((user_id = $1 AND actor_id = $2) OR (user_id = $2 AND actor_id = $1))`,
      [userId, otherUserId]
    );

    // Avisa em tempo real: minhas outras abas e o outro usuário (pra fechar/atualizar o chat)
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');
    if (io && onlineUsers) {
      [userId, otherUserId].forEach(uid => {
        const sockets = onlineUsers.get(uid);
        if (sockets) {
          sockets.forEach(socketId => {
            io.to(socketId).emit('conversation_deleted', {
              withUserId: uid === userId ? otherUserId : userId
            });
          });
        }
      });
    }

    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
}

module.exports = { getConversations, getHistory, uploadMedia, deleteConversation };
