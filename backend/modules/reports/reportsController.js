const pool = require('../../db/pool');

const VALID_TARGETS = ['post', 'comment'];
const VALID_REASONS = ['spam', 'offense', 'inappropriate', 'other'];

// Tabela do alvo por tipo (evita SQL dinâmico com input do usuário)
const TARGET_TABLE = { post: 'posts', comment: 'comments' };

// POST /api/reports — qualquer usuário logado denuncia um post/comentário.
async function createReport(req, res) {
  try {
    const reporterId = req.user.userId;
    const { targetType, targetId, reason } = req.body || {};
    const description = (req.body && req.body.description ? String(req.body.description).trim() : '') || null;

    if (!VALID_TARGETS.includes(targetType)) {
      return res.status(400).json({ error: '対象の種類が無効です' });
    }
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: '理由が無効です' });
    }
    const tid = parseInt(targetId, 10);
    if (!Number.isInteger(tid)) {
      return res.status(400).json({ error: '対象が無効です' });
    }

    // Confirma que o alvo existe e pega o dono (não deixa denunciar o próprio conteúdo)
    const table = TARGET_TABLE[targetType];
    const target = await pool.query(`SELECT user_id FROM ${table} WHERE id = $1`, [tid]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: '対象が見つかりません' });
    }
    if (target.rows[0].user_id === reporterId) {
      return res.status(400).json({ error: '自分のコンテンツは通報できません' });
    }

    try {
      await pool.query(
        `INSERT INTO reports (reporter_id, target_type, target_id, reason, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [reporterId, targetType, tid, reason, description]
      );
    } catch (err) {
      // Violação da UNIQUE(reporter_id, target_type, target_id)
      if (err.code === '23505') {
        return res.status(409).json({ error: 'この項目はすでに通報済みです' });
      }
      throw err;
    }

    res.status(201).json({ message: '通報を受け付けました。ご協力ありがとうございます。' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '通報の送信に失敗しました' });
  }
}

// GET /api/reports — só admin. Lista denúncias (pendentes primeiro) com prévia do alvo.
async function listReports(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         r.id, r.target_type, r.target_id, r.reason, r.description, r.status,
         r.created_at, r.resolved_at,
         u.email AS reporter_email, u.display_name AS reporter_name,
         COALESCE(p.content, c.content) AS target_content,
         COALESCE(pu.email, cu.email) AS target_author_email,
         COALESCE(pu.display_name, cu.display_name) AS target_author_name
       FROM reports r
       JOIN users u ON u.id = r.reporter_id
       LEFT JOIN posts p ON r.target_type = 'post' AND p.id = r.target_id
       LEFT JOIN users pu ON pu.id = p.user_id
       LEFT JOIN comments c ON r.target_type = 'comment' AND c.id = r.target_id
       LEFT JOIN users cu ON cu.id = c.user_id
       ORDER BY (r.status = 'pending') DESC, r.created_at DESC`
    );
    res.json({ reports: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '通報の読み込みに失敗しました' });
  }
}

// POST /api/reports/:id/resolve|dismiss — só admin. Marca a denúncia como tratada.
async function updateReportStatus(req, res, status) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await pool.query(
      `UPDATE reports SET status = $1, resolved_at = NOW() WHERE id = $2 RETURNING id`,
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '通報が見つかりません' });
    }
    res.json({ message: status === 'resolved' ? '対応済みにしました' : '却下しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新に失敗しました' });
  }
}

const resolveReport = (req, res) => updateReportStatus(req, res, 'resolved');
const dismissReport = (req, res) => updateReportStatus(req, res, 'dismissed');

module.exports = { createReport, listReports, resolveReport, dismissReport };
