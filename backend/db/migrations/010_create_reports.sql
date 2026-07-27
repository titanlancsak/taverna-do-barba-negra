-- Sistema de denúncias: usuários denunciam posts ou comentários; admin modera.
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL,            -- 'post' | 'comment'
  target_id INTEGER NOT NULL,
  reason VARCHAR(20) NOT NULL,                 -- 'spam' | 'offense' | 'inappropriate' | 'other'
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved' | 'dismissed'
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  -- Cada usuário só denuncia o mesmo item uma vez
  UNIQUE(reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
