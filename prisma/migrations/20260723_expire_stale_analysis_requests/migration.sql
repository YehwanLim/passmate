-- A serverless invocation can terminate after reservation allocation. Keep the
-- recovery window short so a stranded PENDING request cannot consume a credit.
ALTER TABLE public.analysis_requests
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '10 minutes');
