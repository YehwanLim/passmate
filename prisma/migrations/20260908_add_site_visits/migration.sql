-- 페이지 방문 기록. 대시보드의 "오늘 방문자"·"현재 온라인"이 지금까지는 analyses 테이블
-- (분석을 실제로 돌린 사람)로 대신 세고 있어서, 분석 없이 둘러보기만 한 방문은 0 으로 보였다.
-- visitor_id 는 브라우저가 만든 무작위 ID, user_id 는 로그인 상태였을 때만 채운다.
CREATE TABLE site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id VARCHAR(64) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  path VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX site_visits_created_at_idx ON site_visits (created_at);
CREATE INDEX site_visits_user_id_idx ON site_visits (user_id);

-- 나머지 애플리케이션 테이블과 같은 기본 거부 상태로 맞춘다.
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE site_visits FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE site_visits FROM authenticated;
  END IF;
END
$$;
