-- Keep a short, non-sensitive security audit trail.  The application purges
-- records older than 90 days through the protected daily cron route.
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(255),
  outcome VARCHAR(64) NOT NULL,
  request_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at
  ON public.audit_events (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created_at
  ON public.audit_events (actor_id, created_at);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.audit_events FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.audit_events FROM authenticated;
  END IF;
END
$$;
