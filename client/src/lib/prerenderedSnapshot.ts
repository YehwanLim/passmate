/**
 * 프리렌더된 페이지의 원본 HTML 스냅샷.
 *
 * main.tsx 가 하이드레이션 직전에 <div id="root"> 안을 저장해 두고, ErrorBoundary 가 지연 청크 로드 실패를 잡으면
 * 오류 화면 대신 이 HTML 을 다시 그린다. 청크 로드는 배포 전환 직후(옛 HTML 이 새 배포에 없는 청크를 가리킴)나
 * 검색 엔진 렌더러의 리소스 타임아웃에서 실패하는데, 그때 오류 화면이 본문을 덮으면 Google 이 Soft 404 로 판정해
 * 색인에서 뺀다(09-17 Search Console 실시간 테스트로 확인). 본문이 남아 있으면 링크는 그대로 동작하고 색인도 된다.
 */
let snapshot: string | null = null;

export function capturePrerenderedHtml(root: HTMLElement): void {
  snapshot = root.innerHTML;
}

export function getPrerenderedHtml(): string | null {
  return snapshot;
}

/** 테스트에서 모듈 상태를 되돌릴 때만 쓴다. */
export function resetPrerenderedHtml(): void {
  snapshot = null;
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
