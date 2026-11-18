-- AI 면접 연습 이용권 예약용 값. enum 값은 추가한 트랜잭션 안에서 쓸 수 없어 표 생성과 나눈다.
ALTER TYPE analysis_kind ADD VALUE IF NOT EXISTS 'INTERVIEW';
