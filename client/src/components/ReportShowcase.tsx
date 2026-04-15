import { useRef, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

/* ─────────────────────────────────────────────────────────
   Report Showcase — Sticky Scroll Deep-Dive
   ───────────────────────────────────────────────────────── */

const showcaseSteps = [
  {
    headline: "팩트에 기반한 경험 검증",
    text: "추상적인 문장이 구체적 수치와 성과로 지적되는 팩트 체크 과정을 확인하세요.",
  },
  {
    headline: "JD 매칭 딥다이브",
    text: "채용 공고의 핵심 키워드와 내 이력서가 얼마나 일치하는지 객관적인 Fit 점수로 확인하세요.",
  },
  {
    headline: "완벽한 방어 시나리오",
    text: "내 자소서의 약점을 파고드는 날카로운 꼬리 질문과 모범 답변 가이드로 실전 면접을 대비하세요.",
  },
];

export default function ReportShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Smooth scale — gentle zoom to feel like focusing in
  const rawScale = useTransform(scrollYProgress, [0, 0.1, 0.9], [1, 1.12, 1.12]);
  const smoothScale = useSpring(rawScale, { stiffness: 100, damping: 30 });

  // Text crossfade opacities — each step owns a third of the scroll
  // With 400vh runway, progress reaches ~0.75 reliably before exit
  const step1Opacity = useTransform(scrollYProgress, [0.02, 0.08, 0.25, 0.30], [0, 1, 1, 0]);
  const step2Opacity = useTransform(scrollYProgress, [0.30, 0.36, 0.52, 0.57], [0, 1, 1, 0]);
  const step3Opacity = useTransform(scrollYProgress, [0.57, 0.63, 0.85, 0.95], [0, 1, 1, 1]);

  const stepOpacities = [step1Opacity, step2Opacity, step3Opacity];

  // Transform origins for each dashboard region (where the zoom anchors)
  const ORIGINS = ["50% 20%", "50% 50%", "50% 80%"];

  // Track the active step for region highlighting
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (v) => {
      if (v < 0.30) setCurrentStep(0);
      else if (v < 0.57) setCurrentStep(1);
      else setCurrentStep(2);
    });
    return unsubscribe;
  }, [scrollYProgress]);

  return (
    <section className="relative border-t border-white/[0.04]">
      {/* Scroll runway — 400vh gives us ample room for 3 phases */}
      <div ref={containerRef} className="relative" style={{ height: "400vh" }}>
        {/* Sticky container */}
        <div className="sticky top-0 h-screen flex flex-col overflow-hidden">
          {/* Section header */}
          <div className="flex-shrink-0 pt-14 pb-6 text-center px-6">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-4">
              <span className="w-4 h-px bg-gray-700" />
              리포트 미리보기
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              합격을 설계하는 인사이트 리포트
            </h2>
          </div>

          {/* Split-screen content */}
          <div className="flex-1 flex flex-col lg:flex-row items-stretch gap-6 lg:gap-10 px-6 lg:px-10 max-w-7xl mx-auto w-full min-h-0 pb-10">
            {/* ─── Left: Mock Dashboard ─── */}
            <div className="flex-1 flex items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0A0A0A] w-full lg:max-w-[55%]">
              <motion.div
                className="w-full transition-[transform-origin] duration-700 ease-out"
                style={{
                  scale: smoothScale,
                  transformOrigin: ORIGINS[currentStep],
                }}
              >
                {/* ── Dashboard mockup ── */}
                <div className="p-5 md:p-6 space-y-4 select-none pointer-events-none">

                  {/* Window chrome */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full bg-white/[0.08]" />
                    <div className="w-2 h-2 rounded-full bg-white/[0.08]" />
                    <div className="w-2 h-2 rounded-full bg-white/[0.08]" />
                    <span className="ml-3 text-[10px] text-gray-600 font-medium tracking-wide">PassMate — Insight Report</span>
                  </div>

                  {/* Region 1: Fact Check */}
                  <div className={`bg-white/[0.03] rounded-xl p-4 space-y-3 border transition-all duration-500 ${
                    currentStep === 0 ? "border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.08)]" : "border-white/[0.06]"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1 h-4 bg-blue-500 rounded-full" />
                      <span className="text-[11px] font-semibold text-gray-300 tracking-wide">경험 팩트 체크</span>
                    </div>

                    {/* Mock highlighted text */}
                    <div className="space-y-2 text-[10px] md:text-[11px] leading-[1.7]">
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 mt-0.5 w-4 h-4 bg-red-500/[0.15] rounded flex items-center justify-center">
                          <X className="w-2.5 h-2.5 text-red-400" />
                        </span>
                        <p className="text-gray-500">
                          &ldquo;프로젝트를 통해 <span className="bg-red-500/[0.12] text-red-400 px-1 rounded">많은 것을 배웠고</span> 좋은 결과를 얻었습니다.&rdquo;
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 mt-0.5 w-4 h-4 bg-emerald-500/[0.15] rounded flex items-center justify-center">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        </span>
                        <p className="text-gray-400">
                          &ldquo;3주간 A/B 테스트를 통해 이탈률을 <span className="bg-emerald-500/[0.12] text-emerald-400 px-1 rounded font-semibold">35% → 18%</span>로 개선&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Region 2: JD Match Score */}
                  <div className={`bg-white/[0.03] rounded-xl p-4 border transition-all duration-500 ${
                    currentStep === 1 ? "border-purple-500/30 shadow-[0_0_15px_rgba(139,92,246,0.08)]" : "border-white/[0.06]"
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-4 bg-purple-500 rounded-full" />
                      <span className="text-[11px] font-semibold text-gray-300 tracking-wide">JD 매칭 분석</span>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                      {/* Score circle */}
                      <div className="flex-shrink-0">
                        <svg className="w-14 h-14 md:w-16 md:h-16" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
                          <circle
                            cx="32" cy="32" r="26" fill="none"
                            stroke="url(#jdGrad)" strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={`${78 * 1.63} ${100 * 1.63}`}
                            transform="rotate(-90 32 32)"
                          />
                          <defs>
                            <linearGradient id="jdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#8B5CF6" />
                              <stop offset="100%" stopColor="#3B82F6" />
                            </linearGradient>
                          </defs>
                          <text x="32" y="35" textAnchor="middle" className="fill-white text-[14px] font-bold">78</text>
                        </svg>
                      </div>

                      {/* Keyword bars */}
                      <div className="flex-1 space-y-1.5">
                        {[
                          { label: "문제 해결", pct: 92 },
                          { label: "데이터 분석", pct: 78 },
                          { label: "협업/리더십", pct: 65 },
                          { label: "기획력", pct: 45 },
                        ].map(({ label, pct }) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-[8px] md:text-[9px] text-gray-500 w-14 md:w-16 flex-shrink-0 text-right">{label}</span>
                            <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: pct > 70
                                    ? "linear-gradient(90deg, #3B82F6, #8B5CF6)"
                                    : "rgba(255,255,255,0.1)",
                                }}
                              />
                            </div>
                            <span className="text-[8px] text-gray-600 w-6 text-right">{pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                      {["문제정의", "가설검증", "정량분석", "A/B테스트"].map((kw) => (
                        <span key={kw} className="px-2 py-0.5 bg-purple-500/[0.08] text-purple-400 text-[8px] md:text-[9px] font-medium rounded-full border border-purple-500/[0.12]">
                          {kw}
                        </span>
                      ))}
                      {["UX리서치", "프레젠테이션"].map((kw) => (
                        <span key={kw} className="px-2 py-0.5 bg-white/[0.03] text-gray-600 text-[8px] md:text-[9px] font-medium rounded-full border border-white/[0.06]">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Region 3: Q&A */}
                  <div className={`bg-white/[0.03] rounded-xl p-4 space-y-2.5 border transition-all duration-500 ${
                    currentStep === 2 ? "border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.08)]" : "border-white/[0.06]"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1 h-4 bg-amber-500 rounded-full" />
                      <span className="text-[11px] font-semibold text-gray-300 tracking-wide">예상 꼬리 질문</span>
                    </div>

                    {[
                      { q: "이탈률 개선 시 고려한 주요 변수는?", diff: "상" },
                      { q: "A/B 테스트 외 대안 방법론은?", diff: "중" },
                      { q: "팀 내 반대 의견은 어떻게 설득했나요?", diff: "상" },
                    ].map(({ q, diff }, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                        <span className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-bold ${
                          diff === "상"
                            ? "bg-red-500/[0.12] text-red-400"
                            : "bg-amber-500/[0.12] text-amber-400"
                        }`}>
                          난이도 {diff}
                        </span>
                        <p className="text-[9px] md:text-[10px] text-gray-400 leading-[1.6]">{q}</p>
                      </div>
                    ))}

                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                      <span className="text-[8px] md:text-[9px] text-amber-400/70 font-medium">모범 답변 가이드 포함</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ─── Right: Crossfading text ─── */}
            <div className="flex-1 relative flex items-center justify-center w-full lg:max-w-[45%] min-h-[280px]">
              {/* Step indicators */}
              <div className="absolute left-6 lg:left-10 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1 h-6 rounded-full transition-colors duration-500"
                    style={{
                      backgroundColor: currentStep === i
                        ? "rgba(59,130,246,0.8)"
                        : "rgba(255,255,255,0.06)",
                    }}
                  />
                ))}
              </div>

              {/* Text layers */}
              {showcaseSteps.map(({ headline, text }, i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 flex flex-col justify-center px-8 lg:px-20"
                  style={{ opacity: stepOpacities[i] }}
                >
                  <span className="text-[11px] font-semibold text-blue-400 tracking-wider mb-3 block">
                    0{i + 1}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-4 leading-snug">
                    {headline}
                  </h3>
                  <p className="text-[15px] text-gray-400 font-light leading-[1.85] max-w-sm">
                    {text}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
