-- Mission Control 2.0 Database Schema
-- Created: February 13, 2026
-- 
-- This migration adds tables for:
-- - Goals (hierarchical goal tracking)
-- - Pipeline (CRM)
-- - Loops (stalled items detection)
-- - Decisions (decision log with reviews)
-- - Captures (Second Brain)
-- - Calendar Events (cached from Google)

-- ============================================
-- GOALS TABLE (Hierarchical)
-- ============================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  level TEXT CHECK (level IN ('north_star', 'quarterly', 'monthly', 'weekly')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'pivoted', 'abandoned')),
  target_value NUMERIC,
  current_value NUMERIC,
  unit TEXT,  -- 'dollars', 'clients', 'percent', etc.
  target_date DATE,
  parent_goal_id UUID REFERENCES goals(id),
  pivot_reason TEXT,
  achieved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- GOAL REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS goal_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  notes TEXT,
  still_relevant BOOLEAN,
  adjustments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PIPELINE TABLE (CRM)
-- ============================================
CREATE TABLE IF NOT EXISTS pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  stage TEXT DEFAULT 'lead' CHECK (stage IN ('lead', 'contacted', 'meeting_booked', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  deal_value NUMERIC,
  deal_type TEXT,  -- 'coaching', 'mastermind', 'intensive', 'product'
  probability INTEGER DEFAULT 0,  -- 0-100
  next_action TEXT,
  next_action_date DATE,
  last_contact TIMESTAMP,
  notes TEXT,
  source TEXT,  -- where lead came from
  assigned_to TEXT DEFAULT 'matthew',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

-- ============================================
-- LOOPS TABLE (Things to Close)
-- ============================================
CREATE TABLE IF NOT EXISTS loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('stalled_task', 'unanswered_message', 'incomplete_project', 'unreviewed_decision', 'stale_opportunity')),
  reference_type TEXT,  -- 'task', 'pipeline', 'decision', etc.
  reference_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  stale_since TIMESTAMP NOT NULL,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DECISIONS TABLE (With Review Dates)
-- ============================================
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  context TEXT,  -- why was this decision made?
  alternatives_considered TEXT,
  made_by TEXT DEFAULT 'matthew',
  made_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  review_at TIMESTAMP,  -- when to revisit
  reviewed_at TIMESTAMP,
  outcome TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'reviewed', 'reversed', 'superseded')),
  tags TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CAPTURES TABLE (Second Brain)
-- ============================================
CREATE TABLE IF NOT EXISTS captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('idea', 'note', 'insight', 'resource', 'quote', 'task', 'question')),
  tags TEXT[],
  source TEXT,  -- where it came from (chat, email, call, etc.)
  source_date TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  linked_to_type TEXT,  -- 'goal', 'decision', 'pipeline', etc.
  linked_to_id UUID,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CALENDAR EVENTS CACHE
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  location TEXT,
  attendees TEXT[],
  event_type TEXT,  -- 'meeting', 'call', 'deep_work', 'personal'
  is_blocked BOOLEAN DEFAULT FALSE,  -- Aaron-suggested block
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MODIFY EXISTING ACTIVITY_FEED TABLE
-- (Add columns if they don't exist)
-- ============================================
DO $$ 
BEGIN
  -- Add reference_type column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_feed' AND column_name = 'reference_type') THEN
    ALTER TABLE activity_feed ADD COLUMN reference_type TEXT;
  END IF;
  
  -- Add reference_id column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_feed' AND column_name = 'reference_id') THEN
    ALTER TABLE activity_feed ADD COLUMN reference_id UUID;
  END IF;
  
  -- Add metadata column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_feed' AND column_name = 'metadata') THEN
    ALTER TABLE activity_feed ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Activity Feed indexes
CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_type ON activity_feed(type);

-- Goals indexes
CREATE INDEX IF NOT EXISTS idx_goals_level ON goals(level);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);

-- Pipeline indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_next_action ON pipeline(next_action_date) WHERE stage NOT IN ('closed_won', 'closed_lost');
CREATE INDEX IF NOT EXISTS idx_pipeline_last_contact ON pipeline(last_contact);

-- Loops indexes
CREATE INDEX IF NOT EXISTS idx_loops_status ON loops(status);
CREATE INDEX IF NOT EXISTS idx_loops_stale ON loops(stale_since) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_loops_urgency ON loops(urgency) WHERE status = 'open';

-- Decisions indexes
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_review ON decisions(review_at) WHERE status = 'active';

-- Captures indexes
CREATE INDEX IF NOT EXISTS idx_captures_processed ON captures(processed);
CREATE INDEX IF NOT EXISTS idx_captures_type ON captures(type);
CREATE INDEX IF NOT EXISTS idx_captures_priority ON captures(priority) WHERE processed = FALSE;

-- Calendar indexes
CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_google_id ON calendar_events(google_event_id);

-- ============================================
-- FULL-TEXT SEARCH INDEXES
-- ============================================

-- Activity Feed search
CREATE INDEX IF NOT EXISTS idx_activity_feed_search ON activity_feed 
  USING GIN (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '')));

-- Pipeline search
CREATE INDEX IF NOT EXISTS idx_pipeline_search ON pipeline 
  USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(notes, '') || ' ' || COALESCE(company, '')));

-- Decisions search
CREATE INDEX IF NOT EXISTS idx_decisions_search ON decisions 
  USING GIN (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(context, '')));

-- Captures search
CREATE INDEX IF NOT EXISTS idx_captures_search ON captures 
  USING GIN (to_tsvector('english', COALESCE(content, '')));

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES (Allow all for service role, read for anon)
-- ============================================

-- Goals policies
CREATE POLICY "Allow all for service role" ON goals FOR ALL USING (true);
CREATE POLICY "Allow read for anon" ON goals FOR SELECT USING (true);

-- Goal Reviews policies
CREATE POLICY "Allow all for service role" ON goal_reviews FOR ALL USING (true);
CREATE POLICY "Allow read for anon" ON goal_reviews FOR SELECT USING (true);

-- Pipeline policies
CREATE POLICY "Allow all for service role" ON pipeline FOR ALL USING (true);
CREATE POLICY "Allow read for anon" ON pipeline FOR SELECT USING (true);

-- Loops policies
CREATE POLICY "Allow all for service role" ON loops FOR ALL USING (true);
CREATE POLICY "Allow read for anon" ON loops FOR SELECT USING (true);

-- Decisions policies
CREATE POLICY "Allow all for service role" ON decisions FOR ALL USING (true);
CREATE POLICY "Allow read for anon" ON decisions FOR SELECT USING (true);

-- Captures policies
CREATE POLICY "Allow all for service role" ON captures FOR ALL USING (true);
CREATE POLICY "Allow read for anon" ON captures FOR SELECT USING (true);

-- Calendar Events policies
CREATE POLICY "Allow all for service role" ON calendar_events FOR ALL USING (true);
CREATE POLICY "Allow read for anon" ON calendar_events FOR SELECT USING (true);

-- ============================================
-- ENABLE REALTIME FOR NEW TABLES
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE goals;
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline;
ALTER PUBLICATION supabase_realtime ADD TABLE loops;
ALTER PUBLICATION supabase_realtime ADD TABLE decisions;
ALTER PUBLICATION supabase_realtime ADD TABLE captures;

-- ============================================
-- SEED INITIAL GOALS (September Transformation)
-- ============================================
INSERT INTO goals (title, description, level, status, target_value, current_value, unit, target_date) VALUES
  ('September Transformation', 'Reduce to boutique model: Kristen 20%, Matthew 30%, $40k MRR', 'north_star', 'active', 100, 68, 'percent', '2026-09-01'),
  ('$40k Monthly Recurring Revenue', 'Reach $40,000 MRR through coaching + mastermind', 'quarterly', 'active', 40000, 21666, 'dollars', '2026-06-30'),
  ('10 Coaching Clients', 'Fill coaching roster to 10 active clients at $4k/month', 'quarterly', 'active', 10, 6, 'clients', '2026-06-30'),
  ('Kristen to 20% Time', 'Reduce Kristen''s MFI involvement to 20% of her time', 'quarterly', 'active', 20, 35, 'percent', '2026-09-01')
ON CONFLICT DO NOTHING;

-- Link quarterly goals to north star
UPDATE goals SET parent_goal_id = (SELECT id FROM goals WHERE level = 'north_star' LIMIT 1) 
WHERE level = 'quarterly' AND parent_goal_id IS NULL;

-- ============================================
-- SEED CURRENT PIPELINE DATA
-- ============================================
INSERT INTO pipeline (name, stage, deal_value, deal_type, probability, next_action, next_action_date, notes) VALUES
  ('Nikolaj Albinus', 'meeting_booked', 4000, 'coaching', 70, 'Discovery call', '2026-02-16', 'Booked for Sun 9:30am'),
  ('Jeff Beggins', 'meeting_booked', 4000, 'coaching', 70, 'Discovery call', '2026-02-17', 'Booked for Monday'),
  ('Johan Wedellsborg', 'contacted', 0, 'partnership', 50, 'Follow up - no response 5 days', '2026-02-14', 'Sent times, waiting for response'),
  ('Mark Thompson', 'lead', 0, 'mastermind', 30, 'Initial outreach', NULL, 'Interested in mastermind')
ON CONFLICT DO NOTHING;

COMMIT;
