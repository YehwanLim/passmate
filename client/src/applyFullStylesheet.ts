// 프리렌더된 랜딩(scripts/prerender-landing.mjs)은 첫 화면 CSS 만 <style> 로 인라인돼 있고 전체 CSS 는
// preload 만 걸려 있다(렌더 차단을 피하려고). 메뉴·토스트·로그인 드롭다운처럼 JS 뒤에 생기는 UI 는
// 전체 CSS 가 필요하므로 하이드레이션 직전에 stylesheet 로 되돌린다. 다른 경로(app.html)와 dev 서버는
// 보통의 <link rel="stylesheet"> 라 여기서 할 일이 없다.
export const FULL_CSS_ATTR = "data-full-css";

export function applyFullStylesheet(doc: Document = document): number {
  const links = doc.querySelectorAll<HTMLLinkElement>(
    `link[rel="preload"][as="style"][${FULL_CSS_ATTR}]`
  );
  links.forEach(link => {
    // rel 을 먼저 바꾼다. as 를 먼저 떼면 잠깐 as 없는 preload 가 되어 Chrome 이 경고를 낸다.
    link.rel = "stylesheet";
    link.removeAttribute("as");
  });
  return links.length;
}
