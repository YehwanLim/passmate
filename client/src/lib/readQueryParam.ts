/** 현재 URL 의 쿼리 값을 읽는다. 서버 상한과 같은 길이로 잘라 폼 초기값으로 쓴다. */
export function readQueryParam(name: string, maxLength = 100): string {
  if (typeof window === "undefined") return "";
  const value = new URLSearchParams(window.location.search).get(name);
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}
