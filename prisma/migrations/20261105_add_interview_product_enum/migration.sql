-- AI 면접 연습 1회권·3회권 상품. enum 값은 추가한 트랜잭션 안에서 쓸 수 없어 행 삽입과 나눈다(20261104_add_interview_kind 와 같은 이유).
ALTER TYPE purchase_product ADD VALUE IF NOT EXISTS 'INTERVIEW_SINGLE';
ALTER TYPE purchase_product ADD VALUE IF NOT EXISTS 'INTERVIEW_TRIPLE';
