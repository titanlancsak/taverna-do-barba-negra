// Testes de integração das rotas de autenticação.
// O banco (pool) e o envio de e-mail são mockados; o rate limiter é
// neutralizado para não bloquear a bateria de requisições do teste.
// bcrypt e jwt rodam de verdade.

jest.mock('../db/pool', () => ({ query: jest.fn() }));
jest.mock('../modules/auth/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined)
}));
// Rate limiter vira um middleware "passa-direto" nos testes.
jest.mock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcrypt');

const pool = require('../db/pool');
const emailService = require('../modules/auth/emailService');
const authRoutes = require('../modules/auth/authRoutes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

const app = buildApp();

beforeEach(() => {
  pool.query.mockReset();
  emailService.sendVerificationEmail.mockClear();
  emailService.sendPasswordResetEmail.mockClear();
});

describe('POST /api/auth/register', () => {
  test('rejeita e-mail de domínio não permitido', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alguem@gmail.com', password: 'senha1234' });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('rejeita senha com menos de 8 caracteres', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'aluno@g.neec.ac.jp', password: 'curta' });
    expect(res.status).toBe(400);
  });

  test('rejeita e-mail já cadastrado (409)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // SELECT existente
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'aluno@g.neec.ac.jp', password: 'senha1234' });
    expect(res.status).toBe(409);
  });

  test('cria conta e envia e-mail de verificação (201)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT: não existe
      .mockResolvedValueOnce({ rows: [] }); // INSERT
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'Aluno@g.neec.ac.jp', password: 'senha1234' });
    expect(res.status).toBe(201);
    expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/auth/login', () => {
  const PASSWORD = 'senha1234';
  let hash;
  beforeAll(async () => {
    hash = await bcrypt.hash(PASSWORD, 10);
  });

  test('exige e-mail e senha (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: '' });
    expect(res.status).toBe(400);
  });

  test('credenciais inexistentes retornam 401', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aluno@g.neec.ac.jp', password: PASSWORD });
    expect(res.status).toBe(401);
  });

  test('conta não verificada retorna 403', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'aluno@g.neec.ac.jp', password_hash: hash, email_verified: false }]
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aluno@g.neec.ac.jp', password: PASSWORD });
    expect(res.status).toBe(403);
  });

  test('senha incorreta retorna 401', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'aluno@g.neec.ac.jp', password_hash: hash, email_verified: true, is_banned: false }]
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aluno@g.neec.ac.jp', password: 'errada9999' });
    expect(res.status).toBe(401);
  });

  test('conta banida retorna 403', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'aluno@g.neec.ac.jp', password_hash: hash, email_verified: true, is_banned: true, ban_reason: 'spam' }]
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aluno@g.neec.ac.jp', password: PASSWORD });
    expect(res.status).toBe(403);
  });

  test('login válido retorna 200 com token', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'aluno@g.neec.ac.jp', display_name: 'Aluno', password_hash: hash, email_verified: true, is_banned: false }]
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aluno@g.neec.ac.jp', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ id: 1, email: 'aluno@g.neec.ac.jp' });
  });
});

describe('POST /api/auth/forgot-password', () => {
  test('responde genericamente mesmo sem conta (anti-enumeração)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'naoexiste@g.neec.ac.jp' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/reset-password', () => {
  test('exige token (400)', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ password: 'novasenha12' });
    expect(res.status).toBe(400);
  });

  test('rejeita senha curta (400)', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'abc', password: '123' });
    expect(res.status).toBe(400);
  });

  test('token inexistente retorna 400', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'inexistente', password: 'novasenha12' });
    expect(res.status).toBe(400);
  });

  test('token expirado retorna 400', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, reset_token_expires: new Date(Date.now() - 1000) }]
    });
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'expirado', password: 'novasenha12' });
    expect(res.status).toBe(400);
  });

  test('token válido redefine a senha (200)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, reset_token_expires: new Date(Date.now() + 60000) }] }) // SELECT
      .mockResolvedValueOnce({ rows: [] }); // UPDATE
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'valido', password: 'novasenha12' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/auth/account (requireAuth)', () => {
  test('sem token retorna 401', async () => {
    const res = await request(app).delete('/api/auth/account').send({ password: 'x' });
    expect(res.status).toBe(401);
  });
});
