import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPayload, INDEXNOW_KEY, kstDate, selectRecentUrls } from "./indexnow-ping.mjs";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://pre-view.me/</loc>
  </url>
  <url>
    <loc>https://pre-view.me/guide/today</loc>
    <lastmod>2026-10-09</lastmod>
  </url>
  <url>
    <loc>https://pre-view.me/guide/yesterday</loc>
    <lastmod>2026-10-08</lastmod>
  </url>
  <url>
    <loc>https://pre-view.me/guide/old</loc>
    <lastmod>2026-09-15</lastmod>
  </url>
  <url>
    <loc>https://other.example/guide/today</loc>
    <lastmod>2026-10-09</lastmod>
  </url>
</urlset>`;

describe("indexnow-ping", () => {
  // 2026-10-08T16:00Z = KST 10-09 01:00. UTC 날짜로 자르면 하루 밀린다.
  const now = new Date("2026-10-08T16:00:00Z");

  it("uses the KST calendar date", () => {
    expect(kstDate(now)).toBe("2026-10-09");
    expect(kstDate(now, 1)).toBe("2026-10-08");
  });

  it("sends only our URLs whose lastmod is today or yesterday (KST)", () => {
    expect(selectRecentUrls(SITEMAP, now)).toEqual(["https://pre-view.me/guide/today", "https://pre-view.me/guide/yesterday"]);
  });

  it("points keyLocation at the key file shipped in client/public", () => {
    const payload = buildPayload(["https://pre-view.me/guide/today"]);
    expect(payload).toMatchObject({ host: "pre-view.me", key: INDEXNOW_KEY, keyLocation: `https://pre-view.me/${INDEXNOW_KEY}.txt` });
    const keyFile = path.join(ROOT_DIR, "client/public", `${INDEXNOW_KEY}.txt`);
    expect(existsSync(keyFile)).toBe(true);
    expect(readFileSync(keyFile, "utf8").trim()).toBe(INDEXNOW_KEY);
  });
});
