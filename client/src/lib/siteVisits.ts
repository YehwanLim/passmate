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
}

/**
 * 실패해도 조용히 넘어간다 — 집계는 부가 기능이라 사용자 흐름을 막거나 에러를 띄우면 안 된다.
 * 로그인 상태면 토큰을 함께 보내 서버가 계정 ID 를 붙이게 하고, 아니면 익명으로 남는다.
 */
export async function sendVisit(
  path: string,
  { fetcher, getAccessToken = readAccessToken, visitorId = getVisitorId() }: SendVisitOptions = {},
): Promise<boolean> {
  if (!shouldTrackPath(path)) return false;
  const doFetch = fetcher ?? (typeof fetch === "function" ? fetch : null);
  if (!doFetch) return false;

  const accessToken = await getAccessToken();
  try {
    const response = await doFetch(VISIT_ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ visitorId, path }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
