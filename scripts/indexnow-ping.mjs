// 프로덕션 배포가 끝나면 최근에 바뀐 페이지 주소를 IndexNow 로 네이버에 알린다(.github/workflows/indexnow.yml).
// 키는 공개값이다. 사이트 루트의 client/public/<키>.txt 와 같아야 네이버가 소유를 확인한다.
// 알림은 "빨리 와서 봐 달라"까지만 하고 색인·순위를 보장하지 않는다.
import { pathToFileURL } from "node:url";

export const SITE_ORIGIN = "https://pre-view.me";
export const INDEXNOW_KEY = "4939d2cd4b669c263b63af788bab82bf";
export const INDEXNOW_ENDPOINT = "https://searchadvisor.naver.com/indexnow";
/** 오늘(KST)과 어제 lastmod 만 보낸다. 같은 날 배포가 여러 번이면 같은 주소가 다시 가지만 하루 몇 번이라 괜찮다. */
export const RECENT_DAYS = 1;

/** KST 기준 날짜 문자열(YYYY-MM-DD). sitemap lastmod 가 KST 날짜로 쓰여 있다. */
export function kstDate(now, daysAgo = 0) {
  return new Date(now.getTime() + 9 * 3600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/** sitemap.xml 에서 lastmod 가 기준일 이후인 우리 도메인 주소만 고른다. lastmod 없는 주소는 보내지 않는다. */
export function selectRecentUrls(sitemapXml, now, days = RECENT_DAYS) {
  const since = kstDate(now, days);
  const urls = [];
  for (const [, block] of sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim();
    if (!loc || !lastmod || !loc.startsWith(`${SITE_ORIGIN}/`)) continue;
    if (lastmod.slice(0, 10) >= since) urls.push(loc);
  }
  return urls;
}

export function buildPayload(urlList) {
  return {
    host: new URL(SITE_ORIGIN).host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sitemap = await fetch(`${SITE_ORIGIN}/sitemap.xml`, { cache: "no-store" });
  if (!sitemap.ok) throw new Error(`sitemap ${sitemap.status}`);
  const urlList = selectRecentUrls(await sitemap.text(), new Date());
  if (urlList.length === 0) {
    console.log("[indexnow] 최근에 바뀐 주소가 없어 보내지 않음");
    return;
  }
  console.log(`[indexnow] ${urlList.length}개 주소:\n${urlList.join("\n")}`);
  if (dryRun) return;

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(buildPayload(urlList)),
  });
  // 200 접수, 202 키 확인 대기. 그 밖은 실패로 본다.
  console.log(`[indexnow] 네이버 응답 ${response.status} ${await response.text()}`);
  if (response.status !== 200 && response.status !== 202) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(error => {
    console.error(`[indexnow] ${error.message}`);
    process.exitCode = 1;
  });
}
