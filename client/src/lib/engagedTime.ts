/**
 * 체류 시간 — 탭이 실제로 보이던 시간을 재서 화면을 떠날 때 서버에 알린다(관리자 "사용 행동" 집계용).
 *
 * 방문 핑은 페이지 이동과 5분 하트비트뿐이라 한 장만 보고 나간 방문의 시간을 알 수 없다. 그래서 따로 잰다.
 * 보낼 때마다 이 탭의 누적값을 보내고 서버는 방문자별 최댓값을 쓰므로, 같은 값이 여러 번 가도 부풀지 않는다.
 */
import { sendFunnelEvent } from "@/lib/siteVisits";

export const ENGAGED_TIME_KEY = "preview:engaged-ms";
// 탭을 오가며 쓰는 사람의 전환마다 보내지 않는다. 첫 전환은 항상 보내므로 금방 나간 방문도 잡힌다.
const HIDDEN_RESEND_MS = 60 * 1000;

function sessionStorageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function readStoredMs(storage: Storage | null): number {
  try {
    const stored = Number(storage?.getItem(ENGAGED_TIME_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
}

function writeStoredMs(storage: Storage | null, value: number): void {
  try {
    storage?.setItem(ENGAGED_TIME_KEY, String(value));
  } catch {
    // 스토리지가 막혀 있으면 새로고침 전까지만 메모리로 잰다.
  }
}

// 화면이 닫히는 중이라 토큰을 읽느라 기다리면 요청이 못 나갈 수 있다. 익명으로 보내도 방문자 ID 로 연결된다.
function sendEngagedSeconds(seconds: number): Promise<boolean> {
  return sendFunnelEvent("engaged_time", String(seconds), { getAccessToken: () => Promise.resolve(null) });
}

interface EngagedTimeOptions {
  send?: (seconds: number) => unknown;
  now?: () => number;
  storage?: Storage | null;
}

/** 재기 시작하고, 멈추는 함수를 돌려준다. 누적값은 탭 세션에 남아 전체 새로고침(로그인 복귀 등)을 넘어 이어진다. */
export function startEngagedTimeTracking({
  send = sendEngagedSeconds,
  now = Date.now,
  storage = sessionStorageOrNull(),
}: EngagedTimeOptions = {}): () => void {
  let totalMs = readStoredMs(storage);
  let visibleSince = document.visibilityState === "visible" ? now() : null;
  let lastSentSeconds = 0;
  let lastSentAt: number | null = null;

  const settle = () => {
    if (visibleSince === null) return;
    totalMs += now() - visibleSince;
    visibleSince = null;
    writeStoredMs(storage, totalMs);
  };

  const report = (force: boolean) => {
    settle();
    const seconds = Math.floor(totalMs / 1000);
    if (seconds < 1 || seconds === lastSentSeconds) return;
    if (!force && lastSentAt !== null && now() - lastSentAt < HIDDEN_RESEND_MS) return;
    lastSentSeconds = seconds;
    lastSentAt = now();
    void send(seconds);
  };

  const resume = () => {
    if (document.visibilityState === "visible" && visibleSince === null) visibleSince = now();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") report(false);
    else resume();
  };
  // 페이지가 정말 닫힐 때는 다음 기회가 없으니 간격과 상관없이 보낸다. 뒤로 가기 캐시에서 돌아오면 다시 잰다.
  const onPageHide = () => report(true);

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", resume);

  return () => {
    settle();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", resume);
  };
}
