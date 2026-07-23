-- Claim a due account before deleting its external Supabase identity. This
-- prevents a concurrent user cancellation from succeeding after identity loss.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS purge_claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_purge_claimed_at
  ON public.users (purge_claimed_at)
  WHERE purge_claimed_at IS NOT NULL;
