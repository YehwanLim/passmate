-- 기업 분석 리포트: 자소서 분석과 같은 테이블을 쓰되 kind 로 구분하고, 크레딧 풀을 분리한다.
-- 기존 행은 전부 자소서(RESUME)라 기본값으로 채운다.
CREATE TYPE analysis_kind AS ENUM ('RESUME', 'COMPANY');

ALTER TABLE analyses
  ADD COLUMN kind analysis_kind NOT NULL DEFAULT 'RESUME';
CREATE INDEX IF NOT EXISTS analyses_user_id_kind_idx
  ON analyses (user_id, kind);

ALTER TABLE analysis_reservations
  ADD COLUMN kind analysis_kind NOT NULL DEFAULT 'RESUME';
CREATE INDEX IF NOT EXISTS analysis_reservations_user_id_kind_source_status_idx
  ON analysis_reservations (user_id, kind, source, status);

-- 기업 분석 크레딧 누적 지급치. 잔여는 이 값에서 kind = 'COMPANY' 예약(PENDING/CONSUMED) 수를 뺀 값.
ALTER TABLE analysis_entitlements
  ADD COLUMN company_credits_granted INTEGER NOT NULL DEFAULT 0
  CHECK (company_credits_granted >= 0);

-- 번들 결제 이력. credits_granted 는 자소서 크레딧 의미를 유지한다.
ALTER TABLE payment_entitlements
  ADD COLUMN company_credits_granted INTEGER NOT NULL DEFAULT 0
  CHECK (company_credits_granted >= 0);

ALTER TABLE admin_credit_grants
  ADD COLUMN kind analysis_kind NOT NULL DEFAULT 'RESUME';

-- 기업 분석 판매·생성 스위치. 기본 꺼짐: 관리자 지급 크레딧으로 내부 QA 후 켠다.
ALTER TABLE entitlement_settings
  ADD COLUMN company_analysis_enabled BOOLEAN NOT NULL DEFAULT false;
