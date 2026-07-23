-- Store a completed provider result before final report/token persistence. A
-- retry with the same idempotency key can finish this state without re-calling
-- the model after a transaction failure.
ALTER TABLE public.analysis_requests
  ADD COLUMN IF NOT EXISTS provider_result JSONB,
  ADD COLUMN IF NOT EXISTS provider_metadata JSONB;
