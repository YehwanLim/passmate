-- Server-side Prisma is the trusted data boundary. These tables deliberately
-- have default-deny RLS and no browser-facing policies. Do not use FORCE ROW
-- LEVEL SECURITY: the current server Prisma connection owns these tables and
-- must retain its trusted server-only access.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_purge_at
  ON public.users (purge_at)
  WHERE purge_at IS NOT NULL;

ALTER TABLE public.entitlement_settings
  ADD COLUMN IF NOT EXISTS analysis_enabled BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analysis_request_status') THEN
    CREATE TYPE analysis_request_status AS ENUM ('PENDING', 'CALLING', 'PERSISTENCE_PENDING', 'SUCCEEDED', 'FAILED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.analysis_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(255) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status analysis_request_status NOT NULL DEFAULT 'PENDING',
  reservation_id UUID UNIQUE REFERENCES public.analysis_reservations(id) ON DELETE SET NULL,
  analysis_id UUID UNIQUE REFERENCES public.analyses(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_analysis_requests_user_idempotency_key UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_analysis_requests_user_status
  ON public.analysis_requests (user_id, status);
CREATE INDEX IF NOT EXISTS idx_analysis_requests_expires_at
  ON public.analysis_requests (expires_at);

CREATE TABLE IF NOT EXISTS public.api_rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_key VARCHAR(320) NOT NULL,
  route VARCHAR(100) NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_api_rate_limit_buckets_subject_route_window
    UNIQUE (subject_key, route, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_buckets_window_start
  ON public.api_rate_limit_buckets (window_start);

CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      WHEN (NEW.email IS NOT NULL)
      EXECUTE FUNCTION public.handle_auth_user_created();
  END IF;
END
$$;

DO $$
DECLARE
  application_table TEXT;
  policy_name TEXT;
BEGIN
  FOREACH application_table IN ARRAY ARRAY[
    'users',
    'entitlement_settings',
    'analysis_entitlements',
    'analysis_reservations',
    'purchase_intents',
    'payment_entitlements',
    'user_api_keys',
    'projects',
    'analyses',
    'prompt_templates',
    'token_usages',
    'feedbacks',
    'analysis_requests',
    'api_rate_limit_buckets'
  ]
  LOOP
    IF to_regclass(format('public.%I', application_table)) IS NULL THEN
      CONTINUE;
    END IF;

    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = application_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, application_table);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', application_table);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', application_table, 'anon');
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', application_table, 'authenticated');
    END IF;
  END LOOP;
END
$$;
