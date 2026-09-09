// 프리렌더된 랜딩(/) 전용 부트스트랩. scripts/prerender-landing.mjs 가 index.html 의
// <script type="module"> 을 <link rel="modulepreload" data-entry> + 이 파일로 바꾼다.
//
// 번들은 미리 받되(modulepreload) 평가는 첫 프레임 뒤로 미룬다. LTE 에선 번들이 HTML 과 거의 동시에
// 도착해서 WebKit(iOS 의 모든 브라우저)이 첫 페인트 전에 번들 평가를 먼저 돌려 폰에서 흰 화면이 수 초
// 이어졌다. 첫 화면 등장 애니메이션이 끝날 즈음 평가를 시작하고, 그동안 CTA 는 일반 링크로 동작한다.
// CSP script-src 가 'self' 뿐이라 인라인이 아니라 파일이다. 인자 없이 즉시 실행된다.
(function () {
  var entry = document.querySelector('link[rel="modulepreload"][data-entry]');
  if (!entry) return;
  var started = false;
  function start() {
    if (started) return;
    started = true;
    var script = document.createElement("script");
    script.type = "module";
    script.crossOrigin = "anonymous";
    script.src = entry.href;
    document.head.appendChild(script);
  }
  // 마우스 있는 기기(PC)는 첫 프레임 직후 전체 CSS(글꼴 선언 포함)를 바로 적용한다. 그래야 글꼴 조각 요청이
  // 첫 페인트 직후 나가서 시스템 글꼴 → Pretendard 교체가 스크롤 전에 끝난다. 폰은 하이드레이션 직전
  // (main.tsx applyFullStylesheet)에 적용한다: 조각 19개가 도착할 때마다 전체를 다시 배치하는 비용이
  // 번들 평가와 겹치면 폰에서 스크롤이 버벅였다.
  function applyFullStylesheetEarly() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var links = document.querySelectorAll('link[rel="preload"][as="style"][data-full-css]');
    for (var i = 0; i < links.length; i++) {
      links[i].rel = "stylesheet";
      links[i].removeAttribute("as");
    }
  }
  // rAF 는 백그라운드 탭에서 안 돌므로 5초 뒤엔 무조건 시작한다.
  window.requestAnimationFrame(function () {
    applyFullStylesheetEarly();
    window.setTimeout(start, 1200);
  });
  window.setTimeout(start, 5000);
})();
