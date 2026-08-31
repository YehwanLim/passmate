-- 👍/👎 단일 평가를 1~10 점수 3문항 + 주관식 설문으로 교체한다.
-- 기존 응답을 버리지 않기 위해 rating 은 남기되 NULL 을 허용한다.
ALTER TABLE feedbacks
  ALTER COLUMN rating DROP NOT NULL;

ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS score_reflection INTEGER
    CHECK (score_reflection IS NULL OR score_reflection BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS score_improvement INTEGER
    CHECK (score_improvement IS NULL OR score_improvement BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS score_recommend INTEGER
    CHECK (score_recommend IS NULL OR score_recommend BETWEEN 1 AND 10);
