import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Link } from "wouter";

import { RESUME_REPORT_SAMPLE_PATH } from "@/constants/resumeReportSampleMeta";

import { REPORT_PREVIEW_SCENES } from "./reportShowcaseSampleData";

// 실제 리포트 섹션 + 예시 데이터(약 100KB)는 첫 화면 아래라 랜딩 본 번들과 따로 받는다.
// 프리렌더(entry-server)는 lazy 가 준비될 때까지 다시 그리므로 HTML 에는 그대로 구워진다.
const LiveReportPreview = lazy(() => import("./LiveReportPreview"));

function MiniReportNavigator({
  activeIndex,
  onSelectScene,
}: {
  activeIndex: number;
  onSelectScene: (index: number) => void;
}) {
  return (
    <nav
      className="hidden w-[164px] flex-shrink-0 border-r border-line-soft py-6 pl-[18px] pr-3.5 xl:block"
      aria-label="리포트 미리보기 목차"
    >
      <div className="flex flex-col gap-1">
        {REPORT_PREVIEW_SCENES.map((scene, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={scene.id}
              type="button"
              className={`flex h-10 w-full items-center rounded-[10px] px-3 text-left text-[14px] transition-colors ${
                active
                  ? "bg-brand-soft font-bold text-brand-ink"
                  : "font-semibold text-ink-4 hover:bg-fill hover:text-ink-2"
              }`}
              onClick={() => onSelectScene(index)}
            >
              {scene.indexLabel}. {scene.tab}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// 다음 장면은 오른쪽에서 들어오고 이전 장면은 왼쪽으로 빠진다 — 화살표 방향과 같은 한 장씩 넘기는 움직임.
const sceneSlide = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 56 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -56 }),
};

function ActiveReportScene({ activeIndex }: { activeIndex: number }) {
  const activeScene = REPORT_PREVIEW_SCENES[activeIndex];
  const [previousIndex, setPreviousIndex] = useState(activeIndex);
  const [direction, setDirection] = useState(1);

  if (previousIndex !== activeIndex) {
    setDirection(activeIndex > previousIndex ? 1 : -1);
    setPreviousIndex(activeIndex);
  }

  // initial={false}: 첫 마운트에선 등장 애니메이션을 건너뛴다. 프리렌더 HTML 에 opacity:0 이 구워지면
  // JS 가 올 때까지 리포트 미리보기가 통째로 비어 보인다.
  // popLayout: 나가는 장면과 들어오는 장면이 겹쳐 움직여, 사이에 빈 프레임이 끼지 않는다.
  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={activeScene.id}
        custom={direction}
        variants={sceneSlide}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="lg:h-full"
      >
        <Suspense fallback={<div className="h-[36rem] rounded-3xl bg-fill-soft" />}>
          <LiveReportPreview sceneId={activeScene.id} />
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

/** 리포트 미리보기 프레임: 목차 + 화살표 + 헤더 + 활성 장면 + 페이지 표시. */
export function ReportPreviewFrame({
  activeIndex,
  onSelectScene,
  goToPreviousScene,
  goToNextScene,
}: {
  activeIndex: number;
  onSelectScene: (index: number) => void;
  goToPreviousScene: () => void;
  goToNextScene: () => void;
}) {
  const isFirstScene = activeIndex === 0;
  const isLastScene = activeIndex === REPORT_PREVIEW_SCENES.length - 1;

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-7xl lg:h-[min(44rem,calc(100svh-11.5rem))]">
      {/* 화살표는 흰 카드 양 끝에 붙도록 이 래퍼를 기준으로 띄운다 */}
      <button
        type="button"
        aria-label="이전 리포트 미리보기"
        className="absolute left-0 top-1/2 z-20 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-[0_4px_16px_rgba(25,31,40,0.12)] transition-[background-color,opacity] hover:bg-fill disabled:pointer-events-none disabled:opacity-0 lg:flex"
        disabled={isFirstScene}
        onClick={goToPreviousScene}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        aria-label="다음 리포트 미리보기"
        className="absolute right-0 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-[0_4px_16px_rgba(25,31,40,0.12)] transition-[background-color,opacity] hover:bg-fill disabled:pointer-events-none disabled:opacity-0 lg:flex"
        disabled={isLastScene}
        onClick={goToNextScene}
      >
        <ArrowRight className="h-5 w-5" />
      </button>

      <div className="relative flex min-w-0 flex-col overflow-hidden rounded-[24px] bg-surface shadow-[0_8px_32px_rgba(25,31,40,0.06)] md:rounded-[32px] lg:h-full">
        <div className="flex flex-col gap-3 border-b border-line-soft px-5 py-4 md:px-8 md:py-[18px] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <p className="text-[16px] font-bold tracking-[-0.02em] text-ink">
              이런 리포트를 받게 됩니다
            </p>
            <span className="inline-flex h-7 items-center rounded-[8px] bg-fill px-2.5 text-[13px] font-semibold text-ink-2">
              현대자동차 · 서비스 기획
            </span>
            <span className="text-[13px] text-ink-4">예시</span>
          </div>
          <div className="flex flex-wrap gap-1.5 xl:hidden">
            {REPORT_PREVIEW_SCENES.map((scene, index) => (
              <button
                key={scene.id}
                type="button"
                className={`h-8 rounded-[8px] px-3 text-[13px] transition-colors ${
                  index === activeIndex
                    ? "bg-brand-soft font-bold text-brand-ink"
                    : "bg-fill font-semibold text-ink-4 hover:text-ink-2"
                }`}
                onClick={() => onSelectScene(index)}
              >
                {scene.indexLabel}. {scene.tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 lg:min-h-0 lg:flex-1">
          <MiniReportNavigator
            activeIndex={activeIndex}
            onSelectScene={onSelectScene}
          />
          {/* 실제 리포트 섹션은 이 칸보다 길다. 아래를 흐리게 잘라 "미리보기"로 두고, 끝까지는 예시 리포트에서 본다.
              모바일은 칸 높이를 고정하지 않아 max-h 로 같은 효과를 낸다. */}
          <div className="relative min-w-0 flex-1 overflow-hidden max-lg:max-h-[34rem] lg:min-h-0">
            <ActiveReportScene activeIndex={activeIndex} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-surface to-transparent" />
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
              <Link
                href={RESUME_REPORT_SAMPLE_PATH}
                data-funnel-cta="sample"
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-surface px-4 text-[14px] font-bold text-ink-2 shadow-[0_4px_16px_rgba(25,31,40,0.12)] transition-colors hover:bg-fill"
              >
                예시 리포트 전체 보기
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-line-soft px-5 py-3.5 md:px-8">
          <span className="text-[13px] font-semibold tabular-nums text-ink-4">
            {String(activeIndex + 1).padStart(2, "0")} /{" "}
            {String(REPORT_PREVIEW_SCENES.length).padStart(2, "0")}
          </span>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              aria-label="이전 리포트 미리보기"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-fill text-ink-2 transition-colors hover:bg-line disabled:pointer-events-none disabled:opacity-30"
              disabled={isFirstScene}
              onClick={goToPreviousScene}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="다음 리포트 미리보기"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-fill text-ink-2 transition-colors hover:bg-line disabled:pointer-events-none disabled:opacity-30"
              disabled={isLastScene}
              onClick={goToNextScene}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
