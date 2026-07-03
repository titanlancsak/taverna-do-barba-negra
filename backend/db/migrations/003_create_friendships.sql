CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
