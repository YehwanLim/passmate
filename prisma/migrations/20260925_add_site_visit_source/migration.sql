-- 유입원 기록. 지금까지 site_visits 에는 경로만 있어서 블로그·스레드 중 어느 글이 사람을
-- 데려왔는지 알 수 없었다. 브라우저가 외부에서 처음 들어올 때 한 번만 referrer(쿼리 제거)와
-- utm_source 를 붙이고, 같은 세션의 이후 이동은 null 로 둔다.
ALTER TABLE site_visits
  ADD COLUMN referrer VARCHAR(200),
  ADD COLUMN utm_source VARCHAR(64);
