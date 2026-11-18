-- 방문 핑에 폰(m)·PC(d) 구분을 남긴다(11-10). 관리자 사용 행동 퍼널의 '방문'·'분석 폼 열람'을 기기별로 나눈다.
-- 이 칸을 넣기 전 방문과 옛 탭에서 온 방문은 비어 있다(기기 모름).
ALTER TABLE site_visits ADD COLUMN device VARCHAR(1);
