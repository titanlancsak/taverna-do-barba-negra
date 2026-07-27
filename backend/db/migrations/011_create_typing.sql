-- Typing Game: resultados (WPM/precisão/erros), ranking, histórico, desafio diário e conquistas.
CREATE TABLE IF NOT EXISTS typing_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,        -- 'en' | 'ja'
  category VARCHAR(20) NOT NULL,        -- 'linux' | 'sql' | 'python' | 'java' | 'aws' | 'cisco'
  wpm INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,            -- 0-100
  errors INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  is_daily BOOLEAN NOT NULL DEFAULT FALSE,
  daily_date DATE,                      -- preenchido quando is_daily
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_typing_results_user ON typing_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_typing_results_wpm ON typing_results(wpm DESC);
CREATE INDEX IF NOT EXISTS idx_typing_results_daily ON typing_results(daily_date, wpm DESC);

CREATE TABLE IF NOT EXISTS typing_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key VARCHAR(40) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, achievement_key)
);
