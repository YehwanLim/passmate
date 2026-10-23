// 노션 "DM 자료" 표에서 보낼 자료를 찾는다. 계정 주인은 노션 상태만 바꿔 자료를 켜고 끈다.
import { InstagramDmError } from "./errors.js";

export const PUBLISHED_STATUS = "공개·DM 연결";
const NOTION_VERSION = "2025-09-03";
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 정규화 후 정확히 일치: "금지어!" = "금지어", "꼬리 질문" = "꼬리질문", "AI" = "ai". "질문" ≠ "꼬리질문". */
export function normalizeKeyword(text) {
  if (typeof text !== "string") return "";
  return text.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

function plainText(property) {
  const parts = property?.title ?? property?.rich_text ?? [];
  return parts.map((part) => part?.plain_text ?? "").join("").trim();
}

export function parseResourcePage(page) {
  const properties = page?.properties ?? {};
  const title = plainText(properties["이름"]);
  const keyword = normalizeKeyword(plainText(properties["DM 키워드"]));
  const rawUrl = properties["공개 링크"]?.url;
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!page?.id || !title || !keyword || !url.startsWith("https://")) return null;
  // instagram_dm_deliveries 의 VARCHAR 한도(제목 200·키워드 50·링크 500)를 넘으면 기록 저장이 터지므로 자료로 쓰지 않는다.
  if (title.length > 200 || keyword.length > 50 || url.length > 500) return null;
  return { pageId: page.id, title, keyword, url };
}

export function createNotionResourceReader({
  token = process.env.NOTION_DM_TOKEN,
  dataSourceId = process.env.NOTION_DM_DATA_SOURCE_ID,
  fetchImpl = fetch,
  now = Date.now,
  ttlMs = CACHE_TTL_MS,
} = {}) {
  let cache = null;

  async function queryPage(cursor) {
    // 네트워크 오류·타임아웃·깨진 응답은 원본 메시지를 싣지 않고 일시 오류로만 알린다.
    let response;
    try {
      response = await fetchImpl(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_VERSION,
        },
        body: JSON.stringify({
          filter: { property: "상태", status: { equals: PUBLISHED_STATUS } },
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      throw new InstagramDmError("NOTION_QUERY_FAILED", { transient: true });
    }
    if (!response.ok) {
      throw new InstagramDmError("NOTION_QUERY_FAILED", {
        transient: response.status >= 500 || response.status === 429,
      });
    }
    try {
      return await response.json();
    } catch {
      throw new InstagramDmError("NOTION_QUERY_FAILED", { transient: true });
    }
  }

  async function loadResources() {
    if (cache && now() - cache.loadedAt < ttlMs) return cache.resources;
    if (!token || !dataSourceId) throw new InstagramDmError("NOTION_NOT_CONFIGURED");

    const resources = [];
    let cursor;
    do {
      const body = await queryPage(cursor);
      for (const page of body?.results ?? []) {
        const resource = parseResourcePage(page);
        if (resource) resources.push(resource);
      }
      cursor = body?.has_more ? body.next_cursor : undefined;
    } while (cursor);

    cache = { loadedAt: now(), resources };
    return resources;
  }

  return {
    async findByComment(text) {
      const keyword = normalizeKeyword(text);
      if (!keyword) return null;
      const resources = await loadResources();
      return resources.find((resource) => resource.keyword === keyword) ?? null;
    },
  };
}
