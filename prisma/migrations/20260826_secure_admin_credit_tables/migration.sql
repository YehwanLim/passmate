-- credit_coupons 와 admin_credit_grants 는 20260723_add_security_primitives 가
-- 하드코딩한 기본 거부 목록보다 뒤(20260726)에 생성되어 RLS 활성화와
-- anon/authenticated 권한 회수에서 누락됐다. admin_credit_grants 는 지급 시점의
-- 이메일 스냅샷을 보관하므로, Supabase Data API 가 다시 켜지는 순간 노출된다.
-- 나머지 애플리케이션 테이블과 동일한 기본 거부 상태로 맞춘다.
DO $$
DECLARE
  application_table TEXT;
  policy_name TEXT;
BEGIN
  FOREACH application_table IN ARRAY ARRAY[
    'credit_coupons',
    'admin_credit_grants'
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
