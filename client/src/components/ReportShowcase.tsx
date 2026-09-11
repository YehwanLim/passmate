import { useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { ReportPreviewFrame } from "@/components/report-showcase/ReportPreviewFrame";
import { REPORT_PREVIEW_SCENES } from "@/components/report-showcase/reportShowcaseSampleData";

export { REPORT_PREVIEW_SCENES };

const DESKTOP_SCROLL_PREVIEW_QUERY =
  "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

// 빠르게 스크롤해도 장면은 한 번에 하나씩만 넘어가도록 스텝 사이에 두는
// 최소 간격. AnimatePresence(mode="wait")의 퇴장 450ms + 등장 450ms가 다
// 끝나고도 장면이 잠깐 머무를 만큼 잡는다 — 이보다 짧으면 등장 중인 장면을
// 다음 스텝이 끊어서 두 장면씩 휙휙 넘어가는 것처럼 보인다.
const SCENE_STEP_INTERVAL_MS = 1300;

export function getReportPreviewSceneIndex(progress: number) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  // 장면 수만큼 균등 분할한다. 마지막 장면에 여분 구간을 주면
  // 다음 섹션으로 넘어가기까지 스크롤이 길어져 답답해진다.
  return Math.min(
    REPORT_PREVIEW_SCENES.length - 1,
    Math.floor(clampedProgress * REPORT_PREVIEW_SCENES.length)
  );
}

export function getBoundedReportPreviewSceneIndex(
  currentIndex: number,
  progress: number
) {
  const targetIndex = getReportPreviewSceneIndex(progress);

  if (targetIndex > currentIndex) return currentIndex + 1;
  if (targetIndex < currentIndex) return currentIndex - 1;

  return currentIndex;
}

export default function ReportShowcase() {
  const [, navigate] = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScrollDriven, setIsScrollDriven] = useState(false);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: scrollTrackRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_SCROLL_PREVIEW_QUERY);
    const updateScrollMode = () => setIsScrollDriven(mediaQuery.matches);

    updateScrollMode();
    mediaQuery.addEventListener("change", updateScrollMode);

    return () => mediaQuery.removeEventListener("change", updateScrollMode);
  }, []);

  // 스크롤 위치가 한 번에 두 장면 이상 건너뛰더라도, 화면은 스텝 간격을
  // 지키며 한 장면씩 따라간다. 스크롤이 멈춘 뒤에도 목표 장면까지 마저 간다.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const targetProgressRef = useRef(0);
  const lastStepAtRef = useRef(0);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stepSceneTowardScroll = () => {
    stepTimerRef.current = null;

    const nextIndex = getBoundedReportPreviewSceneIndex(
      activeIndexRef.current,
      targetProgressRef.current
    );
    if (nextIndex === activeIndexRef.current) return;

    lastStepAtRef.current = Date.now();
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    scheduleSceneStep();
  };

  const scheduleSceneStep = () => {
    if (stepTimerRef.current !== null) return;

    const wait = Math.max(
      0,
      SCENE_STEP_INTERVAL_MS - (Date.now() - lastStepAtRef.current)
    );
    stepTimerRef.current = setTimeout(stepSceneTowardScroll, wait);
  };

  useMotionValueEvent(scrollYProgress, "change", progress => {
    if (!isScrollDriven) return;

    targetProgressRef.current = progress;
    scheduleSceneStep();
  });

  useEffect(() => {
    return () => {
      if (stepTimerRef.current !== null) clearTimeout(stepTimerRef.current);
    };
  }, []);

  const goToPreviousScene = () => {
    // 수동 이동 직후에는 스크롤 보정이 바로 덮어쓰지 않도록 간격을 초기화한다.
    lastStepAtRef.current = Date.now();
    setActiveIndex(index =>
      index === 0 ? REPORT_PREVIEW_SCENES.length - 1 : index - 1
    );
  };

  const goToNextScene = () => {
    lastStepAtRef.current = Date.now();
    setActiveIndex(index => (index + 1) % REPORT_PREVIEW_SCENES.length);
  };

  return (
    <section
      id="service-intro"
      className="py-24 md:py-40 border-t border-white/[0.04]"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14 md:mb-20">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-4">
            <span className="w-4 h-px bg-gray-700" />
            리포트 미리보기
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
            합격을 설계하는 인사이트 리포트
          </h2>
          <p className="text-[15px] md:text-[16px] text-gray-500 font-light leading-[1.8] max-w-2xl mx-auto">
            점수를 매기기보다, 면접관이 실제로 판단하는 흐름대로 읽습니다. 실제
            리포트 화면 그대로 — 첫인상부터 문장 근거, 예상 질문까지 확인하세요.
          </p>
        </div>

        <div
          ref={scrollTrackRef}
          className={isScrollDriven ? "relative h-[400vh]" : "relative"}
        >
          <div
            className={
              isScrollDriven
                ? "sticky top-0 flex min-h-screen w-full items-center justify-center py-8"
                : ""
            }
          >
            <ReportPreviewFrame
              activeIndex={activeIndex}
              onSelectScene={setActiveIndex}
              goToPreviousScene={goToPreviousScene}
              goToNextScene={goToNextScene}
            />
          </div>
        </div>

        {/* 리포트를 다 본 직후가 설득이 가장 뜨거운 지점 — 중간 CTA */}
        <div className="mt-14 text-center md:mt-16">
          <button
            className="landing-primary-cta group"
            onClick={() => navigate("/analyze")}
          >
            <span className="relative z-10">내 자소서 분석해보기</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
          </button>
          <p className="mt-3.5 text-[12.5px] text-zinc-500">
            첫 분석 무료 <span className="text-zinc-700">·</span> 리포트는 1분
            안에
          </p>
        </div>
      </div>
    </section>
  );
}
