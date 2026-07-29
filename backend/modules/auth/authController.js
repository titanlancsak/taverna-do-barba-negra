const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../../db/pool');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./emailService');
require('dotenv').config();

const ALLOWED_EMAIL_DOMAIN = process.env.EMAIL_DOMAIN;

function isValidSchoolEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 && parts[1] === ALLOWED_EMAIL_DOMAIN;
}

async function register(req, res) {
  try {
    const { email, password } = req.body;

    if (!isValidSchoolEmail(email)) {
      return res.status(400).json({ error: `${ALLOWED_EMAIL_DOMAIN} のメールのみ利用できます` });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'パスワードは8文字以上である必要があります' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'このメールアドレスのアカウントは既に存在します' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await pool.query(
      `INSERT INTO users (email, password_hash, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, $4)`,
      [email.toLowerCase(), passwordHash, verificationToken, tokenExpires]
    );

    await sendVerificationEmail(email, verificationToken);

    res.status(201).json({ message: 'アカウントを作成しました。メールを確認してアカウントを認証してください。' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '登録に失敗しました' });
  }
}

async function verifyEmail(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: '認証トークンがありません' });
    }

    const result = await pool.query(
      `SELECT id, verification_token_expires FROM users WHERE verification_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: '認証トークンが無効です' });
    }

    const user = result.rows[0];

    if (new Date() > new Date(user.verification_token_expires)) {
      return res.status(400).json({ error: '認証トークンの有効期限が切れています' });
    }

    await pool.query(
      `UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = $1`,
      [user.id]
    );

    res.json({ message: 'メール認証が完了しました！ログインできます。' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '認証に失敗しました' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'メールアドレスとパスワードは必須です' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    const user = result.rows[0];

    if (!user.email_verified) {
      return res.status(403).json({ error: 'ログインする前にメールを認証してください' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    if (user.is_banned) {
      return res.status(403).json({
        error: 'このアカウントは停止されています' + (user.ban_reason ? '：' + user.ban_reason : '')
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'ログインしました',
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ログインに失敗しました' });
  }
}

// Solicita reset de senha. Responde sempre de forma genérica (não revela se o
// e-mail existe) para evitar enumeração de contas.
async function forgotPassword(req, res) {
  const genericMessage = 'そのメールアドレスのアカウントが存在する場合、再設定用のリンクを送信しました。';
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'メールアドレスは必須です' });
    }

    const result = await pool.query(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Só envia se a conta existe e o e-mail já foi verificado.
    if (result.rows.length > 0 && result.rows[0].email_verified) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h

      await pool.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [resetToken, tokenExpires, result.rows[0].id]
      );

      await sendPasswordResetEmail(email.toLowerCase(), resetToken);
    }

    res.json({ message: genericMessage });
  } catch (err) {
    console.error(err);
    // Mesmo em erro, resposta genérica para não vazar informação.
    res.json({ message: genericMessage });
  }
}

// Redefine a senha a partir de um token válido.
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'トークンがありません' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'パスワードは8文字以上である必要があります' });
    }

    const result = await pool.query(
      'SELECT id, reset_token_expires FROM users WHERE reset_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'トークンが無効です' });
    }

    const user = result.rows[0];
    if (!user.reset_token_expires || new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({ error: 'トークンの有効期限が切れています' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ message: 'パスワードを再設定しました。ログインできます。' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'パスワードの再設定に失敗しました' });
  }
}

// Apaga a própria conta. Exige a senha atual como confirmação; a exclusão em
// cascata (ON DELETE CASCADE) remove posts, mensagens, amizades, etc.
async function deleteAccount(req, res) {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: '確認のためパスワードを入力してください' });
    }

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    const passwordMatch = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'パスワードが正しくありません' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.user.userId]);

    res.json({ message: 'アカウントを削除しました。' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'アカウントの削除に失敗しました' });
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, course, gender, profile_picture_url, is_anonymous, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ユーザーデータの取得に失敗しました' });
  }
}

module.exports = { register, verifyEmail, login, getMe, forgotPassword, resetPassword, deleteAccount };
