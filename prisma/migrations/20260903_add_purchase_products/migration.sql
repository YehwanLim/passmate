-- 1회권/3회권 상품 구분을 추가한다. 기존 구매 의도는 전부 3회권이었으므로 TRIPLE 기본값.
CREATE TYPE purchase_product AS ENUM ('SINGLE', 'TRIPLE');

ALTER TABLE purchase_intents
  ADD COLUMN product purchase_product NOT NULL DEFAULT 'TRIPLE';

-- 기존 groble_payment_url 은 3회권 결제 URL 의미를 유지하고, 1회권 URL 컬럼을 추가한다.
-- 빈 문자열이면 1회권 결제가 아직 설정되지 않은 상태(PREMIUM_CHECKOUT_NOT_CONFIGURED)로 취급된다.
ALTER TABLE entitlement_settings
  ADD COLUMN groble_single_payment_url TEXT NOT NULL DEFAULT '';
