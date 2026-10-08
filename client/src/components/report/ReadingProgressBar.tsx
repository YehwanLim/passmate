import { useEffect, useRef } from "react";

/** 0~1. 내릴 곳이 없는 짧은 페이지는 끝까지 읽은 것으로 본다. */
export function readingProgress(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const scrollable = scrollHeight - viewportHeight;
  if (!(scrollable > 0)) return 1;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}

/**
 * 리포트를 내리는 동안 지금 어디쯤인지 보여 주는 얇은 막대. 리포트 화면의 상단 메뉴는 인쇄용 감싸개 안에 있어
 * 따라 내려오지 않으므로, 막대는 화면 맨 위에 붙는다.
 * 스크롤마다 React 를 다시 그리지 않도록 rAF 로 막대의 transform 만 바꾼다.
 */
export function ReadingProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = readingProgress(window.scrollY, document.documentElement.scrollHeight, window.innerHeight);
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] print:hidden">
      <div ref={barRef} className="h-full origin-left bg-brand" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
