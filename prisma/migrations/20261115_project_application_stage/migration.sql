-- 지원 현황판(11-15): 지원서마다 전형 단계·직접 넣은 단계 목록·불합격 표시.
-- 칸만 더한다. 기존 지원서는 '작성 중'·기본 목록·불합격 아님이 된다.
ALTER TABLE projects ADD COLUMN stage VARCHAR(40) NOT NULL DEFAULT 'writing';
ALTER TABLE projects ADD COLUMN stage_steps JSONB;
ALTER TABLE projects ADD COLUMN rejected BOOLEAN NOT NULL DEFAULT false;
