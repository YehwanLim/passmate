-- 보안 감사(10-15) SEC-19: Supabase 기본값은 postgres 가 public 에 새로 만드는 테이블·시퀀스·함수에
-- anon/authenticated 전체 권한을 자동으로 준다. 지금까지는 마이그레이션마다 REVOKE 문단을 손으로 넣어 막았다.
-- 그 문단을 빠뜨려도 새 객체가 공개 역할에 열리지 않도록 기본 권한 자체를 거둔다(서버는 postgres 로 접속해 영향 없음).
-- supabase_admin 의 기본값은 postgres 가 바꿀 수 없어 그대로 둔다 — 앱 테이블은 Prisma(postgres)가 만든다.
-- 트리거 전용 SECURITY DEFINER 함수. 트리거 실행에는 EXECUTE 권한이 필요 없어 PUBLIC 에서도 거둔다.
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_created() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
    REVOKE EXECUTE ON FUNCTION public.handle_auth_user_created() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;
    REVOKE EXECUTE ON FUNCTION public.handle_auth_user_created() FROM authenticated;
  END IF;
END
$$;
