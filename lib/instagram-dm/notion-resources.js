// 노션 "DM 자료" 표에서 보낼 자료를 찾는다. 계정 주인은 노션 상태만 바꿔 자료를 켜고 끈다.
import { InstagramDmError } from "./errors.js";

export const PUBLISHED_STATUS = "공개·DM 연결";
const NOTION_VERSION = "2025-09-03";
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 공백·문장부호·이모지를 지우고 영문은 소문자로: "금지어!" → "금지어", "꼬리 질문" → "꼬리질문", "AI 🙏" → "ai". */
export function normalizeKeyword(text) {
  if (typeof text !== "string") return "";
  return text.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

/**
 * 댓글이 키워드로 시작하거나, 댓글의 한 낱말이 키워드로 시작하면 신청으로 본다.
 * "PT 자료 주세요"·"자료 PT 주세요"·"PT를 주세요"·"꼬리 질문 주세요"(키워드 꼬리질문) → 됨.
 * 낱말 중간에 든 건 안 됨: "said"(키워드 ai), "꼬리질문"(키워드 질문 — 둘 다 있으면 긴 쪽이 이김).
 */
export function commentMatchesKeyword(text, keyword) {
  if (!keyword) return false;
  if (normalizeKeyword(text).startsWith(keyword)) return true;
  if (typeof text !== "string") return false;
  return text
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .some((word) => word && word.toLowerCase().startsWith(keyword));
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
  return {
    pageId: page.id,
    title,
    keyword,
    url,
    gateMessage: customMessage(properties["첫 DM 문구"]),
    linkMessage: customMessage(properties["링크 DM 문구"]),
  };
}

// 버튼 템플릿 글자 한도(640자)에 대체 안내가 붙어도 넘지 않게 500자까지만 쓴다. 넘거나 비면 기본 문구.
const CUSTOM_MESSAGE_MAX = 500;

function customMessage(property) {
  const text = plainText(property);
  return text && text.length <= CUSTOM_MESSAGE_MAX ? text : null;
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
      if (!normalizeKeyword(text)) return null;
      const resources = await loadResources();
      // 여러 키워드가 걸리면 가장 긴 것("꼬리질문" > "질문", "최종합격" > "최종").
      let best = null;
      for (const resource of resources) {
        if (commentMatchesKeyword(text, resource.keyword) && (!best || resource.keyword.length > best.keyword.length)) best = resource;
      }
      return best;
    },
    /** 링크 DM 을 보낼 때 그 자료의 현재 문구를 다시 찾는다(첫 DM 뒤에 노션 문구를 고쳤어도 반영). */
    async findByPageId(pageId) {
      if (!pageId) return null;
      const resources = await loadResources();
      return resources.find((resource) => resource.pageId === pageId) ?? null;
    },
  };
}
