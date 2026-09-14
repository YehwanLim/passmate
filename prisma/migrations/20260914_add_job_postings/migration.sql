-- 채용공고 맞춤 자소서 분석. 사용자가 URL 이나 텍스트로 붙인 채용공고를 정제해 저장하고,
-- 자소서 분석(analyses)이 job_posting_id 로 참조한다. 공고가 지워져도 분석 리포트는 남는다.
CREATE TABLE job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_url VARCHAR(2048),
  raw_text TEXT NOT NULL,
  summary_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX job_postings_user_id_idx ON job_postings (user_id);

ALTER TABLE analyses
  ADD COLUMN job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL;

CREATE INDEX analyses_job_posting_id_idx ON analyses (job_posting_id);

-- 나머지 애플리케이션 테이블과 같은 기본 거부 상태로 맞춘다.
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE job_postings FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE job_postings FROM authenticated;
  END IF;
END
$$;
