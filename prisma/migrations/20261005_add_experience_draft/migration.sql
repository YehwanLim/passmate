-- 경험 → 초안: 지원서에 붙인 공고와, 문항 초안에 쓴 경험 목록.
-- 컬럼 추가만 한다. 공고가 지워지면 지원서의 연결만 끊긴다(SET NULL).
ALTER TABLE projects ADD COLUMN job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_job_posting_id_idx ON projects (job_posting_id);
ALTER TABLE application_questions ADD COLUMN draft_experience_ids TEXT[] NOT NULL DEFAULT '{}';
