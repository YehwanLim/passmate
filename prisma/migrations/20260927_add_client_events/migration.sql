-- 로그인이 왜 안 되는지 보기 위한 두 가지 기록.
-- 1) site_visits.in_app_browser: 첫 방문 핑에 실리는 인앱 브라우저 종류(kakaotalk·instagram·threads…). Google 은
--    앱 안의 WebView 에서 로그인을 막으므로, 유입원별로 몇 명이 그 상태로 들어오는지 알아야 한다.
-- 2) client_events: 로그인 화면에서 생기는 실패·노출 이벤트. 방문(페이지뷰)과 섞이지 않게 표를 따로 둔다.
--    자소서 본문·이메일·토큰은 넣지 않는다. detail 은 짧은 코드나 오류 문구 앞부분만.
ALTER TABLE site_visits
  ADD COLUMN in_app_browser VARCHAR(32);

CREATE TABLE client_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id VARCHAR(64) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(48) NOT NULL,
  detail VARCHAR(120),
  in_app_browser VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX client_events_name_created_at_idx ON client_events (name, created_at);
CREATE INDEX client_events_created_at_idx ON client_events (created_at);

-- 나머지 애플리케이션 테이블과 같은 기본 거부 상태로 맞춘다.
ALTER TABLE client_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE client_events FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE client_events FROM authenticated;
  END IF;
END
$$;
