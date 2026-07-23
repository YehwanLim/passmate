-- AI model routing is runtime configuration, not a local serverless file.
CREATE TABLE IF NOT EXISTS public.ai_model_settings (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'singleton',
  default_provider_key VARCHAR(32) NOT NULL DEFAULT 'gemini',
  default_model_name VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5-flash-lite',
  fallback_provider_key VARCHAR(32),
  fallback_model_name VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ai_model_settings (id)
VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ai_model_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.ai_model_settings FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.ai_model_settings FROM authenticated;
  END IF;
END
$$;
