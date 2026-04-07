-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Settings table for app configuration
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default: Discord enabled
INSERT INTO settings (key, value) VALUES ('discord_enabled', 'true')
  ON CONFLICT (key) DO NOTHING;

-- RLS policies
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all settings" ON settings FOR ALL USING (true) WITH CHECK (true);
