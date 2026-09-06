-- 상품별 Groble 설정 카탈로그. 상품이 5개가 되면서 entitlement_settings 의 URL 컬럼 2개
-- (groble_payment_url = 3회권, groble_single_payment_url = 1회권)로는 늘릴 수 없어 행 단위로 옮긴다.
-- 옛 컬럼은 롤백 여지를 위해 남긴다(코드는 더 이상 읽지 않음).
CREATE TABLE purchase_product_settings (
  product purchase_product PRIMARY KEY,
  groble_content_id TEXT UNIQUE,
  payment_url TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1회권은 그대로 베이직(자소서)로 팔린다. contentId 는 env 에 있으므로 비워 두고
-- 관리자 화면에서 입력할 때까지 코드가 env 를 fallback 으로 읽는다.
INSERT INTO purchase_product_settings (product, payment_url, active)
SELECT 'SINGLE', COALESCE(groble_single_payment_url, ''), true FROM entitlement_settings WHERE id = 'singleton'
ON CONFLICT (product) DO NOTHING;

-- 구 3회권의 그로블 상품(결제 URL·contentId)은 스탠다드가 승계한다. 이름·설명은 그로블에서 고친다.
INSERT INTO purchase_product_settings (product, payment_url, active)
SELECT 'STANDARD', COALESCE(groble_payment_url, ''), true FROM entitlement_settings WHERE id = 'singleton'
ON CONFLICT (product) DO NOTHING;

-- 3회권(구)은 판매 종료. 기업 분석 1회·프리미엄은 그로블 등록 전이라 URL 없음·판매 안 함으로 시작.
INSERT INTO purchase_product_settings (product, payment_url, active) VALUES
  ('TRIPLE', '', false),
  ('COMPANY_SINGLE', '', false),
  ('PREMIUM', '', false)
ON CONFLICT (product) DO NOTHING;

-- 나머지 애플리케이션 테이블과 같은 기본 거부 상태로 맞춘다(20260723_add_ai_model_settings,
-- 20260831_add_feedback_credit_grants 등 새 테이블마다 뒤따르는 관례).
ALTER TABLE purchase_product_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE purchase_product_settings FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE purchase_product_settings FROM authenticated;
  END IF;
END
$$;
