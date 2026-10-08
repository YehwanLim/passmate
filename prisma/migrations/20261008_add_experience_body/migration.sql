-- 내 경험 자유 양식: 칸 나누기 없이 쓰는 글 한 덩어리. 기본은 자유 글, 칸(상황·한 일·결과)은 고를 때만.
-- 컬럼 추가만 한다. 기존 경험은 빈 글('')이라 지금처럼 칸으로 나뉜 채 보인다.
ALTER TABLE experiences ADD COLUMN body TEXT NOT NULL DEFAULT '';
