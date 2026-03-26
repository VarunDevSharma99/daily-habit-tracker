-- ============================================================
-- Daily Habit Tracker + Life Score — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Table 1: daily_entries (one row per calendar date)
CREATE TABLE daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  sleep INT CHECK (sleep BETWEEN 1 AND 5),
  exercise INT CHECK (exercise BETWEEN 0 AND 3),
  eating INT CHECK (eating BETWEEN 1 AND 4),
  work_start BOOLEAN NOT NULL DEFAULT false,
  shaper_work BOOLEAN NOT NULL DEFAULT false,
  kids_time BOOLEAN NOT NULL DEFAULT false,
  meditation BOOLEAN NOT NULL DEFAULT false,
  gratitude BOOLEAN NOT NULL DEFAULT false,
  daily_score INT CHECK (daily_score BETWEEN 0 AND 100),
  source TEXT NOT NULL DEFAULT 'telegram' CHECK (source IN ('telegram', 'web')),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_skipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast date lookups
CREATE INDEX idx_daily_entries_date ON daily_entries(date DESC);

-- Table 2: streaks (one row per streak type)
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streak_type TEXT NOT NULL UNIQUE CHECK (streak_type IN (
    'checkin', 'sleep', 'exercise', 'eating', 'work_start',
    'shaper', 'kids', 'meditation', 'gratitude', 'solid_day'
  )),
  current_count INT NOT NULL DEFAULT 0,
  best_count INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed all 10 streak types
INSERT INTO streaks (streak_type) VALUES
  ('checkin'), ('sleep'), ('exercise'), ('eating'), ('work_start'),
  ('shaper'), ('kids'), ('meditation'), ('gratitude'), ('solid_day');

-- Table 3: bot_state (single-row state machine)
CREATE TABLE bot_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_question INT NOT NULL DEFAULT 0 CHECK (current_question BETWEEN 0 AND 8),
  today_responses JSONB NOT NULL DEFAULT '{}',
  nudge_sent BOOLEAN NOT NULL DEFAULT false,
  last_quote_id INT NOT NULL DEFAULT 0,
  checkin_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the single bot_state row
INSERT INTO bot_state (id) VALUES (1);

-- ============================================================
-- Row Level Security (RLS) — lock it down
-- ============================================================

ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_state ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (our serverless functions use service key)
CREATE POLICY "Service role full access" ON daily_entries
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON streaks
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON bot_state
  FOR ALL USING (true) WITH CHECK (true);

-- Anon key can only read (for the dashboard)
CREATE POLICY "Anon read daily_entries" ON daily_entries
  FOR SELECT USING (true);
CREATE POLICY "Anon read streaks" ON streaks
  FOR SELECT USING (true);
CREATE POLICY "Anon read bot_state" ON bot_state
  FOR SELECT USING (true);
