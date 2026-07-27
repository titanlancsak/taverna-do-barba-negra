const pool = require('../../db/pool');

const VALID_LANGS = ['en', 'ja'];
const VALID_CATEGORIES = ['linux', 'sql', 'python', 'java', 'aws', 'cisco'];

// Avalia e concede conquistas depois de um resultado. Retorna as novas chaves.
async function evaluateAchievements(userId, result) {
  const earned = [];

  // Marcos de velocidade e precisão do resultado atual
  if (result.wpm >= 40) earned.push('speed_40');
  if (result.wpm >= 60) earned.push('speed_60');
  if (result.wpm >= 80) earned.push('speed_80');
  if (result.wpm >= 100) earned.push('speed_100');
  if (result.accuracy >= 100) earned.push('accuracy_100');
  if (result.is_daily) earned.push('daily_done');

  // Primeira partida de todas
  const total = await pool.query('SELECT COUNT(*)::int AS n FROM typing_results WHERE user_id = $1', [userId]);
  if (total.rows[0].n <= 1) earned.push('first_run');

  // Jogou todas as categorias
  const cats = await pool.query('SELECT COUNT(DISTINCT category)::int AS n FROM typing_results WHERE user_id = $1', [userId]);
  if (cats.rows[0].n >= VALID_CATEGORIES.length) earned.push('all_categories');

  // Sequência de 7 dias com desafio diário
  const days = await pool.query(
    `SELECT DISTINCT daily_date FROM typing_results
     WHERE user_id = $1 AND is_daily = TRUE AND daily_date IS NOT NULL
     ORDER BY daily_date DESC LIMIT 7`,
    [userId]
  );
  if (days.rows.length >= 7) {
    let streak = true;
    for (let i = 0; i < 7; i++) {
      const expected = new Date();
      expected.setDate(expected.getDate() - i);
      const got = new Date(days.rows[i].daily_date);
      if (expected.toISOString().slice(0, 10) !== got.toISOString().slice(0, 10)) { streak = false; break; }
    }
    if (streak) earned.push('streak_7');
  }

  if (!earned.length) return [];

  // Insere apenas as que ainda não existem; RETURNING diz quais são novas
  const values = earned.map((_, i) => `($1, $${i + 2})`).join(', ');
  const res = await pool.query(
    `INSERT INTO typing_achievements (user_id, achievement_key)
     VALUES ${values}
     ON CONFLICT (user_id, achievement_key) DO NOTHING
     RETURNING achievement_key`,
    [userId, ...earned]
  );
  return res.rows.map((r) => r.achievement_key);
}

// POST /api/typing/results
async function submitResult(req, res) {
  try {
    const userId = req.user.userId;
    let { language, category, wpm, accuracy, errors, durationMs, isDaily } = req.body || {};

    if (!VALID_LANGS.includes(language)) return res.status(400).json({ error: '言語が無効です' });
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'カテゴリが無効です' });

    wpm = Math.max(0, Math.min(400, parseInt(wpm, 10) || 0));
    accuracy = Math.max(0, Math.min(100, parseInt(accuracy, 10) || 0));
    errors = Math.max(0, parseInt(errors, 10) || 0);
    durationMs = Math.max(0, parseInt(durationMs, 10) || 0);
    isDaily = !!isDaily;

    const dailyDate = isDaily ? new Date().toISOString().slice(0, 10) : null;

    await pool.query(
      `INSERT INTO typing_results (user_id, language, category, wpm, accuracy, errors, duration_ms, is_daily, daily_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, language, category, wpm, accuracy, errors, durationMs, isDaily, dailyDate]
    );

    const newAchievements = await evaluateAchievements(userId, { wpm, accuracy, errors, is_daily: isDaily });

    res.status(201).json({ message: '結果を保存しました', newAchievements });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '結果の保存に失敗しました' });
  }
}

// GET /api/typing/history — últimos resultados do usuário
async function getHistory(req, res) {
  try {
    const result = await pool.query(
      `SELECT language, category, wpm, accuracy, errors, is_daily, created_at
       FROM typing_results
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user.userId]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '履歴の読み込みに失敗しました' });
  }
}

// GET /api/typing/ranking?category=&language= — melhor WPM por usuário
async function getRanking(req, res) {
  try {
    const { category, language } = req.query;
    const filters = [];
    const params = [];
    if (VALID_CATEGORIES.includes(category)) { params.push(category); filters.push(`category = $${params.length}`); }
    if (VALID_LANGS.includes(language)) { params.push(language); filters.push(`language = $${params.length}`); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT u.id AS user_id,
              CASE WHEN u.is_anonymous THEN '匿名の海賊' ELSE COALESCE(u.display_name, 'ユーザー') END AS name,
              u.profile_picture_url,
              MAX(t.wpm) AS best_wpm,
              MAX(t.accuracy) AS best_accuracy
       FROM typing_results t
       JOIN users u ON u.id = t.user_id
       ${where}
       GROUP BY u.id, u.is_anonymous, u.display_name, u.profile_picture_url
       ORDER BY best_wpm DESC
       LIMIT 20`,
      params
    );
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ランキングの読み込みに失敗しました' });
  }
}

// GET /api/typing/daily — ranking do desafio de hoje
async function getDaily(req, res) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT u.id AS user_id,
              CASE WHEN u.is_anonymous THEN '匿名の海賊' ELSE COALESCE(u.display_name, 'ユーザー') END AS name,
              u.profile_picture_url,
              MAX(t.wpm) AS best_wpm,
              MAX(t.accuracy) AS best_accuracy
       FROM typing_results t
       JOIN users u ON u.id = t.user_id
       WHERE t.is_daily = TRUE AND t.daily_date = $1
       GROUP BY u.id, u.is_anonymous, u.display_name, u.profile_picture_url
       ORDER BY best_wpm DESC
       LIMIT 20`,
      [today]
    );
    res.json({ date: today, ranking: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'デイリーの読み込みに失敗しました' });
  }
}

// GET /api/typing/achievements — conquistas do usuário
async function getAchievements(req, res) {
  try {
    const result = await pool.query(
      'SELECT achievement_key, unlocked_at FROM typing_achievements WHERE user_id = $1',
      [req.user.userId]
    );
    res.json({ achievements: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '実績の読み込みに失敗しました' });
  }
}

module.exports = { submitResult, getHistory, getRanking, getDaily, getAchievements };
