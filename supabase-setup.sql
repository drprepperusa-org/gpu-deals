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

-- GPU listings found by scanner
CREATE TABLE IF NOT EXISTS gpu_listings (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  price_per_unit NUMERIC DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  gpu_model TEXT,
  condition TEXT,
  seller TEXT,
  link TEXT UNIQUE,
  source TEXT,
  score INTEGER DEFAULT 0,
  found_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gpu_listings_found ON gpu_listings(found_at);
CREATE INDEX IF NOT EXISTS idx_gpu_listings_link ON gpu_listings(link);

ALTER TABLE gpu_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all gpu_listings" ON gpu_listings FOR ALL USING (true) WITH CHECK (true);

-- GPU company leads
CREATE TABLE IF NOT EXISTS gpu_leads (
  id SERIAL PRIMARY KEY,
  company TEXT NOT NULL,
  website TEXT UNIQUE,
  type TEXT,
  description TEXT,
  location TEXT,
  gpu_models TEXT,
  priority TEXT DEFAULT 'Medium',
  notes TEXT,
  found_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gpu_leads_found ON gpu_leads(found_at);

ALTER TABLE gpu_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all gpu_leads" ON gpu_leads FOR ALL USING (true) WITH CHECK (true);
