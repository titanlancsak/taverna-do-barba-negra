CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL, -- 'like', 'comment', 'friend_request', 'friend_accept', 'group_invite', 'message'
  reference_id INTEGER, -- id do post/friendship/group relacionado; para 'message' é o id do remetente
  message TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at DESC);
