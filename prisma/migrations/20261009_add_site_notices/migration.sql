-- 사이트 공지: 관리자가 켜고 끄는 팝업(들어오면 뜨는 창)과 배너(화면 맨 위 띠).
-- 새 표만 만든다. 기존 데이터는 건드리지 않는다.
CREATE TABLE site_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('POPUP', 'BANNER')),
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link_url VARCHAR(500),
  link_label VARCHAR(30),
  image_url VARCHAR(500),
  active BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX site_notices_kind_active_idx ON site_notices (kind, active);

-- 나머지 애플리케이션 테이블과 같은 기본 거부 상태로 맞춘다(읽기는 서버 API 로만).
ALTER TABLE site_notices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE site_notices FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE site_notices FROM authenticated;
  END IF;
END
$$;
