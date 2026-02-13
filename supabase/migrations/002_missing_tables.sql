-- Mission Control 2.0 - Missing Tables Only
-- Run this in Supabase Dashboard SQL Editor
-- https://supabase.com/dashboard/project/zaftqupxuuirnegmyznk/sql/new

-- GOAL REVIEWS TABLE
CREATE TABLE IF NOT EXISTS goal_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  notes TEXT,
  still_relevant BOOLEAN,
  adjustments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LOOPS TABLE (Things to Close)
CREATE TABLE IF NOT EXISTS loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('stalled_task', 'unanswered_message', 'incomplete_project', 'unreviewed_decision', 'stale_opportunity')),
  reference_type TEXT,
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

-- DECISIONS TABLE
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  context TEXT,
  alternatives_considered TEXT,
  made_by TEXT DEFAULT 'matthew',
  made_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  review_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  outcome TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'reviewed', 'reversed', 'superseded')),
  tags TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CAPTURES TABLE (Second Brain)
CREATE TABLE IF NOT EXISTS captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('idea', 'note', 'insight', 'resource', 'quote', 'task', 'question')),
  tags TEXT[],
  source TEXT,
  source_date TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  linked_to_type TEXT,
  linked_to_id UUID,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CALENDAR EVENTS CACHE
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  location TEXT,
  attendees TEXT[],
  event_type TEXT,
  is_blocked BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ADD COLUMNS TO ACTIVITY_FEED IF MISSING
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_feed' AND column_name = 'reference_type') THEN
    ALTER TABLE activity_feed ADD COLUMN reference_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_feed' AND column_name = 'reference_id') THEN
    ALTER TABLE activity_feed ADD COLUMN reference_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_feed' AND column_name = 'metadata') THEN
    ALTER TABLE activity_feed ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_loops_status ON loops(status);
CREATE INDEX IF NOT EXISTS idx_loops_urgency ON loops(urgency) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_review ON decisions(review_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_captures_processed ON captures(processed);
CREATE INDEX IF NOT EXISTS idx_captures_type ON captures(type);
CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_time);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE goal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (allow all access for now)
CREATE POLICY "Enable all access" ON goal_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON loops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON decisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON captures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON calendar_events FOR ALL USING (true) WITH CHECK (true);

-- ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE loops;
ALTER PUBLICATION supabase_realtime ADD TABLE decisions;
ALTER PUBLICATION supabase_realtime ADD TABLE captures;
