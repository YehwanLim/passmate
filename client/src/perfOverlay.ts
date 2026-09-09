// `/?perf=1` 로 열면 폰에서 로딩 타임라인을 화면에 찍어 준다(스크린샷용 진단 도구).
// 노트북에선 빠른데 폰에서만 5초 걸리는 문제를 잡으려고, DNS·연결·TLS·응답·첫 페인트·번들 평가 시각을
// 폰이 실제로 잰 값으로 본다. 개발자 도구를 못 붙이는 iOS 브라우저 때문에 화면에 그린다.
const r = (v: number) => (Number.isFinite(v) ? Math.round(v) : -1);

export function collectPerfReport(now: number = performance.now()): string[] {
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const lines: string[] = [];
  lines.push(`ua ${navigator.userAgent.slice(0, 90)}`);
  lines.push(`type ${nav?.type ?? "?"} proto ${nav?.nextHopProtocol || "?"} size ${nav?.transferSize ?? "?"}B`);
  if (nav) {
    lines.push(
      `dns ${r(nav.domainLookupStart)}→${r(nav.domainLookupEnd)} tcp ${r(nav.connectStart)}→${r(nav.connectEnd)} tls@${r(nav.secureConnectionStart)}`
    );
    lines.push(`req ${r(nav.requestStart)} ttfb ${r(nav.responseStart)} html-end ${r(nav.responseEnd)}`);
    lines.push(
      `dom-interactive ${r(nav.domInteractive)} dcl ${r(nav.domContentLoadedEventEnd)} load ${r(nav.loadEventEnd)}`
    );
  }
  for (const p of performance.getEntriesByType("paint")) lines.push(`${p.name} ${r(p.startTime)}`);
  for (const m of performance.getEntriesByType("mark")) lines.push(`mark ${m.name} ${r(m.startTime)}`);
  const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const pick = (re: RegExp, label: string) => {
    const e = res.find(x => re.test(x.name));
    if (e) lines.push(`${label} ${r(e.startTime)}→${r(e.responseEnd)} ${e.transferSize}B ${e.nextHopProtocol || ""}`);
  };
  pick(/landing-boot\.js/, "boot");
  pick(/\/assets\/index-[^/]*\.js/, "js");
  pick(/\/assets\/index-[^/]*\.css/, "css");
  const fonts = res.filter(x => /woff2/.test(x.name));
  if (fonts.length) {
    lines.push(
      `fonts ${fonts.length} first ${r(Math.min(...fonts.map(f => f.startTime)))} last-end ${r(Math.max(...fonts.map(f => f.responseEnd)))}`
    );
  }
  lines.push(`now ${r(now)} visible ${document.visibilityState}`);
  return lines;
}

export function mountPerfOverlay(doc: Document = document): HTMLElement | null {
  if (!new URLSearchParams(doc.location.search).has("perf")) return null;
  const pre = doc.createElement("pre");
  pre.id = "perf-overlay";
  pre.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;z-index:99999;margin:0;padding:10px 12px;" +
    "background:rgba(0,0,0,.92);color:#9ef;font:11px/1.45 ui-monospace,Menlo,monospace;" +
    "white-space:pre-wrap;word-break:break-all;max-height:70vh;overflow:auto;";
  const render = () => {
    pre.textContent = collectPerfReport().join("\n");
  };
  render();
  // load 이후 값(load, 폰트)이 채워지도록 몇 번 다시 그린다.
  [500, 2000, 5000].forEach(ms => setTimeout(render, ms));
  doc.body.appendChild(pre);
  return pre;
}
