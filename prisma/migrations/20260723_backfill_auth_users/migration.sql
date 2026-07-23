-- Existing OAuth identities predate the server-only profile boundary. Backfill
-- them once so removing browser-side users upserts does not lock them out.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    INSERT INTO public.users (id, email, name, avatar_url)
    SELECT
      id,
      email,
      COALESCE(raw_user_meta_data ->> 'name', raw_user_meta_data ->> 'full_name'),
      raw_user_meta_data ->> 'avatar_url'
    FROM auth.users
    WHERE email IS NOT NULL
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;
