/**
 * 분석 폼에 들어온 목적(`?intent=`). 지금은 면접 후기 글에서 온 "예상 질문부터 보기" 하나뿐이다.
 * 서버로 보내지 않는 화면 전용 값이다 — 분석 입력·크레딧·상태 흐름은 그대로고, 폼 안내 한 줄과 리포트 첫 위치만 바뀐다.
 * 폼(/analyze) → 로그인 왕복(초안·redirect) → /analysis-pending → /report-new 로 쿼리 그대로 넘겨 이어 간다.
 */
export type AnalyzeIntent = "interview";

const INTENT_PARAM = "intent";

/** 리포트가 열리면 먼저 보여 줄 섹션(lib/report/reportNavigation.ts 의 id). */
export const ANALYZE_INTENT_SECTION_ID: Readonly<
  Record<AnalyzeIntent, string>
> = {
  interview: "section-interview-drill",
};

/** 아는 값만 통과시킨다. 모르는 값·빈 값은 null(평소 화면). */
export function parseAnalyzeIntent(value: unknown): AnalyzeIntent | null {
  return value === "interview" ? value : null;
}

/** 검색어(`?a=b&intent=interview`)에서 intent 를 읽는다. 기본은 현재 주소. */
export function readAnalyzeIntent(
  search: string = typeof window === "undefined" ? "" : window.location.search
): AnalyzeIntent | null {
  return parseAnalyzeIntent(new URLSearchParams(search).get(INTENT_PARAM));
}

/** 경로에 intent 를 붙인다. intent 가 없으면 경로를 그대로 돌려준다. */
export function withAnalyzeIntent(
  path: string,
  intent: AnalyzeIntent | null | undefined
): string {
  if (!intent) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${INTENT_PARAM}=${intent}`;
}
