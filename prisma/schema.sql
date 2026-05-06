-- =============================================================================
-- PassMate MVP Database Schema — PostgreSQL DDL
-- Supabase (PostgreSQL 15+) 호환
-- =============================================================================

-- Enum: 분석 상태
CREATE TYPE analysis_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- Enum: 실패 원인 분류
CREATE TYPE error_code AS ENUM ('TIMEOUT', 'RATE_LIMIT', 'PARSE_ERROR', 'CONTEXT_IRRELEVANT', 'API_ERROR', 'UNKNOWN');

-- =============================================================================
-- users — 유저 계정
-- =============================================================================
CREATE TABLE users (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(320) NOT NULL UNIQUE,
  name        VARCHAR(100),
  avatar_url  TEXT,

  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Trigger: updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- projects — 자소서 묶음 단위
-- =============================================================================
CREATE TABLE projects (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title       VARCHAR(200) NOT NULL,
  company     VARCHAR(100),
  job_keyword VARCHAR(100),

  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- analyses — AI 분석 핵심 테이블
-- =============================================================================
CREATE TABLE analyses (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      UUID             NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- 입력 데이터
  question_text   TEXT             NOT NULL,
  input_text      TEXT             NOT NULL,

  -- AI 응답 데이터
  ai_response_json JSONB,
  ai_score         DOUBLE PRECISION,

  -- 상태 관리
  status          analysis_status  NOT NULL DEFAULT 'PENDING',
  error_message   TEXT,
  error_code      error_code,

  -- 프롬프트 연결
  prompt_version      VARCHAR(20)  NOT NULL DEFAULT '1.0',
  prompt_template_id  UUID,  -- FK는 prompt_templates 생성 후 ALTER로 추가

  -- 모델 정보
  model_name      VARCHAR(100),
  model_provider  VARCHAR(50),

  -- 메타데이터
  total_chars      INTEGER,
  response_time_ms INTEGER,

  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analyses_user_id            ON analyses(user_id);
CREATE INDEX idx_analyses_project_id         ON analyses(project_id);
CREATE INDEX idx_analyses_status             ON analyses(status);
CREATE INDEX idx_analyses_error_code         ON analyses(error_code);
CREATE INDEX idx_analyses_prompt_template_id ON analyses(prompt_template_id);
CREATE INDEX idx_analyses_created_at         ON analyses(created_at);

-- =============================================================================
-- prompt_templates — 프롬프트 버전 관리 & A/B 테스트
-- =============================================================================
CREATE TABLE prompt_templates (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 버전 식별
  version         VARCHAR(20)  NOT NULL,
  name            VARCHAR(100) NOT NULL,
  variant         VARCHAR(50),

  -- 프롬프트 본문
  system_prompt   TEXT         NOT NULL,
  user_template   TEXT,

  -- 모델 설정
  model_name      VARCHAR(100) NOT NULL,
  model_provider  VARCHAR(50)  NOT NULL,
  temperature     DOUBLE PRECISION DEFAULT 0.7,
  max_tokens      INTEGER,

  -- 상태 관리
  is_active       BOOLEAN      NOT NULL DEFAULT FALSE,
  is_default      BOOLEAN      NOT NULL DEFAULT FALSE,

  -- 메타
  description     TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_prompt_version_variant UNIQUE (version, variant)
);

CREATE INDEX idx_prompt_templates_is_active       ON prompt_templates(is_active);
CREATE INDEX idx_prompt_templates_model_provider  ON prompt_templates(model_provider);

-- FK: analyses → prompt_templates (테이블 생성 순서 이슈 해결)
ALTER TABLE analyses
  ADD CONSTRAINT fk_analyses_prompt_template
  FOREIGN KEY (prompt_template_id) REFERENCES prompt_templates(id);

-- =============================================================================
-- token_usages — AI 호출 비용 추적 (analyses 1:N)
-- =============================================================================

CREATE TYPE call_type AS ENUM ('ANALYSIS', 'RETRY', 'FALLBACK', 'REWRITE', 'SUMMARY');

CREATE TABLE token_usages (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id     UUID         NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,

  -- 모델 정보
  model_name      VARCHAR(100) NOT NULL,
  model_provider  VARCHAR(50)  NOT NULL,

  -- 토큰 사용량
  prompt_tokens     INTEGER    NOT NULL,
  completion_tokens INTEGER    NOT NULL,
  total_tokens      INTEGER    NOT NULL,

  -- 비용
  cost            DOUBLE PRECISION,
  cost_currency   VARCHAR(3)   NOT NULL DEFAULT 'USD',

  -- 호출 유형
  call_type       call_type    NOT NULL DEFAULT 'ANALYSIS',

  -- 호출 메타데이터
  latency_ms      INTEGER,
  http_status     INTEGER,
  is_success      BOOLEAN      NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_usages_analysis_id    ON token_usages(analysis_id);
CREATE INDEX idx_token_usages_model_provider ON token_usages(model_provider);
CREATE INDEX idx_token_usages_call_type      ON token_usages(call_type);
CREATE INDEX idx_token_usages_created_at     ON token_usages(created_at);

-- =============================================================================
-- feedbacks — 유저 피드백 (analyses 1:N, 중복 투표 방지)
-- =============================================================================

CREATE TYPE rating AS ENUM ('THUMBS_UP', 'THUMBS_DOWN');

CREATE TABLE feedbacks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id  UUID        NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 평가
  rating       rating      NOT NULL,
  comment      TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 동일 유저가 동일 분석에 중복 투표 불가
  CONSTRAINT uq_feedback_analysis_user UNIQUE (analysis_id, user_id)
);

CREATE INDEX idx_feedbacks_analysis_id ON feedbacks(analysis_id);
CREATE INDEX idx_feedbacks_user_id     ON feedbacks(user_id);
CREATE INDEX idx_feedbacks_rating      ON feedbacks(rating);
