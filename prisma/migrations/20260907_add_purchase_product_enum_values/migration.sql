-- 티어형 이용권: 베이직(기업 분석 1회), 스탠다드(자소서 2 + 기업 1), 프리미엄(자소서 3 + 기업 3).
-- 새 enum 값은 같은 트랜잭션에서 쓸 수 없어(Postgres 제약) 이 값을 쓰는 백필은
-- 상품별 설정 테이블을 만드는 다음 마이그레이션에 둔다.
ALTER TYPE purchase_product ADD VALUE IF NOT EXISTS 'COMPANY_SINGLE';
ALTER TYPE purchase_product ADD VALUE IF NOT EXISTS 'STANDARD';
ALTER TYPE purchase_product ADD VALUE IF NOT EXISTS 'PREMIUM';
