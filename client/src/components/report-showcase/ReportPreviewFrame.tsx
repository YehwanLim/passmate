import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";

import { REPORT_PREVIEW_SCENES } from "./reportShowcaseSampleData";
import { DiagnosisPreview } from "./scenes/DiagnosisPreview";
import { FirstImpressionPreview } from "./scenes/FirstImpressionPreview";
import { InterviewAndActionPreview } from "./scenes/InterviewAndActionPreview";
import { LineAnalysisPreview } from "./scenes/LineAnalysisPreview";

function MiniReportNavigator({
  activeIndex,
  onSelectScene,
}: {
  activeIndex: number;
  onSelectScene: (index: number) => void;
}) {
  return (
    <nav
      className="hidden xl:block w-[132px] flex-shrink-0 pt-5"
      aria-label="리포트 미리보기 목차"
    >
      <div className="report-nav-list sticky top-24">
        {REPORT_PREVIEW_SCENES.map((scene, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={scene.id}
              type="button"
              className={`report-nav-item w-full text-left ${active ? "active" : ""}`}
              onClick={() => onSelectScene(index)}
            >
              <span className="report-nav-index">{scene.indexLabel}.</span>
              <span>{scene.tab}</span>
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
        className="pb-16 lg:h-full lg:pb-0"
      >
        {activeScene.id === "impression" && <FirstImpressionPreview />}
        {activeScene.id === "diagnosis" && <DiagnosisPreview />}
        {activeScene.id === "line" && <LineAnalysisPreview />}
        {activeScene.id === "interview" && <InterviewAndActionPreview />}
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
    <div className="relative mx-auto w-full min-w-0 max-w-7xl lg:h-[min(44rem,calc(100svh-10.5rem))]">
      <div className="flex w-full gap-8 lg:h-full">
        <MiniReportNavigator
          activeIndex={activeIndex}
          onSelectScene={onSelectScene}
        />

        {/* 화살표는 목차 컬럼이 아니라 프레임 양 끝에 붙도록 이 래퍼를 기준으로 띄운다 */}
        <div className="relative min-w-0 flex-1 lg:h-full">
          <button
            type="button"
            aria-label="이전 리포트 미리보기"
            className="left-0 -translate-x-1/2 absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.16] bg-[#111]/95 text-zinc-200 shadow-xl shadow-black/30 backdrop-blur transition-[background-color,color,opacity] hover:bg-white hover:text-black disabled:pointer-events-none disabled:opacity-0 lg:flex"
            disabled={isFirstScene}
            onClick={goToPreviousScene}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            aria-label="다음 리포트 미리보기"
            className="right-0 translate-x-1/2 absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.16] bg-[#111]/95 text-zinc-200 shadow-xl shadow-black/30 backdrop-blur transition-[background-color,color,opacity] hover:bg-white hover:text-black disabled:pointer-events-none disabled:opacity-0 lg:flex"
            disabled={isLastScene}
            onClick={goToNextScene}
          >
            <ArrowRight className="h-5 w-5" />
          </button>

          <div className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-[#070707] p-4 shadow-2xl shadow-black/40 md:p-5 lg:h-full">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
            <div className="mb-4 flex flex-col gap-3 border-b border-white/[0.07] pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-[17px] md:text-[19px] font-semibold tracking-tight text-white">
                    이런 리포트를 받게 됩니다
                  </p>
                  <span className="inline-flex items-baseline gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1 text-[12px] font-semibold text-zinc-200">
                    현대자동차 · 서비스 기획
                    <span className="font-normal text-zinc-500">예시</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 xl:hidden">
                {REPORT_PREVIEW_SCENES.map((scene, index) => (
                  <button
                    key={scene.id}
                    type="button"
                    className={`h-8 rounded-md border px-3 text-[12px] font-medium transition-colors ${
                      index === activeIndex
                        ? "border-blue-500/[0.28] bg-blue-500/[0.12] text-blue-200"
                        : "border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-zinc-200"
                    }`}
                    onClick={() => onSelectScene(index)}
                  >
                    {scene.indexLabel}. {scene.tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden lg:min-h-0 lg:flex-1">
              <ActiveReportScene activeIndex={activeIndex} />
            </div>

            <div className="mt-3 flex shrink-0 items-center justify-between gap-4 border-t border-white/[0.07] pt-3">
              <div className="flex min-w-0 items-center gap-2 text-[11px] text-zinc-500">
                <span className="font-medium tabular-nums text-zinc-400">
                  {String(activeIndex + 1).padStart(2, "0")} /{" "}
                  {String(REPORT_PREVIEW_SCENES.length).padStart(2, "0")}
                </span>
              </div>

              <div className="flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  aria-label="이전 리포트 미리보기"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-[#090909]/90 text-zinc-400 transition-colors hover:bg-white hover:text-black disabled:pointer-events-none disabled:opacity-30"
                  disabled={isFirstScene}
                  onClick={goToPreviousScene}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="다음 리포트 미리보기"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-[#090909]/90 text-zinc-400 transition-colors hover:bg-white hover:text-black disabled:pointer-events-none disabled:opacity-30"
                  disabled={isLastScene}
                  onClick={goToNextScene}
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
