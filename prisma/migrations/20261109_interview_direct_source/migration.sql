-- AI 모의 면접을 리포트 없이도 시작한다(11-09). 회사·직무·자소서를 세션에 직접 받는다.
-- 리포트로 시작한 세션은 analysis_id 를 그대로 쓰고 아래 세 칸은 비워 둔다.
ALTER TABLE interview_sessions ALTER COLUMN analysis_id DROP NOT NULL;
ALTER TABLE interview_sessions ADD COLUMN company VARCHAR(100);
ALTER TABLE interview_sessions ADD COLUMN job_role VARCHAR(100);
ALTER TABLE interview_sessions ADD COLUMN cover_letter TEXT;
