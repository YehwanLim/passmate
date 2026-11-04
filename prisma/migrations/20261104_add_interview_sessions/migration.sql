-- AI 면접 연습. 세션과 발언(자동 받아쓰기)을 저장한다. 음성·영상·사진은 저장하지 않는다.
-- 스위치 기본값이 꺼짐이라 이 마이그레이션만으로는 사용자에게 아무것도 보이지 않는다.
ALTER TABLE entitlement_settings ADD COLUMN interview_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE analysis_entitlements ADD COLUMN interview_credits_granted INTEGER NOT NULL DEFAULT 0;

CREATE TYPE interview_session_status AS ENUM ('CREATED', 'ACTIVE', 'ENDED', 'INTERRUPTED', 'CANCELLED');
CREATE TYPE interview_feedback_status AS ENUM ('NONE', 'PENDING', 'CALLING', 'SUCCEEDED', 'FAILED');
CREATE TYPE interview_speaker AS ENUM ('CANDIDATE', 'INTERVIEWER');
CREATE TYPE interview_mode AS ENUM ('FULL', 'SHORT');

CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  reservation_id UUID UNIQUE REFERENCES analysis_reservations(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  mode interview_mode NOT NULL DEFAULT 'FULL',
  status interview_session_status NOT NULL DEFAULT 'CREATED',
  live_model VARCHAR(100) NOT NULL,
  prompt_version VARCHAR(40) NOT NULL,
  consent_version VARCHAR(40) NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  first_token_at TIMESTAMPTZ,
  hard_deadline_at TIMESTAMPTZ,
  token_issue_count INTEGER NOT NULL DEFAULT 0,
  ended_at TIMESTAMPTZ,
  end_reason VARCHAR(40),
  early_refund_at TIMESTAMPTZ,
  client_reported_usage JSONB,
  feedback_status interview_feedback_status NOT NULL DEFAULT 'NONE',
  feedback_json JSONB,
  feedback_attempts INTEGER NOT NULL DEFAULT 0,
  feedback_had_video BOOLEAN NOT NULL DEFAULT false,
  feedback_model VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT interview_sessions_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key)
);

CREATE INDEX interview_sessions_user_id_status_idx ON interview_sessions (user_id, status);
CREATE INDEX interview_sessions_analysis_id_idx ON interview_sessions (analysis_id);
CREATE INDEX interview_sessions_hard_deadline_at_idx ON interview_sessions (hard_deadline_at);

CREATE TABLE interview_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  speaker interview_speaker NOT NULL,
  text TEXT NOT NULL,
  interrupted BOOLEAN NOT NULL DEFAULT false,
  partial BOOLEAN NOT NULL DEFAULT false,
  offset_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT interview_turns_session_id_seq_key UNIQUE (session_id, seq)
);

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_turns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE interview_sessions FROM anon;
    REVOKE ALL PRIVILEGES ON TABLE interview_turns FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE interview_sessions FROM authenticated;
    REVOKE ALL PRIVILEGES ON TABLE interview_turns FROM authenticated;
  END IF;
END $$;
