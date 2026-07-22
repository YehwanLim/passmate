import { Button } from "@/components/ui/button";
import ReportShowcase from "@/components/ReportShowcase";
import ProcessSection from "@/components/ProcessSection";
import PricingSection from "@/components/PricingSection";
import FounderSection from "@/components/FounderSection";
import SubtleBackground from "@/components/SubtleBackground";
import Logo from "@/components/Logo";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  FileSearch,
  Zap,
  Shield,
  FileText,
  Cpu,
  BarChart3,
  User,
  Rocket,
  X,
  Target,
  MessageCircle,
  Menu,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  motion,
  useScroll,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { useLocation } from "wouter";
import AuthButton from "@/components/AuthButton";

export const HOME_NAV_ITEMS = [
  { label: "서비스 소개", type: "section", target: "service-intro" },
  { label: "자소서 분석", type: "route", target: "/analyze" },
  { label: "내 지원서", type: "route", target: "/my" },
] as const;

const RESUME_READING_STEPS = [
  {
    label: "01",
    title: "먼저, 어떤 사람으로 기억되는지 봅니다",
    body: "문장을 고치기 전에 지원자가 어떤 인상으로 남는지부터 정리합니다.",
    sampleLabel: "첫인상",
    sample:
      "데이터를 근거로 문제를 찾고 실행하는 사람으로 읽힙니다. 다만 자동차 서비스와 연결되는 장면은 아직 약합니다.",
    note: "이 한 줄이 리포트의 기준점이 됩니다.",
  },
  {
    label: "02",
    title: "경험이 회사 기준과 만나는지 봅니다",
    body: "좋은 경험인지보다, 지원 회사가 찾는 기준과 어디에서 맞물리는지 확인합니다.",
    sampleLabel: "회사 맥락",
    sample:
      "3,000건의 행동 데이터 분석은 강점입니다. 이 경험이 현대자동차의 커넥티드 서비스 개선과 어떻게 이어지는지 보강하면 더 선명해집니다.",
    note: "경험과 회사 사이의 빈칸을 찾습니다.",
  },
  {
    label: "03",
    title: "문장마다 근거가 충분한지 봅니다",
    body: "성과를 말하는 문장에 판단 과정, 수치, 본인 역할이 함께 있는지 봅니다.",
    sampleLabel: "문장 피드백",
    sample:
      "‘개인화가 부족했다’는 결론은 좋지만, 어떤 고객군에서 어떤 행동이 보였는지 한 줄 더 필요합니다.",
    note: "고쳐야 할 문장을 바로 짚습니다.",
  },
  {
    label: "04",
    title: "면접에서 방어 가능한지 봅니다",
    body: "자소서에 쓴 경험이 꼬리 질문으로 이어졌을 때 흔들리지 않는지 확인합니다.",
    sampleLabel: "예상 질문",
    sample:
      "왜 클릭 패턴과 체류 시간을 가장 중요한 지표로 봤나요? 다른 지표는 검토하지 않았나요?",
    note: "서류 이후의 질문까지 미리 봅니다.",
  },
] as const;

/**
 * PassMate – Premium Dark SaaS Landing Page
 *
 * Design: Vercel / Stripe inspired pitch-black theme
 * Colors: #000000 bg, white text, subtle blue/purple neon glows
 * Fonts: Inter (EN/numbers) → Pretendard (KR) via font-stack
 * Icons: Lucide only – zero system emojis
 */

/* ─────────────────────────────────────────────────────────
   Helper Components
   ───────────────────────────────────────────────────────── */

/** Scroll-reveal wrapper – fade-in + slide-up on viewport entry */
function ScrollReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      viewport={{ once: true, margin: "-80px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Animated counter – ease-out cubic count-up when visible */
function CountUp({
  end,
  suffix = "",
  decimals = 0,
}: {
  end: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState("0");
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const duration = 2000;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const val = eased * end;
            setDisplay(
              decimals > 0
                ? val.toFixed(decimals)
                : Math.floor(val).toLocaleString()
            );
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, decimals]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

/** Character-by-character typing effect */
function TypeWriter({
  text,
  delay = 0,
}: {
  text: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayed, setDisplayed] = useState("");
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          let i = 0;
          setTimeout(() => {
            const interval = setInterval(() => {
              i++;
              setDisplayed(text.slice(0, i));
              if (i >= text.length) clearInterval(interval);
            }, 40);
          }, delay);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, delay]);

  return (
    <span ref={ref}>
      {displayed}
      {displayed.length > 0 && displayed.length < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  );
}


/* ─────────────────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────────────────── */

export default function Home() {
  const [, navigate] = useLocation();
  const [activeReadingStep, setActiveReadingStep] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const readingStep = RESUME_READING_STEPS[activeReadingStep];

  const handleNavClick = useCallback((target: string, type: string) => {
    setIsMobileMenuOpen(false);

    if (type === "section") {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    navigate(target);
  }, [navigate]);

  // Scroll progress
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
  });
  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-[#050505] text-white" style={{ overflowX: "clip" }}>
      {/* ── Subtle Background (Cursor/Linear style) ── */}
      <SubtleBackground />

      {/* ── Scroll Progress ── */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-px z-[60] origin-left"
        style={{
          scaleX: smoothProgress,
          background:
            "linear-gradient(90deg, #3B82F6, #8B5CF6)",
        }}
      />

      {/* ══════════════════════════════════════════════════
          GNB
          ══════════════════════════════════════════════════ */}
      <motion.nav
        className="sticky top-0 z-50 bg-[#050505]/35 backdrop-blur-2xl border-b border-white/[0.045]"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-6 lg:px-10">
          <div
            className="flex items-center cursor-pointer"
            onClick={() => navigate("/")}
          >
            <Logo className="w-5 h-5" textClassName="text-lg font-bold text-white" />
          </div>

          <div className="hidden sm:flex items-center gap-4 md:gap-7">
            {HOME_NAV_ITEMS.map(({ label, type, target }) => (
              <button
                key={label}
                className="landing-nav-link"
                onClick={() => handleNavClick(target, type)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <AuthButton />
            <button
              type="button"
              className="mobile-nav-toggle sm:hidden"
              aria-label="모바일 메뉴 열기"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-landing-nav"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              id="mobile-landing-nav"
              className="mobile-nav-panel sm:hidden"
              initial={{ opacity: 0, y: -8, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {HOME_NAV_ITEMS.map(({ label, type, target }) => (
                <button
                  key={label}
                  type="button"
                  className="mobile-nav-link"
                  onClick={() => handleNavClick(target, type)}
                >
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ══════════════════════════════════════════════════
          HERO  (Step 1 – Premium Centered Hero)
          ══════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">

        <div className="relative z-10 max-w-4xl mx-auto">

          {/* H1 */}
          <motion.h1
            className="text-[2.75rem] md:text-[3.75rem] lg:text-[4.5rem] font-bold leading-[1.1] tracking-[-0.03em] mb-7"
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              delay: 0.3,
              duration: 0.9,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
          >
            서류 탈락의 진짜 이유,
            <br />
            현직자는 10초면 압니다.
          </motion.h1>

          {/* Sub copy */}
          <motion.p
            className="text-[16px] md:text-[18px] text-gray-400 max-w-2xl mx-auto leading-[1.75] font-light mb-12"
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              delay: 0.5,
              duration: 0.9,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
          >
            강점은 더 선명하게, 빈틈은 더 꼼꼼하게.
            <br />
            현직자의 시선으로 &lsquo;같이 일하고 싶은 사람&rsquo;으로 기억될 수 있도록 피드백합니다.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.7,
              duration: 0.7,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
          >
            <button
              className="landing-primary-cta group"
              onClick={() => navigate("/analyze")}
            >
              <span className="relative z-10">1회 무료로 진단 받기</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STEP 2-A: Pain Point
          ══════════════════════════════════════════════════ */}
      <section className="relative py-28 md:py-36 overflow-hidden">
        {/* Subtle center glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(139,92,246,0.04) 0%, transparent 70%)",
          }}
        />

        <div className="relative max-w-3xl mx-auto px-6 lg:px-10 text-center">
          <motion.h2
            className="text-[1.75rem] md:text-[2.25rem] lg:text-[2.75rem] font-bold leading-[1.25] tracking-[-0.02em] mb-6"
            initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration: 0.9,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            viewport={{ once: true, margin: "-80px" }}
          >
            매끈하기만 한 자소서,{" "}
            <br className="hidden md:inline" />
            면접관 눈에는 다 똑같아 보입니다.
          </motion.h2>

          <motion.p
            className="text-[15px] md:text-[17px] text-gray-400 font-light leading-[1.85] max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration: 0.9,
              delay: 0.15,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            viewport={{ once: true, margin: "-80px" }}
          >
            글솜씨보다 중요한 건 &lsquo;직무에 대한 고민&rsquo;과
            &lsquo;해결 능력&rsquo;입니다. 이 회사에 꼭 필요한 인재로 보일 수
            있도록, 실무자의 기준으로 읽히는 방향을 다시 잡아야 합니다.
          </motion.p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STEP 2-B: How PassMate Reads
          ══════════════════════════════════════════════════ */}
      <section id="service-intro" className="relative py-28 md:py-36 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <ScrollReveal className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-5">
              <span className="w-4 h-px bg-gray-700" />
              핵심 분석 기능
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              PassMate는 자소서를 이렇게 읽습니다
            </h2>
            <p className="text-gray-500 font-light text-[15px] leading-[1.8] max-w-xl mx-auto">
              점수를 매기기보다, 면접관이 실제로 판단하는 흐름에 맞춰 읽습니다.
              첫인상부터 문장 근거, 회사 맥락, 면접 질문까지 이어서 봅니다.
            </p>
          </ScrollReveal>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-stretch">
            <div className="space-y-0 border-t border-white/[0.06]">
              {RESUME_READING_STEPS.map((step, index) => {
                const active = index === activeReadingStep;
                return (
                  <button
                    key={step.label}
                    type="button"
                    className={`group w-full border-b border-white/[0.06] py-5 text-left transition-colors ${
                      active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    onClick={() => setActiveReadingStep(index)}
                  >
                    <div className="grid grid-cols-[42px_1fr] gap-4">
                      <span
                        className={`text-[12px] font-semibold tracking-[0.18em] ${
                          active ? "text-emerald-300/80" : "text-zinc-700"
                        }`}
                      >
                        {step.label}
                      </span>
                      <div>
                        <h3 className="text-[17px] font-semibold leading-[1.45] tracking-tight">
                          {step.title}
                        </h3>
                        <p
                          className={`mt-2 text-[14px] font-light leading-[1.75] ${
                            active ? "text-zinc-300" : "text-zinc-600"
                          }`}
                        >
                          {step.body}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}

              <div className="reading-flow-track mt-7 grid grid-cols-4 gap-2">
                {RESUME_READING_STEPS.map((step, index) => {
                  const active = index === activeReadingStep;
                  return (
                    <button
                      key={`${step.label}-track`}
                      type="button"
                      aria-label={`${step.label} ${step.sampleLabel}`}
                      onClick={() => setActiveReadingStep(index)}
                      className="group text-left"
                    >
                      <span
                        className={`block h-1 transition-colors ${
                          active ? "bg-emerald-300/80" : "bg-white/[0.08] group-hover:bg-white/[0.18]"
                        }`}
                      />
                      <span
                        className={`mt-3 block text-[11px] font-medium tracking-[0.08em] ${
                          active ? "text-white" : "text-zinc-600 group-hover:text-zinc-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <motion.div
              key={readingStep.label}
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="reading-stage-panel relative min-h-[420px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-6 md:p-9"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_48%_at_50%_0%,rgba(16,185,129,0.09),transparent_70%)]" />
              <div className="relative flex h-full flex-col">
                <div className="mb-9 flex items-start justify-between gap-5 border-b border-white/[0.06] pb-6">
                  <div>
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-600">
                      리포트에는 이렇게 남습니다
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-semibold tracking-[0.18em] text-emerald-300/70">
                        {readingStep.label}
                      </span>
                      <span className="text-[13px] text-zinc-500">
                        {readingStep.sampleLabel}
                      </span>
                    </div>
                  </div>
                  <div className="hidden text-right text-[12px] leading-[1.7] text-zinc-600 sm:block">
                    클릭해서 단계별로 보기
                  </div>
                </div>

                <blockquote className="text-[22px] md:text-[28px] font-semibold leading-[1.55] tracking-tight text-white">
                  “{readingStep.sample}”
                </blockquote>
                <p className="mt-7 max-w-xl text-[14px] leading-[1.8] text-zinc-500">
                  {readingStep.note}
                </p>

                <div className="mt-auto pt-10">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      "표현보다 판단 기준",
                      "경험보다 연결 맥락",
                      "첨삭보다 다음 질문",
                      "전체 수정보다 우선순위",
                    ].map((item) => (
                      <div
                        key={item}
                        className="border-t border-white/[0.06] pt-3 text-[13px] text-zinc-500"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STEP 3: Report Showcase — Sticky Scroll Deep-Dive
          ══════════════════════════════════════════════════ */}
      <ReportShowcase />



      {/* ── Stats ── */}
      <section className="py-6 border-y border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-20">
            {[
              { end: 1200, suffix: "+", label: "분석 완료" },
              {
                end: 4.8,
                suffix: " / 5.0",
                label: "유저 만족도",
                decimals: 1,
              },
              { end: 10, suffix: "초", label: "평균 분석 시간" },
            ].map(({ end, suffix, label, decimals }) => (
              <div
                key={label}
                className="flex items-center gap-3"
              >
                <span className="text-[16px] font-bold text-white tabular-nums tracking-tight">
                  <CountUp
                    end={end}
                    suffix={suffix}
                    decimals={decimals ?? 0}
                  />
                </span>
                <span className="text-[13px] text-gray-600 font-light">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── System Diagram ── */}
      <section className="relative py-28 md:py-36 overflow-hidden">
        <div className="absolute inset-0 dot-grid-dark" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(59,130,246,0.04) 0%, transparent 60%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 lg:px-10">
          <ScrollReveal className="text-center mb-20">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-5">
              <span className="w-4 h-px bg-gray-700" />
              분석 파이프라인
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              자소서가 합격 리포트로 변하는 과정
            </h2>
            <p className="text-gray-500 font-light text-[15px] leading-[1.8] max-w-lg mx-auto">
              지원 직무와 회사 맥락을 기준으로 자소서의 강점과 빈틈을
              정리합니다.
            </p>
          </ScrollReveal>

          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-0">
            {/* Input */}
            <ScrollReveal delay={0} className="flex-1 w-full">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-7 text-center backdrop-blur-sm hover:border-white/[0.1] transition-all duration-300">
                <div className="w-12 h-12 bg-blue-500/[0.08] rounded-xl flex items-center justify-center mx-auto mb-5">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  자소서 입력
                </h3>
                <p className="text-[13px] text-gray-500 font-light leading-[1.7]">
                  자소서 본문, 지원 직무,
                  <br />
                  기업 정보를 입력합니다
                </p>
                <div className="mt-5 bg-white/[0.03] rounded-lg p-3 text-left">
                  <div className="h-1.5 bg-white/[0.06] rounded-full w-3/4 mb-2" />
                  <div className="h-1.5 bg-white/[0.06] rounded-full w-1/2 mb-2" />
                  <div className="h-1.5 bg-white/[0.06] rounded-full w-2/3" />
                </div>
              </div>
            </ScrollReveal>

            {/* Connector */}
            <div className="hidden md:flex items-center justify-center w-20 lg:w-28 flex-shrink-0">
              <div className="relative w-full h-[1px] bg-white/[0.06] overflow-hidden">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flow-dot absolute w-1.5 h-1.5 rounded-full bg-blue-500 top-1/2 -translate-y-1/2"
                    style={{
                      animationDelay: `${i * 0.7}s`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="md:hidden">
              <ArrowRight className="w-5 h-5 text-gray-600 rotate-90" />
            </div>

            {/* Process */}
            <ScrollReveal delay={0.15} className="flex-1 w-full">
              <div className="relative bg-white/[0.03] border border-blue-500/[0.12] rounded-2xl p-7 text-center backdrop-blur-sm hover:border-blue-500/[0.2] transition-all duration-300">
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-blue-500/[0.04] to-purple-500/[0.04] blur-sm pointer-events-none" />
                <div className="relative">
                  <div className="w-12 h-12 bg-blue-500/[0.1] rounded-xl flex items-center justify-center mx-auto mb-5">
                    <Cpu className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    맥락 정리
                  </h3>
                  <p className="text-[13px] text-gray-500 font-light leading-[1.7]">
                    지원 직무와 회사 기준을
                    <br />
                    함께 대조합니다
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 rounded-full bg-blue-500/40"
                        animate={{ height: [20, 8, 20] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Connector */}
            <div className="hidden md:flex items-center justify-center w-20 lg:w-28 flex-shrink-0">
              <div className="relative w-full h-[1px] bg-white/[0.06] overflow-hidden">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flow-dot absolute w-1.5 h-1.5 rounded-full bg-blue-500 top-1/2 -translate-y-1/2"
                    style={{
                      animationDelay: `${i * 0.7 + 1}s`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="md:hidden">
              <ArrowRight className="w-5 h-5 text-gray-600 rotate-90" />
            </div>

            {/* Output */}
            <ScrollReveal delay={0.3} className="flex-1 w-full">
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-7 text-center backdrop-blur-sm hover:border-white/[0.1] transition-all duration-300">
                <div className="w-12 h-12 bg-emerald-500/[0.08] rounded-xl flex items-center justify-center mx-auto mb-5">
                  <BarChart3 className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  리포트 생성
                </h3>
                <p className="text-[13px] text-gray-500 font-light leading-[1.7]">
                  첫인상, 강점/약점,
                  <br />
                  문장 피드백과 예상 질문 포함
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                  {["첫인상", "강점/약점", "예상 질문"].map(
                    (chip) => (
                      <span
                        key={chip}
                        className="px-2.5 py-1 bg-emerald-500/[0.08] text-emerald-400 text-[10px] font-medium rounded-full border border-emerald-500/[0.12]"
                      >
                        {chip}
                      </span>
                    )
                  )}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Process Section ── */}
      <ProcessSection />

      {/* ── Before & After ── */}
      <section className="py-28 md:py-36 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <ScrollReveal className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-5">
              <span className="w-4 h-px bg-gray-700" />
              실제 사례
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              합격하는 자소서는 구조부터 다릅니다.
            </h2>
            <p className="text-gray-500 font-light text-[15px] max-w-xl mx-auto leading-[1.8]">
              추상적인 표현을 구체적인 데이터와 의사결정 과정으로
              바꿔낸 실제 사례
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Before */}
            <ScrollReveal>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 backdrop-blur-sm h-full hover:border-white/[0.1] transition-all duration-300">
                <div className="flex items-center gap-2.5 mb-6">
                  <div className="w-6 h-6 rounded-full bg-red-500/[0.08] flex items-center justify-center">
                    <X className="w-3 h-3 text-red-400" />
                  </div>
                  <span className="text-[12px] font-medium text-red-400/80 uppercase tracking-wider">
                    개선 전
                  </span>
                </div>
                <p className="text-gray-500 text-[14px] leading-[1.9] font-light">
                  &ldquo;프로젝트를 진행하면서 많은 것을 배웠고,
                  팀원들과 협력하여 좋은 결과를 얻었습니다. 이러한
                  경험이 회사에서 도움이 될 것 같습니다.&rdquo;
                </p>
              </div>
            </ScrollReveal>

            {/* After */}
            <ScrollReveal delay={0.1}>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 backdrop-blur-sm h-full hover:border-blue-500/[0.15] transition-all duration-300">
                <div className="flex items-center gap-2.5 mb-6">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/[0.08] flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-[12px] font-medium text-emerald-400/80 uppercase tracking-wider">
                    개선 후
                  </span>
                </div>
                <p className="text-gray-400 text-[14px] leading-[1.9] font-light">
                  &ldquo;신규 사용자의 온보딩 이탈률이 35%까지 높아진 원인을 찾기 위해
                  클릭 로그 3,000건을 세그먼트별로 분석했습니다. 핵심 기능을
                  처음 접하는 시점에서 이탈이 집중된다는 점을 확인했고, 개발팀과
                  함께 첫 화면 안내 문구와 추천 흐름을 A/B 테스트했습니다. 그 결과
                  이탈률을 18%로 낮추고, 일간 활성 사용자 수를 20% 늘렸습니다.&rdquo;
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Pricing Section ── */}
      <PricingSection />

      {/* ── Founder + CTA + Footer ── */}
      <FounderSection />
    </div>
  );
}
