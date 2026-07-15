const pool = require('../../db/pool');
const sharp = require('sharp');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const MEDIA_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'assets', 'feed-media');

async function createPost(req, res) {
  try {
    const userId = req.user.userId;
    const { content } = req.body;

    if ((!content || !content.trim()) && !req.file) {
      return res.status(400).json({ error: 'Post must have text or media' });
    }

    if (content && content.length > 1000) {
      return res.status(400).json({ error: 'Post text is too long (max 1000 characters)' });
    }

    let mediaUrl = null;
    let mediaType = null;

    if (req.file) {
      const inputPath = req.file.path;
      const mimetype = req.file.mimetype;

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
          .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(outputPath);

        fs.unlinkSync(inputPath);
        mediaUrl = `/assets/feed-media/${filename}`;
        mediaType = 'image';

      } else if (mimetype.startsWith('video/')) {
        const filename = `${crypto.randomBytes(16).toString('hex')}.mp4`;
        const outputPath = path.join(MEDIA_DIR, filename);

        await new Promise((resolve, reject) => {
          execFile('ffmpeg', [
            '-i', inputPath,
            '-t', '60',
            '-vf', 'scale=\'min(1280,iw)\':-2',
            '-c:v', 'libx264', '-crf', '28', '-preset', 'fast',
            '-c:a', 'aac', '-b:a', '128k',
            outputPath
          ], (err) => {
            fs.unlinkSync(inputPath);
            if (err) return reject(err);
            resolve();
          });
        }).catch(() => {
          throw new Error('Invalid or unsupported video file');
        });

        mediaUrl = `/assets/feed-media/${filename}`;
        mediaType = 'video';

      } else {
        fs.unlinkSync(inputPath);
        return res.status(400).json({ error: 'Only image or video files are allowed' });
      }
    }

    const result = await pool.query(
      `INSERT INTO posts (user_id, content, media_url, media_type)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [userId, content || null, mediaUrl, mediaType]
    );

    res.status(201).json({
      message: 'Post created',
      post: { id: result.rows[0].id, createdAt: result.rows[0].created_at }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create post' });
  }
}

async function getFeed(req, res) {
  try {
    const currentUserId = req.user?.userId || 0;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT
        p.id, p.content, p.media_url, p.media_type, p.created_at,
        u.id AS author_id,
        CASE WHEN u.is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(u.display_name, u.email) END AS author_name,
        u.is_anonymous,
        CASE WHEN u.is_anonymous THEN NULL ELSE u.profile_picture_url END AS author_picture,
        COUNT(DISTINCT l.id) AS like_count,
        COUNT(DISTINCT c.id) AS comment_count,
        BOOL_OR(l.user_id = $1) AS liked_by_me
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN likes l ON l.post_id = p.id
      LEFT JOIN comments c ON c.post_id = p.id
      GROUP BY p.id, u.id
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3`,
      [currentUserId, limit, offset]
    );

    res.json({ posts: result.rows, hasMore: result.rows.length === limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
}

async function toggleLike(req, res) {
  try {
    const userId = req.user.userId;
    const postId = parseInt(req.params.postId);

    const existing = await pool.query(
      'SELECT id FROM likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      return res.json({ liked: false });
    } else {
      await pool.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);

      const postOwner = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
      if (postOwner.rows.length > 0) {
        const { createNotification } = require('../notifications/notificationService');
        const actorName = await pool.query(
          `SELECT CASE WHEN is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(display_name, email) END AS name FROM users WHERE id = $1`,
          [userId]
        );
        await createNotification(req.app.get('io'), req.app.get('onlineUsers'), {
          userId: postOwner.rows[0].user_id,
          actorId: userId,
          type: 'like',
          referenceId: postId,
          message: `${actorName.rows[0].name} liked your post`
        });
      }

      return res.json({ liked: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
}

async function addComment(req, res) {
  try {
    const userId = req.user.userId;
    const postId = parseInt(req.params.postId);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: 'Comment is too long (max 500 characters)' });
    }

    const postExists = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (postExists.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const result = await pool.query(
      `INSERT INTO comments (post_id, user_id, content)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [postId, userId, content.trim()]
    );

    const postOwner = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (postOwner.rows.length > 0) {
      const { createNotification } = require('../notifications/notificationService');
      const actorName = await pool.query(
        `SELECT CASE WHEN is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(display_name, email) END AS name FROM users WHERE id = $1`,
        [userId]
      );
      await createNotification(req.app.get('io'), req.app.get('onlineUsers'), {
        userId: postOwner.rows[0].user_id,
        actorId: userId,
        type: 'comment',
        referenceId: postId,
        message: `${actorName.rows[0].name} commented on your post`
      });
    }

    res.status(201).json({ message: 'Comment added', comment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

async function getComments(req, res) {
  try {
    const postId = parseInt(req.params.postId);

    const result = await pool.query(
      `SELECT
        c.id, c.content, c.created_at, c.user_id,
        CASE WHEN u.is_anonymous THEN 'Anonymous Pirate' ELSE COALESCE(u.display_name, u.email) END AS author_name,
        CASE WHEN u.is_anonymous THEN NULL ELSE u.profile_picture_url END AS author_picture
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC`,
      [postId]
    );

    res.json({ comments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
}

async function deleteComment(req, res) {
  try {
    const userId = req.user.userId;
    const commentId = parseInt(req.params.commentId);

    const result = await pool.query('SELECT user_id FROM comments WHERE id = $1', [commentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (result.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
}

async function deletePost(req, res) {
  try {
    const userId = req.user.userId;
    const postId = parseInt(req.params.postId);

    const result = await pool.query('SELECT user_id, media_url FROM posts WHERE id = $1', [postId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (result.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    const mediaUrl = result.rows[0].media_url;
    if (mediaUrl) {
      const filePath = path.join(MEDIA_DIR, path.basename(mediaUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);

    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
}

module.exports = { createPost, getFeed, toggleLike, addComment, getComments, deleteComment, deletePost };
