const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../../db/pool');
const { sendVerificationEmail } = require('./emailService');
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
      return res.status(400).json({ error: `Only ${ALLOWED_EMAIL_DOMAIN} emails are allowed` });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
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

    res.status(201).json({ message: 'Account created. Please check your email to verify your account.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

async function verifyEmail(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Missing verification token' });
    }

    const result = await pool.query(
      `SELECT id, verification_token_expires FROM users WHERE verification_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    const user = result.rows[0];

    if (new Date() > new Date(user.verification_token_expires)) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    await pool.query(
      `UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = $1`,
      [user.id]
    );

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, email, display_name, course, gender, profile_picture_url, is_anonymous, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
}

module.exports = { register, verifyEmail, login, getMe };
