// Testes de integração das rotas do feed.
// Banco mockado; rate limiter neutralizado. Foco no GET público do feed e na
// proteção por autenticação das rotas de escrita.

jest.mock('../db/pool', () => ({ query: jest.fn() }));
jest.mock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));

const express = require('express');
const request = require('supertest');

const pool = require('../db/pool');
const feedRoutes = require('../modules/feed/feedRoutes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/feed', feedRoutes);
  return app;
}

const app = buildApp();

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /api/feed/posts', () => {
  test('retorna posts e hasMore=false quando vêm menos que o limite', async () => {
    const rows = [
      { id: 2, content: 'olá', like_count: 0, comment_count: 0 },
      { id: 1, content: 'mundo', like_count: 3, comment_count: 1 }
    ];
    pool.query.mockResolvedValueOnce({ rows });
    const res = await request(app).get('/api/feed/posts');
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(2);
    expect(res.body.hasMore).toBe(false);
  });

  test('hasMore=true quando retorna exatamente o limite (20)', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, content: `p${i}` }));
    pool.query.mockResolvedValueOnce({ rows });
    const res = await request(app).get('/api/feed/posts?page=1');
    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(true);
  });

  test('erro no banco retorna 500', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get('/api/feed/posts');
    expect(res.status).toBe(500);
  });
});

describe('Rotas protegidas exigem autenticação', () => {
  test('POST /api/feed/posts sem token → 401', async () => {
    const res = await request(app).post('/api/feed/posts').send({ content: 'x' });
    expect(res.status).toBe(401);
  });

  test('POST /api/feed/posts/1/like sem token → 401', async () => {
    const res = await request(app).post('/api/feed/posts/1/like');
    expect(res.status).toBe(401);
  });

  test('DELETE /api/feed/posts/1 sem token → 401', async () => {
    const res = await request(app).delete('/api/feed/posts/1');
    expect(res.status).toBe(401);
  });
});
