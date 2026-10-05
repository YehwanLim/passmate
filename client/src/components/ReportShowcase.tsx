import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { ReportPreviewFrame } from "@/components/report-showcase/ReportPreviewFrame";
import { REPORT_PREVIEW_SCENES } from "@/components/report-showcase/reportShowcaseSampleData";

export { REPORT_PREVIEW_SCENES };

const DESKTOP_WHEEL_PAGING_QUERY =
  "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

// 고정 사이트 헤더(SiteHeader: h-14 + 하단 테두리 1px).
const SITE_HEADER_HEIGHT_PX = 57;

// 미리보기 블록(프레임 + CTA)이 사이트 헤더 아래 공간에 들어갔을 때 위아래로 남길 최소 여백.
const PINNED_BLOCK_MIN_MARGIN_PX = 16;

// 제자리에 있다고 보는 오차.
const PINNED_TOLERANCE_PX = 2;

// 스크롤이 제자리를 이만큼 지나쳐 있어도(휠 애니메이션이 한발 늦게 도착한 경우) 제자리로 붙잡는다.
const PIN_CATCH_PX = 160;

// 휠 이벤트가 이만큼 끊기면 새 스크롤 동작으로 본다. 트랙패드 관성 스크롤은 끊기지 않고 이어진다.
const WHEEL_GESTURE_GAP_MS = 180;

// 한 번 넘긴 뒤 이 시간 안에는 다음 동작으로 치지 않는다(장면 전환 0.35s).
const WHEEL_MIN_GESTURE_INTERVAL_MS = 350;

// 트랙패드를 스치듯 건드린 정도로는 넘기지 않는다.
const WHEEL_FLIP_MIN_DISTANCE_PX = 12;

/**
 * 휠 이벤트 흐름에서 "새로 굴리기(쓸기) 시작"을 찾는다.
 * - 틈(WHEEL_GESTURE_GAP_MS)이 있으면 새 동작이다.
 * - 틈만 보면 트랙패드로 연달아 쓸 때 관성과 다음 쓸기가 뭉쳐 영영 한 동작이 된다(멈춘 채 안 넘어감).
 * - 그렇다고 "세기가 커지면 새 동작"으로 보면, 한 번 쓰는 동안 손가락이 가속하는 구간까지 새 동작으로
 *   세어 한 번에 여러 장이 넘어가고 끝 장면에서 잠금까지 풀린다.
 * 그래서 이미 쓴 동작은 세기가 최고점에서 확실히 줄어든 뒤(관성 구간), 바닥에서 다시 크게 커질 때만
 * 새로 쓴 것으로 본다. 이벤트 몇 개씩 평균을 내 Chrome 이 이벤트를 합쳐 보낼 때의 튐을 걸러낸다.
 */
export function createWheelGestureTracker() {
  let lastWheelAt = -Infinity;
  let consumedAt = -Infinity;
  let recentDeltas: number[] = [];
  let peak = 0;
  let trough = Infinity;
  let hasDeclined = false;

  const resetShape = () => {
    recentDeltas = [];
    peak = 0;
    trough = Infinity;
    hasDeclined = false;
  };

  return {
    /** 이번 이벤트가 새 동작의 시작이면 true. */
    register(absDelta: number, now: number) {
      const gap = now - lastWheelAt;
      lastWheelAt = now;

      if (gap > WHEEL_GESTURE_GAP_MS) {
        resetShape();
        recentDeltas.push(absDelta);
        return true;
      }

      recentDeltas.push(absDelta);
      if (recentDeltas.length > 3) recentDeltas.shift();
      const smoothed =
        recentDeltas.reduce((sum, value) => sum + value, 0) /
        recentDeltas.length;

      peak = Math.max(peak, smoothed);
      if (smoothed < peak * 0.6) hasDeclined = true;
      if (!hasDeclined) return false;

      trough = Math.min(trough, smoothed);
      const isNewSwipe =
        now - consumedAt >= WHEEL_MIN_GESTURE_INTERVAL_MS &&
        smoothed > trough * 1.8 &&
        smoothed - trough > 8;
      if (isNewSwipe) {
        // 새 쓸기의 모양은 여기서부터 다시 본다.
        resetShape();
        recentDeltas.push(absDelta);
      }
      return isNewSwipe;
    },
    /** 이 동작을 장면 넘김(또는 자리 세우기)에 썼다. 이어지는 가속·관성은 같은 동작으로 본다. */
    consume(now: number) {
      consumedAt = now;
      resetShape();
    },
    get lastWheelAt() {
      return lastWheelAt;
    },
  };
}

export type ReportPreviewWheelAction = "pass" | "pin" | "hold" | "flip";

/**
 * 휠 한 번을 어떻게 처리할지.
 * - pin: 스크롤이 미리보기 자리를 지나가려 한다 → 페이지를 그 자리에 세운다.
 * - flip: 제자리에 서 있다 → 페이지는 그대로 두고 장면만 한 장 넘긴다.
 * - hold: 같은 스크롤 동작(관성 포함)이 이미 한 번 쓰였다 → 삼키기만 한다.
 * - pass: 넘길 장면이 없거나 미리보기와 무관한 위치 → 평소처럼 스크롤한다.
 * offset 은 미리보기 블록의 현재 위치 - 제자리 위치(px, 아래가 +).
 */
export function getReportPreviewWheelAction({
  offset,
  deltaY,
  activeIndex,
  gestureConsumed,
}: {
  offset: number;
  deltaY: number;
  activeIndex: number;
  gestureConsumed: boolean;
}): ReportPreviewWheelAction {
  const lastIndex = REPORT_PREVIEW_SCENES.length - 1;
  const movingDown = deltaY > 0;
  const hasSceneAhead = movingDown ? activeIndex < lastIndex : activeIndex > 0;

  if (Math.abs(offset) < PINNED_TOLERANCE_PX) {
    if (gestureConsumed) return "hold";
    return hasSceneAhead ? "flip" : "pass";
  }

  const crossesPin = movingDown
    ? offset > -PIN_CATCH_PX && offset - deltaY <= 0
    : offset < PIN_CATCH_PX && offset - deltaY >= 0;

  return crossesPin && hasSceneAhead ? "pin" : "pass";
}

// 미리보기 블록이 설 자리: 사이트 헤더 아래 남는 공간의 세로 가운데.
function getPinnedBlockTop(blockHeight: number) {
  const availableHeight = window.innerHeight - SITE_HEADER_HEIGHT_PX;
  return (
    SITE_HEADER_HEIGHT_PX +
    Math.max(PINNED_BLOCK_MIN_MARGIN_PX, (availableHeight - blockHeight) / 2)
  );
}

function getWheelDeltaY(event: WheelEvent) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * window.innerHeight;
  }
  return event.deltaY;
}

export default function ReportShowcase() {
  const [, navigate] = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isWheelPaging, setIsWheelPaging] = useState(false);
  const pinnedBlockRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_WHEEL_PAGING_QUERY);
    const updateWheelPaging = () => setIsWheelPaging(mediaQuery.matches);

    updateWheelPaging();
    mediaQuery.addEventListener("change", updateWheelPaging);

    return () => mediaQuery.removeEventListener("change", updateWheelPaging);
  }, []);

  // 한 페이지씩 넘기기: 평소처럼 스크롤하다가 미리보기가 화면 가운데 자리에 오면 페이지 스크롤을 잠그고,
  // 그때부터 휠 한 번(트랙패드면 한 번 쓸기)마다 장면만 한 장씩 넘긴다. 마지막 장면에서 더 내리면
  // (첫 장면에서 더 올리면) 잠금을 풀어 평소 스크롤로 돌아간다.
  //
  // 휠 이벤트의 preventDefault 만으로는 못 세운다: Chrome 은 스크롤 한 번의 첫 휠 이벤트만 취소할 수 있게
  // 보내고, 트랙패드로 쭉 내리다 자리에 닿는 순간은 늘 중간 이벤트다. 그래서 자리에 닿으면(휠 예측 또는
  // 스크롤 위치로 감지) 루트에 overflow: hidden 을 걸어 관성까지 멈추고, 휠은 장면 넘김 입력으로만 쓴다.
  useEffect(() => {
    if (!isWheelPaging) return;

    const root = document.documentElement;
    let isLocked = false;
    let previousOffset: number | null = null;
    const gestureTracker = createWheelGestureTracker();
    let gestureConsumed = false;
    let gestureDistance = 0;

    const getOffset = () => {
      const block = pinnedBlockRef.current;
      if (!block) return null;
      return (
        block.getBoundingClientRect().top -
        getPinnedBlockTop(block.offsetHeight)
      );
    };

    const scrollInstantlyBy = (offset: number) => {
      if (Math.abs(offset) < 0.5) return;
      // 랜딩은 html 에 scroll-behavior: smooth 가 걸려 있다. 자리에 세울 때는 즉시 옮겨야 하므로 잠깐 끈다.
      // (behavior: "instant" 는 지원하지 않는 브라우저에서 TypeError 를 던진다.)
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, window.scrollY + offset);
      root.style.scrollBehavior = previousScrollBehavior;
    };

    const lock = (offset: number, consumeGesture: boolean) => {
      scrollInstantlyBy(offset);
      // 스크롤바가 자리를 차지하는 환경(Windows 등)에서 잠글 때 화면이 옆으로 밀리지 않게 한다.
      const scrollbarWidth = window.innerWidth - root.clientWidth;
      root.style.overflow = "hidden";
      if (scrollbarWidth > 0) root.style.paddingRight = `${scrollbarWidth}px`;
      isLocked = true;
      previousOffset = 0;
      if (consumeGesture) {
        gestureConsumed = true;
        gestureTracker.consume(performance.now());
      }
    };

    const unlock = () => {
      root.style.overflow = "";
      root.style.paddingRight = "";
      isLocked = false;
    };

    const flip = (direction: 1 | -1) => {
      const nextIndex = activeIndexRef.current + direction;
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
    };

    const handleWheel = (event: WheelEvent) => {
      // ctrl + 휠은 브라우저 확대/축소(트랙패드 핀치 포함)다.
      if (event.ctrlKey) return;

      const deltaY = getWheelDeltaY(event);
      if (deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
      }

      const now = performance.now();
      const absDelta = Math.abs(deltaY);
      if (gestureTracker.register(absDelta, now)) {
        gestureConsumed = false;
        gestureDistance = 0;
      }

      let offset = getOffset();
      if (offset === null) return;
      if (isLocked && Math.abs(offset) >= PINNED_TOLERANCE_PX) {
        // Chrome 은 트랙패드 관성을 별도 스레드에서 굴려, 잠근 직후 몇 프레임 더 밀려날 수 있다 → 되돌린다.
        // 화면 하나 이상 벗어났으면 다른 경로(링크 등)로 떠난 것이니 잠금을 푼다.
        if (Math.abs(offset) < window.innerHeight) {
          scrollInstantlyBy(offset);
          offset = 0;
        } else {
          unlock();
        }
      }

      const action = getReportPreviewWheelAction({
        offset,
        deltaY,
        activeIndex: activeIndexRef.current,
        gestureConsumed,
      });

      if (action === "pass") {
        // 넘길 장면이 없으면 잠금을 풀고 평소 스크롤로 돌려보낸다. 이 휠은 잠긴 채 도착해 페이지를
        // 못 움직이므로, 휠 한 칸이 헛돌지 않게 그만큼 직접 옮겨 준다.
        if (isLocked) {
          unlock();
          if (event.cancelable) event.preventDefault();
          scrollInstantlyBy(deltaY);
        }
        return;
      }

      if (event.cancelable) event.preventDefault();

      if (action === "pin") {
        // 자리에 세운 스크롤 동작(관성 포함)으로는 장면을 넘기지 않는다 — 도착한 장면을 먼저 보게 한다.
        lock(offset, true);
        return;
      }
      // 마침 자리에 멈춰 있던 상태에서 새로 굴린 경우: 잠그고 바로 넘긴다.
      if (!isLocked) lock(offset, false);
      if (action === "hold") return;

      gestureDistance += absDelta;
      if (gestureDistance < WHEEL_FLIP_MIN_DISTANCE_PX) return;

      gestureConsumed = true;
      gestureTracker.consume(now);
      flip(deltaY > 0 ? 1 : -1);
    };

    // 휠 예측이 놓친 경우(취소할 수 없는 휠 이벤트가 이미 자리를 지나쳤을 때): 휠로 스크롤하다 자리를
    // 가로지르면 되돌려 세운다. 스크롤바·키보드 이동은 붙잡지 않는다.
    const handleScroll = () => {
      const offset = getOffset();
      if (offset === null) return;

      if (isLocked) {
        // 잠긴 뒤에도 밀려난 관성 프레임은 제자리로 되돌린다(위 휠 처리와 같은 이유).
        if (Math.abs(offset) < window.innerHeight) scrollInstantlyBy(offset);
        else unlock();
        return;
      }

      const lastIndex = REPORT_PREVIEW_SCENES.length - 1;
      const isWheelScrolling =
        performance.now() - gestureTracker.lastWheelAt <
        WHEEL_GESTURE_GAP_MS * 2;
      const crossedDown =
        previousOffset !== null &&
        previousOffset > 0 &&
        offset <= 0 &&
        activeIndexRef.current < lastIndex;
      const crossedUp =
        previousOffset !== null &&
        previousOffset < 0 &&
        offset >= 0 &&
        activeIndexRef.current > 0;
      previousOffset = offset;

      if (isWheelScrolling && (crossedDown || crossedUp)) lock(offset, true);
    };

    // 잠겨 있는 동안 키보드로도 장면을 넘기거나 빠져나갈 수 있게 한다.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isLocked || event.defaultPrevented) return;
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }

      const direction =
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        (event.key === " " && !event.shiftKey)
          ? 1
          : event.key === "ArrowUp" ||
              event.key === "PageUp" ||
              (event.key === " " && event.shiftKey)
            ? -1
            : null;
      if (direction === null) return;

      const lastIndex = REPORT_PREVIEW_SCENES.length - 1;
      const nextIndex = activeIndexRef.current + direction;
      if (nextIndex < 0 || nextIndex > lastIndex) {
        unlock();
        return;
      }
      event.preventDefault();
      flip(direction);
    };

    // 잠긴 동안 페이지 안 링크(#...)를 누르면, 되돌리기가 그 이동을 막지 않도록 먼저 잠금을 푼다.
    const handleClick = (event: MouseEvent) => {
      if (
        isLocked &&
        event.target instanceof Element &&
        event.target.closest('a[href*="#"]')
      ) {
        unlock();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClick, true);
      unlock();
    };
  }, [isWheelPaging]);

  const goToScene = (index: number) => {
    setActiveIndex(
      Math.min(REPORT_PREVIEW_SCENES.length - 1, Math.max(0, index))
    );
  };

  return (
    <section
      id="service-intro"
      className="border-t border-white/[0.04] pb-16 pt-24 md:pb-24 md:pt-40"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
            합격을 설계하는 인사이트 리포트
          </h2>
          <p className="text-[15px] md:text-[16px] text-gray-500 font-light leading-[1.8] max-w-3xl mx-auto">
            점수를 매기기보다, 면접관에게 내 자소서가 어떻게 보일지 그 흐름을
            따라가요. 내 자소서의 첫인상과 문장별 피드백, 예상 질문, 당장
            준비해야 할 것들, 채용 공고와 핏한 정도까지 모두 확인해보세요.
          </p>
        </div>

        {/* 리포트를 다 본 직후가 설득이 가장 뜨거운 지점 — 중간 CTA 를 프레임 바로 아래에 붙여,
            페이지가 멈춰 장면을 넘기는 동안에도 리포트와 버튼이 한 화면에 함께 있게 한다. */}
        <div
          ref={pinnedBlockRef}
          data-report-preview-block
          className="flex flex-col gap-8 lg:gap-6"
        >
          <ReportPreviewFrame
            activeIndex={activeIndex}
            onSelectScene={goToScene}
            goToPreviousScene={() => goToScene(activeIndex - 1)}
            goToNextScene={() => goToScene(activeIndex + 1)}
          />
          <div className="text-center">
            <button
              className="landing-primary-cta group"
              data-funnel-cta="showcase"
              onClick={() => navigate("/analyze")}
            >
              <span className="relative z-10">내 자소서 분석해보기</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
