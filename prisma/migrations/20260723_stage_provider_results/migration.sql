-- Store a completed provider result before final report/token persistence. A
-- retry with the same idempotency key can finish this state without re-calling
-- the model after a transaction failure.
ALTER TABLE public.analysis_requests
  ADD COLUMN IF NOT EXISTS provider_result JSONB,
  ADD COLUMN IF NOT EXISTS provider_metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_analysis_requests_user_hash_status
  ON public.analysis_requests (user_id, request_hash, status);

-- A short-lived deployment may have written PERSISTENCE_PENDING before the
-- staged-result columns existed. Those rows are known to have crossed the
-- provider boundary but cannot be recovered safely, so consume their reserved
-- credit rather than risk a duplicate paid invocation.
WITH invalid_requests AS (
  UPDATE public.analysis_requests
  SET status = 'FAILED'
  WHERE status = 'PERSISTENCE_PENDING'
    AND (provider_result IS NULL OR provider_metadata IS NULL)
  RETURNING analysis_id, reservation_id, user_id
), consumed_reservations AS (
  UPDATE public.analysis_reservations AS reservation
  SET status = 'CONSUMED', finalized_at = NOW()
  FROM invalid_requests AS invalid
  WHERE reservation.id = invalid.reservation_id
    AND reservation.user_id = invalid.user_id
    AND reservation.status = 'PENDING'
  RETURNING reservation.id
), failed_analyses AS (
  UPDATE public.analyses AS analysis
  SET status = 'FAILED', error_code = 'API_ERROR', error_message = NULL
  FROM invalid_requests AS invalid
  WHERE analysis.id = invalid.analysis_id
    AND analysis.user_id = invalid.user_id
    AND analysis.status = 'PENDING'
  RETURNING analysis.id
)
INSERT INTO public.audit_events (actor_id, target_type, target_id, outcome, request_id)
SELECT NULL, 'analysis', invalid.analysis_id::text, 'RECONCILIATION_CONSUMED', 'migration-stage-provider-results'
FROM invalid_requests AS invalid
WHERE invalid.analysis_id IS NOT NULL;
