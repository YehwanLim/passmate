/**
 * 프리렌더된 페이지의 원본 HTML 스냅샷.
 *
 * main.tsx 가 하이드레이션 직전에 <div id="root"> 안을 저장해 두고, ErrorBoundary 가 지연 청크 로드 실패를 잡으면
 * 오류 화면 대신 이 HTML 을 다시 그린다. 청크 로드는 배포 전환 직후(옛 HTML 이 새 배포에 없는 청크를 가리킴)나
 * 검색 엔진 렌더러의 리소스 타임아웃에서 실패하는데, 그때 오류 화면이 본문을 덮으면 Google 이 Soft 404 로 판정해
 * 색인에서 뺀다(09-17 Search Console 실시간 테스트로 확인). 본문이 남아 있으면 링크는 그대로 동작하고 색인도 된다.
 */
let snapshot: string | null = null;
// 저장본이 어느 주소의 것인지. 홈에서 연 뒤 다른 화면으로 넘어가다 청크를 못 받았을 때 홈 저장본을 그리면
// 주소는 그 화면인데 홈이 보인다(10-08 미리보기: 분석 대기 화면이 홈으로 보였음). 같은 주소일 때만 되살린다.
let snapshotUrl: string | null = null;

const currentUrl = () => `${window.location.pathname}${window.location.search}`;

export function capturePrerenderedHtml(root: HTMLElement, url: string = currentUrl()): void {
  snapshot = root.innerHTML;
  snapshotUrl = url;
}

export function getPrerenderedHtml(url: string = currentUrl()): string | null {
  return snapshot !== null && snapshotUrl === url ? snapshot : null;
}

/** 테스트에서 모듈 상태를 되돌릴 때만 쓴다. */
export function resetPrerenderedHtml(): void {
  snapshot = null;
  snapshotUrl = null;
}

// 배포가 바뀐 뒤 화면을 옮기다 청크를 못 받으면(옛 HTML 이 새 배포에 없는 파일을 가리킴) 그 주소를 새로 불러오면
// 새 배포의 파일로 열린다. 새로 불러와도 또 실패하면 같은 주소를 계속 다시 부르지 않도록 잠깐 기억해 둔다.
const CHUNK_RELOAD_KEY = "preview:chunk-reload";
const CHUNK_RELOAD_WINDOW_MS = 30_000;

/** 지금 주소를 청크 실패 때문에 방금 새로 불러온 적이 없으면 true. 저장소가 막힌 브라우저에서는 반복을 막을 수 없어 false. */
export function canReloadForChunkError(url: string = currentUrl(), now: number = Date.now()): boolean {
  try {
    const raw = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
    const last = raw ? (JSON.parse(raw) as { url?: unknown; at?: unknown }) : null;
    return !(last && last.url === url && typeof last.at === "number" && now - last.at < CHUNK_RELOAD_WINDOW_MS);
  } catch {
    return false;
  }
}

export function markChunkReload(url: string = currentUrl(), now: number = Date.now()): void {
  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, JSON.stringify({ url, at: now }));
  } catch {
    // canReloadForChunkError 가 이미 false 를 돌려줬을 것이다.
  }
}

// Chromium / Safari / Firefox / webpack 계열의 동적 import 실패 메시지.
const CHUNK_LOAD_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/,
  /Importing a module script failed/,
  /error loading dynamically imported module/i,
  /Loading (CSS )?chunk/,
];

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return CHUNK_LOAD_ERROR_PATTERNS.some(pattern => pattern.test(message));
}
