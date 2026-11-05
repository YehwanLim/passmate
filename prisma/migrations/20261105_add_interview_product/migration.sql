-- 결제 기록에 면접 이용권 지급 수를 남긴다(credits_granted = 자소서, company_credits_granted = 기업과 같은 꼴).
ALTER TABLE payment_entitlements
  ADD COLUMN interview_credits_granted INTEGER NOT NULL DEFAULT 0
  CHECK (interview_credits_granted >= 0);

-- 면접 1회권(4,900)·3회권(9,900)은 그로블 등록 전이라 URL 없음·판매 안 함으로 시작. 관리자 설정 화면에서 contentId·URL 을 넣고 켠다.
INSERT INTO purchase_product_settings (product, payment_url, active) VALUES
  ('INTERVIEW_SINGLE', '', false),
  ('INTERVIEW_TRIPLE', '', false)
ON CONFLICT (product) DO NOTHING;
