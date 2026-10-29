// Variáveis de ambiente exigidas pelos controllers no momento do require.
// Rodam antes de qualquer módulo de teste ser carregado (jest setupFiles),
// então os controllers leem esses valores em vez de depender de um .env real.
process.env.EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || 'g.neec.ac.jp';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.NODE_ENV = 'test';
