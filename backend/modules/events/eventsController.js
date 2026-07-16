const pool = require('../../db/pool');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const MEDIA_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'assets', 'event-media');

// Cria um evento (com foto opcional, reprocessada com sharp)
async function createEvent(req, res) {
  try {
    const userId = req.user.userId;
    const { name, date, time, location, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'イベント名は必須です' });
    }
    if (name.length > 150) {
      return res.status(400).json({ error: 'イベント名が長すぎます（最大150文字）' });
    }
    if (!date) {
      return res.status(400).json({ error: 'イベントの日付は必須です' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: '日付の形式が無効です' });
    }
    if (time && !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ error: '時刻の形式が無効です' });
    }
    if (location && location.length > 200) {
      return res.status(400).json({ error: '場所が長すぎます（最大200文字）' });
    }
    if (description && description.length > 2000) {
      return res.status(400).json({ error: '説明が長すぎます（最大2000文字）' });
    }

    let photoUrl = null;

    if (req.file) {
      const inputPath = req.file.path;
      const mimetype = req.file.mimetype;

      if (!mimetype.startsWith('image/')) {
        fs.unlinkSync(inputPath);
        return res.status(400).json({ error: 'イベントの写真は画像である必要があります' });
      }

      let metadata;
      try {
        metadata = await sharp(inputPath).metadata();
      } catch {
        fs.unlinkSync(inputPath);
        return res.status(400).json({ error: '無効な画像ファイルです' });
      }

      const allowedFormats = ['jpeg', 'png', 'webp', 'gif'];
      if (!allowedFormats.includes(metadata.format)) {
        fs.unlinkSync(inputPath);
        return res.status(400).json({ error: '対応していない画像形式です' });
      }

      const filename = `${crypto.randomBytes(16).toString('hex')}.webp`;
      const outputPath = path.join(MEDIA_DIR, filename);

      await sharp(inputPath)
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(outputPath);

      fs.unlinkSync(inputPath);
      photoUrl = `/assets/event-media/${filename}`;
    }

    const result = await pool.query(
      `INSERT INTO events (creator_id, name, event_date, event_time, location, description, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [
        userId,
        name.trim(),
        date,
        time || null,
        location ? location.trim() : null,
        description ? description.trim() : null,
        photoUrl
      ]
    );

    res.status(201).json({ message: 'イベントを作成しました', event: { id: result.rows[0].id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'イベントの作成に失敗しました' });
  }
}

// Lista os eventos futuros (data >= hoje), com contagem de presenças e se o usuário confirmou
async function listEvents(req, res) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT e.id, e.name,
              TO_CHAR(e.event_date, 'YYYY-MM-DD') AS event_date,
              TO_CHAR(e.event_time, 'HH24:MI') AS event_time,
              e.location, e.description, e.photo_url,
              e.creator_id,
              CASE WHEN u.is_anonymous THEN '匿名の海賊' ELSE COALESCE(u.display_name, u.email) END AS creator_name,
              (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) AS attendee_count,
              EXISTS(SELECT 1 FROM event_attendees WHERE event_id = e.id AND user_id = $1) AS attending
       FROM events e
       JOIN users u ON u.id = e.creator_id
       WHERE e.event_date >= CURRENT_DATE
       ORDER BY e.event_date ASC, e.event_time ASC NULLS LAST`,
      [userId]
    );

    res.json({ events: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'イベントの読み込みに失敗しました' });
  }
}

// Confirma presença
async function attendEvent(req, res) {
  try {
    const userId = req.user.userId;
    const eventId = parseInt(req.params.eventId);

    const event = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);
    if (event.rows.length === 0) {
      return res.status(404).json({ error: 'イベントが見つかりません' });
    }

    await pool.query(
      'INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [eventId, userId]
    );

    const count = await pool.query('SELECT COUNT(*) FROM event_attendees WHERE event_id = $1', [eventId]);
    res.json({ attending: true, attendeeCount: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '参加の確定に失敗しました' });
  }
}

// Cancela presença
async function cancelAttendance(req, res) {
  try {
    const userId = req.user.userId;
    const eventId = parseInt(req.params.eventId);

    await pool.query('DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2', [eventId, userId]);

    const count = await pool.query('SELECT COUNT(*) FROM event_attendees WHERE event_id = $1', [eventId]);
    res.json({ attending: false, attendeeCount: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '参加の取り消しに失敗しました' });
  }
}

// Apaga o evento (só quem criou)
async function deleteEvent(req, res) {
  try {
    const userId = req.user.userId;
    const eventId = parseInt(req.params.eventId);

    const event = await pool.query('SELECT creator_id FROM events WHERE id = $1', [eventId]);
    if (event.rows.length === 0) {
      return res.status(404).json({ error: 'イベントが見つかりません' });
    }
    if (event.rows[0].creator_id !== userId) {
      return res.status(403).json({ error: 'イベントを削除できるのは作成者のみです' });
    }

    await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
    res.json({ message: 'イベントを削除しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'イベントの削除に失敗しました' });
  }
}

module.exports = { createEvent, listEvents, attendEvent, cancelAttendance, deleteEvent };
