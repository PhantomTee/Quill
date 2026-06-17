-- Agent ratings table
-- Run in Supabase SQL editor: https://app.supabase.com → SQL Editor

CREATE TABLE IF NOT EXISTS agent_ratings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    integer     NOT NULL,
  payer       text        NOT NULL,
  stars       smallint    NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment     text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (agent_id, payer)
);

CREATE INDEX IF NOT EXISTS agent_ratings_agent_id_idx ON agent_ratings (agent_id);

-- Enable Row Level Security (read-only public access)
ALTER TABLE agent_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON agent_ratings
  FOR SELECT USING (true);

CREATE POLICY "Service role write" ON agent_ratings
  FOR ALL USING (auth.role() = 'service_role');
