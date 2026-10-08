import prisma from "./prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed } from "./request-errors.js";
import { isRecord } from "./sanitize.js";

/**
 * 사이트 공지(팝업·배너). 관리자 화면(lib/admin-handlers/notices.js)이 만들고,
 * 누구나 GET /api/notices 로 지금 보여 줄 것을 받는다(api/auth/me.js ?notices=1 — 함수 개수 제한).
 */
export const NOTICE_KINDS = Object.freeze(["POPUP", "BANNER"]);
const LIMITS = Object.freeze({ title: 100, body: 1000, linkUrl: 500, linkLabel: 30, imageUrl: 500 });
// vercel.json CSP img-src 와 맞춘다: 사이트 안 경로, Supabase 저장소.
const IMAGE_HOST_PATTERN = /^[a-z0-9-]+\.supabase\.co$/i;

function isInternalPath(value) {
  return value.startsWith("/") && !value.startsWith("//") && !/[\s\\]/.test(value);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** 버튼 링크: 사이트 안 경로(/guide 등) 또는 https 주소. */
export function isAllowedLinkUrl(value) {
  return typeof value === "string" && (isInternalPath(value) || isHttpsUrl(value));
}

/** 팝업 이미지: 사이트 안 경로 또는 https://*.supabase.co (그 밖은 CSP 가 막아 깨진 그림이 된다). */
export function isAllowedImageUrl(value) {
  if (typeof value !== "string") return false;
  if (isInternalPath(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && IMAGE_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}

function optionalText(value, max, check = () => true) {
  if (value === undefined) return { skip: true };
  if (value === null) return { value: null };
  if (typeof value !== "string") return { invalid: true };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { value: null };
  if (trimmed.length > max || !check(trimmed)) return { invalid: true };
  return { value: trimmed };
}

function optionalDate(value) {
  if (value === undefined) return { skip: true };
  if (value === null || value === "") return { value: null };
  if (typeof value !== "string") return { invalid: true };
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? { invalid: true } : { value: date };
}

/**
 * 관리자 입력 → DB 데이터. partial=true 면 PATCH(온 필드만), 아니면 생성(kind·title 필수).
 * 무효면 null. 시작이 끝보다 늦으면 무효.
 */
export function readNoticeBody(body, { partial = false } = {}) {
  if (!isRecord(body)) return null;
  const data = {};

  if (body.kind !== undefined || !partial) {
    if (!NOTICE_KINDS.includes(body.kind)) return null;
    data.kind = body.kind;
  }
  if (body.title !== undefined || !partial) {
    if (typeof body.title !== "string") return null;
    const title = body.title.trim();
    if (title.length === 0 || title.length > LIMITS.title) return null;
    data.title = title;
  }
  if (body.body !== undefined) {
    if (typeof body.body !== "string" || body.body.length > LIMITS.body) return null;
    data.body = body.body.trim();
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return null;
    data.active = body.active;
  }

  const fields = [
    ["linkUrl", optionalText(body.linkUrl, LIMITS.linkUrl, isAllowedLinkUrl)],
    ["linkLabel", optionalText(body.linkLabel, LIMITS.linkLabel)],
    ["imageUrl", optionalText(body.imageUrl, LIMITS.imageUrl, isAllowedImageUrl)],
    ["startsAt", optionalDate(body.startsAt)],
    ["endsAt", optionalDate(body.endsAt)],
  ];
  for (const [key, result] of fields) {
    if (result.invalid) return null;
    if (!result.skip) data[key] = result.value;
  }
  if (data.startsAt && data.endsAt && data.startsAt >= data.endsAt) return null;
  if (partial && Object.keys(data).length === 0) return null;
  return data;
}

/** 지금 보여 줄 공지인가: 켜져 있고, 시작 전이 아니고, 끝나지 않았다. */
export function isNoticeLive(notice, now = new Date()) {
  if (!notice.active) return false;
  if (notice.startsAt && new Date(notice.startsAt) > now) return false;
  if (notice.endsAt && new Date(notice.endsAt) <= now) return false;
  return true;
}

/** 공개 응답에 싣는 필드만. */
export function publicNotice(notice) {
  return {
    id: notice.id,
    kind: notice.kind,
    title: notice.title,
    body: notice.body,
    linkUrl: notice.linkUrl ?? null,
    linkLabel: notice.linkLabel ?? null,
    imageUrl: notice.kind === "POPUP" ? (notice.imageUrl ?? null) : null,
  };
}

/** 종류별로 지금 보여 줄 공지 하나(가장 최근에 만든 것). */
export async function readLiveNotices(db, now = new Date()) {
  const rows = await db.siteNotice.findMany({
    where: {
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const pick = (kind) => rows.find((row) => row.kind === kind && isNoticeLive(row, now));
  const popup = pick("POPUP");
  const banner = pick("BANNER");
  return { popup: popup ? publicNotice(popup) : null, banner: banner ? publicNotice(banner) : null };
}

export function createSiteNoticesHandler({ db = prisma, now = () => new Date() } = {}) {
  return async function siteNoticesHandler(req, res) {
    const requestId = requestIdFor(req);
    try {
      if (req.method !== "GET") return sendMethodNotAllowed(res, requestId);
      // 모든 방문자가 매 화면 읽으므로 CDN 에 잠깐 캐시한다. 공지를 끄면 길어야 1분 뒤 사라진다.
      res.setHeader?.("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=60");
      return res.status(200).json(await readLiveNotices(db, now()));
    } catch (error) {
      return handleRequestError(res, error, requestId, "api/notices");
    }
  };
}
