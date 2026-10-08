/**
 * 운영자 브라우저 표시 — GA4·방문 집계에서 운영자 본인의 이동을 빼기 위한 기기 단위 표시.
 *
 * 관리자 화면에 들어온 브라우저에 남기고(AdminGuard), 이 표시가 있으면 GA 스크립트를 싣지 않고
 * 방문 핑·이벤트도 보내지 않는다. 로그아웃 상태로 랜딩을 볼 때도 빠지도록 계정이 아니라 기기에 둔다.
 * 사람을 식별하는 값이 아니라 "보내지 않음" 스위치이며, 권한의 근거로 쓰지 않는다.
 */
export const INTERNAL_TRAFFIC_KEY = "preview:internal-traffic";

function localStorageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isInternalBrowser(storage: Storage | null = localStorageOrNull()): boolean {
  try {
    return storage?.getItem(INTERNAL_TRAFFIC_KEY) === "1";
  } catch {
    return false;
  }
}

export function markInternalBrowser(storage: Storage | null = localStorageOrNull()): void {
  try {
    storage?.setItem(INTERNAL_TRAFFIC_KEY, "1");
  } catch {
    // 시크릿 모드 등에서 스토리지가 막혀 있으면 표시 없이 넘어간다.
  }
}
