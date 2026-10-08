/**
 * 사이트 공지(팝업·배너). GET /api/notices (lib/site-notices.js) 가 지금 보여 줄 것을 종류별로 하나씩 준다.
 * "닫기"·"오늘 하루 보지 않기"는 이 브라우저의 편의 기록일 뿐이라 못 읽으면 그냥 다시 보인다.
 */
export interface SiteNotice {
  id: string;
  kind: "POPUP" | "BANNER";
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  imageUrl: string | null;
}

export interface LiveNotices {
  popup: SiteNotice | null;
  banner: SiteNotice | null;
}

const SESSION_KEY = (id: string) => `preview.notice.closed.${id}`;
const HIDE_UNTIL_KEY = (id: string) => `preview.notice.hideUntil.${id}`;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function safeStorage(kind: "local" | "session"): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeGet(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: StorageLike | null, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // 저장이 막히면 다음에 다시 보일 뿐이다.
  }
}

/** 다음 KST 자정. "오늘 하루 보지 않기"는 한국 날짜가 바뀌면 다시 뜬다. */
export function nextKstMidnight(now = new Date()): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1) - KST_OFFSET_MS);
}

export function isNoticeHidden(
  id: string,
  { local = safeStorage("local"), session = safeStorage("session"), now = new Date() }: { local?: StorageLike | null; session?: StorageLike | null; now?: Date } = {},
): boolean {
  if (safeGet(session, SESSION_KEY(id))) return true;
  const until = safeGet(local, HIDE_UNTIL_KEY(id));
  const time = until ? Date.parse(until) : Number.NaN;
  return Number.isFinite(time) && time > now.getTime();
}

/** 닫기: 이번 방문(탭)에서만 안 보인다. */
export function closeNoticeForSession(id: string, session = safeStorage("session")) {
  safeSet(session, SESSION_KEY(id), "1");
}

/** 오늘 하루 보지 않기: 다음 KST 자정까지 안 보인다. */
export function hideNoticeForToday(id: string, local = safeStorage("local"), now = new Date()) {
  safeSet(local, HIDE_UNTIL_KEY(id), nextKstMidnight(now).toISOString());
}

/** 사이트 안 경로는 같은 창, 바깥 주소는 새 창. */
export function isExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export async function fetchLiveNotices(): Promise<LiveNotices> {
  const response = await fetch("/api/notices");
  if (!response.ok) return { popup: null, banner: null };
  const payload = (await response.json()) as Partial<LiveNotices>;
  return { popup: payload.popup ?? null, banner: payload.banner ?? null };
}
