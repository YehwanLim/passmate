/**
 * 방문 핑 — 관리자 대시보드의 방문자·실시간 집계용.
 *
 * 분석을 돌리지 않아도 사이트에 들어오면 `POST /api/visits` 로 경로만 알린다.
 * 방문자 ID 는 탭 세션 동안만 유지되는 무작위 값이라(sessionStorage) 기기를 추적하는
 * 영구 식별자가 아니며, 인증·권한·리포트 접근의 근거로 쓰지 않는다.
 */
export const VISIT_ENDPOINT = "/api/visits";
export const VISITOR_ID_KEY = "preview:visitor-session-id";
const VISITOR_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

let memoryVisitorId: string | null = null;

/** 관리자 화면은 운영자 자신의 이동이라 방문으로 세지 않는다. */
export function shouldTrackPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  return path !== "/admin" && !path.startsWith("/admin/");
}

function randomVisitorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getVisitorId(storage: Storage | null = sessionStorageOrNull()): string {
  if (memoryVisitorId) return memoryVisitorId;
  try {
    const stored = storage?.getItem(VISITOR_ID_KEY);
    if (stored && VISITOR_ID_PATTERN.test(stored)) {
      memoryVisitorId = stored;
      return stored;
    }
  } catch {
    // 시크릿 모드 등에서 스토리지가 막혀 있어도 메모리 ID 로 계속 간다.
  }
  const id = randomVisitorId();
  memoryVisitorId = id;
  try {
    storage?.setItem(VISITOR_ID_KEY, id);
  } catch {
    // 위와 같다.
  }
  return id;
}

/** 테스트에서 모듈 상태를 초기화하기 위한 훅. 프로덕션 코드는 호출하지 않는다. */
export function resetVisitorIdForTests(): void {
  memoryVisitorId = null;
  entrySourceConsumed = false;
}

export type VisitEntrySource = { referrer: string | null; utmSource: string | null };

const UTM_SOURCE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

/**
 * 이 문서가 어디서 왔는지: 외부 referrer 와 URL 의 utm_source. 같은 사이트 안에서 온 referrer 는
 * SPA 이동이나 새로고침이라 유입원이 아니므로 버린다. 둘 다 없으면 null.
 */
export function readEntrySource(
  referrer: string = typeof document === "undefined" ? "" : document.referrer,
  search: string = typeof window === "undefined" ? "" : window.location.search,
  origin: string = typeof window === "undefined" ? "" : window.location.origin,
): VisitEntrySource | null {
  let externalReferrer: string | null = null;
  if (referrer) {
    try {
      const url = new URL(referrer);
      if (url.origin !== origin) externalReferrer = referrer;
    } catch {
      // 파싱이 안 되는 referrer 는 없는 것으로 친다.
    }
  }
  const utm = new URLSearchParams(search).get("utm_source");
  const utmSource = utm && UTM_SOURCE_PATTERN.test(utm) ? utm : null;
  if (!externalReferrer && !utmSource) return null;
  return { referrer: externalReferrer, utmSource };
}

// 유입원은 한 세션(페이지 로드)에 한 번만 보낸다. 이후 라우트 이동 핑에 같은 referrer 를 또
// 붙이면 한 사람이 유입원별 집계에 페이지 수만큼 잡힌다.
let entrySourceConsumed = false;

function consumeEntrySource(): VisitEntrySource | null {
  if (entrySourceConsumed) return null;
  entrySourceConsumed = true;
  return readEntrySource();
}

// Supabase 클라이언트는 랜딩 진입 번들에서 빼기 위해 지연 로드한다(AuthContext와 같은 이유).
// 정적 import로 되돌리면 App → VisitTracker → 여기 경로로 @supabase/*가 진입 청크에 도로 들어간다.
async function readAccessToken(): Promise<string | null> {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

interface SendVisitOptions {
  fetcher?: typeof fetch;
  getAccessToken?: () => Promise<string | null>;
  visitorId?: string;
  /** 첫 핑에만 실리는 유입원. 생략하면 문서의 referrer·utm_source 를 한 번만 읽는다. */
  source?: VisitEntrySource | null;
}

/**
 * 실패해도 조용히 넘어간다 — 집계는 부가 기능이라 사용자 흐름을 막거나 에러를 띄우면 안 된다.
 * 로그인 상태면 토큰을 함께 보내 서버가 계정 ID 를 붙이게 하고, 아니면 익명으로 남는다.
 */
export async function sendVisit(
  path: string,
  { fetcher, getAccessToken = readAccessToken, visitorId = getVisitorId(), source }: SendVisitOptions = {},
): Promise<boolean> {
  if (!shouldTrackPath(path)) return false;
  const doFetch = fetcher ?? (typeof fetch === "function" ? fetch : null);
  if (!doFetch) return false;
  const entry = source === undefined ? consumeEntrySource() : source;

  const accessToken = await getAccessToken();
  try {
    const response = await doFetch(VISIT_ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ visitorId, path, ...(entry ?? {}) }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
