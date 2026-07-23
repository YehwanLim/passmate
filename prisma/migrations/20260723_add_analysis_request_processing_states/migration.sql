-- Distinguish a request that has reached an external model from one that has
-- only reserved a credit. Completed-provider work must not be auto-refunded.
DO $$
BEGIN
  -- This migration alphabetically precedes the primitive-table migration on a
  -- fresh database. Existing deployments already have the type and receive
  -- the new states here; fresh deployments create all states in that later
  -- table-creation migration instead.
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analysis_request_status') THEN
    ALTER TYPE analysis_request_status ADD VALUE IF NOT EXISTS 'CALLING';
    ALTER TYPE analysis_request_status ADD VALUE IF NOT EXISTS 'PERSISTENCE_PENDING';
  END IF;
END
$$;
