-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Dedup cache: tracks posted listing links
CREATE TABLE IF NOT EXISTS dedup_cache (
  link TEXT PRIMARY KEY,
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup: delete entries older than 24h
CREATE OR REPLACE FUNCTION cleanup_dedup() RETURNS void AS $$
  DELETE FROM dedup_cache WHERE posted_at < NOW() - INTERVAL '24 hours';
$$ LANGUAGE sql;

-- Listing history: all deals ever found
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  quantity INTEGER DEFAULT 1,
  gpu_model TEXT,
  source TEXT DEFAULT 'ebay',
  seller TEXT,
  condition TEXT,
  link TEXT UNIQUE,
  found_at TIMESTAMPTZ DEFAULT NOW()
);

-- News items scraped
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  headline TEXT NOT NULL,
  source TEXT,
  link TEXT,
  time_label TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_dedup_posted ON dedup_cache(posted_at);
CREATE INDEX IF NOT EXISTS idx_listings_found ON listings(found_at);
CREATE INDEX IF NOT EXISTS idx_news_scraped ON news(scraped_at);
