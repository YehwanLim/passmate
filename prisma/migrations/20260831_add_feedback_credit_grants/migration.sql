-- 피드백 보상 크레딧을 계정당 한 번만 지급하기 위한 이력 테이블.
-- user_id UNIQUE 가 중복 지급을 DB 차원에서 막는다. 애플리케이션 조건문만으로는
-- 같은 사용자의 동시 요청 두 건이 모두 통과할 수 있다.
CREATE TABLE IF NOT EXISTS feedback_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  -- 분석이 지워져 피드백이 함께 사라져도 지급 이력은 남아야 한다.
  feedback_id UUID REFERENCES feedbacks(id) ON DELETE SET NULL,
  credits_granted INTEGER NOT NULL CHECK (credits_granted BETWEEN 1 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_credit_grants_feedback_id
  ON feedback_credit_grants (feedback_id);

-- 20260723_add_security_primitives 의 기본 거부 목록은 하드코딩이라 이후에 생긴
-- 테이블을 포함하지 못한다. 나머지 애플리케이션 테이블과 같은 상태로 맞춘다.
DO $$
DECLARE
  policy_name TEXT;
BEGIN
  IF to_regclass('public.feedback_credit_grants') IS NULL THEN
    RETURN;
  END IF;

  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedback_credit_grants'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.feedback_credit_grants', policy_name);
  END LOOP;

  ALTER TABLE public.feedback_credit_grants ENABLE ROW LEVEL SECURITY;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.feedback_credit_grants FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.feedback_credit_grants FROM authenticated;
  END IF;
END
$$;
