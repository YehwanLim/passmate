-- 내 지원서 작업실: 지원서(Project)에 마감·공고 슬러그를 붙이고, 문항 초안과 내 경험을 저장한다.
-- 기존 테이블은 컬럼 추가만 한다. 문항·경험은 부모(Project·User) 삭제 시 함께 지워져 계정 purge 가 그대로 덮는다.
ALTER TABLE projects ADD COLUMN deadline TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN posting_slug VARCHAR(120);

CREATE TABLE application_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  char_limit INTEGER,
  answer TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT application_questions_project_id_position_key UNIQUE (project_id, position)
);

CREATE TABLE experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  period VARCHAR(50),
  situation TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX experiences_user_id_idx ON experiences (user_id);

-- 나머지 애플리케이션 테이블과 같은 기본 거부 상태로 맞춘다.
ALTER TABLE application_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE application_questions FROM anon;
    REVOKE ALL PRIVILEGES ON TABLE experiences FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE application_questions FROM authenticated;
    REVOKE ALL PRIVILEGES ON TABLE experiences FROM authenticated;
  END IF;
END
$$;
