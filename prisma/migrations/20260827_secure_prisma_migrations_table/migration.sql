-- _prisma_migrations 는 Prisma 가 만든 기록 테이블이라 지금까지 어떤 마이그레이션도
-- 손대지 않았다. 그 결과 나머지 테이블을 전부 기본 거부로 맞춘 뒤에도 이 테이블만
-- anon/authenticated 권한을 유지하고 RLS 도 꺼진 채 남았다.
-- 기록 내용 자체는 민감하지 않지만, Data API 가 켜지면 anon 이 이 표를 쓸 수 있고
-- 그러면 이후 배포의 마이그레이션 판정이 망가진다. 나머지와 같은 상태로 맞춘다.
-- 소유자(postgres)는 FORCE 가 아닌 RLS 를 우회하므로 Prisma 접근은 그대로 유지된다.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY';

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations FROM authenticated';
  END IF;
END
$$;
