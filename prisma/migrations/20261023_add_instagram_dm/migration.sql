-- 인스타 댓글 키워드 자동 DM: 댓글 하나당 발송 기록 한 줄 + 인스타 API 장기 토큰(단일 행).
-- 새 enum·표만 만든다. 기존 데이터는 건드리지 않는다. 댓글 본문·사용자 이름은 저장하지 않는다.
CREATE TYPE instagram_dm_status AS ENUM ('SENDING', 'GATE_SENT', 'LINK_SENT', 'FAILED');

CREATE TABLE instagram_dm_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id VARCHAR(64) NOT NULL UNIQUE,
  media_id VARCHAR(64),
  igsid VARCHAR(64),
  keyword VARCHAR(50) NOT NULL,
  notion_page_id VARCHAR(64) NOT NULL,
  resource_title VARCHAR(200) NOT NULL,
  resource_url VARCHAR(500) NOT NULL,
  status instagram_dm_status NOT NULL DEFAULT 'SENDING',
  follow_checks INTEGER NOT NULL DEFAULT 0,
  failure_code VARCHAR(64),
  link_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX instagram_dm_deliveries_igsid_status_created_at_idx
  ON instagram_dm_deliveries (igsid, status, created_at);
CREATE INDEX instagram_dm_deliveries_created_at_idx ON instagram_dm_deliveries (created_at);

CREATE TABLE instagram_credentials (
  id VARCHAR(16) PRIMARY KEY DEFAULT 'singleton',
  account_id VARCHAR(64) NOT NULL,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 나머지 애플리케이션 테이블과 같은 기본 거부 상태로 맞춘다(서버 API 로만 읽고 쓴다).
ALTER TABLE instagram_dm_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_credentials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE instagram_dm_deliveries FROM anon;
    REVOKE ALL PRIVILEGES ON TABLE instagram_credentials FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE instagram_dm_deliveries FROM authenticated;
    REVOKE ALL PRIVILEGES ON TABLE instagram_credentials FROM authenticated;
  END IF;
END
$$;
