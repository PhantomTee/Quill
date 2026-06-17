-- Reputation columns for agents table
-- Run in Supabase SQL editor: https://app.supabase.com → SQL Editor

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS success_count  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_payers  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stake_amount_usdc numeric(18,6) DEFAULT 0;

-- success_rate as a computed column (view-friendly)
-- Returns 0–100.00 (two decimal places)
CREATE OR REPLACE FUNCTION agent_success_rate(p_agent_id integer)
RETURNS numeric AS $$
  SELECT
    CASE WHEN total_calls = 0 THEN 0
    ELSE ROUND((success_count::numeric / total_calls::numeric) * 100, 2)
    END
  FROM agents WHERE agent_id = p_agent_id;
$$ LANGUAGE sql STABLE;

-- Update increment_agent_stats RPC to also track success_count
CREATE OR REPLACE FUNCTION increment_agent_stats(
  p_agent_id integer,
  p_amount   numeric,
  p_success  boolean DEFAULT true
)
RETURNS void AS $$
BEGIN
  UPDATE agents
  SET
    total_calls   = total_calls + 1,
    total_revenue = total_revenue + p_amount,
    success_count = success_count + CASE WHEN p_success THEN 1 ELSE 0 END
  WHERE agent_id = p_agent_id;
END;
$$ LANGUAGE plpgsql;
