import { Button } from "@/components/ui/button";
import ReportShowcase from "@/components/ReportShowcase";
import ProcessSection from "@/components/ProcessSection";
import PricingSection from "@/components/PricingSection";
import FounderSection from "@/components/FounderSection";
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
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { useLocation } from "wouter";

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
  const [hoveredMetric, setHoveredMetric] = useState<number | null>(null);

  // 3D tilt for interactive card
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll progress
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
  });

  const handleCardMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width - 0.5;
      const cy = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({ x: cy * -10, y: cx * 10 });
    },
    []
  );
  const handleCardMouseLeave = useCallback(
    () => setTilt({ x: 0, y: 0 }),
    []
  );

  // Score card metric data
  const metrics = [
    {
      label: "논리 구조",
      value: "A",
      color: "text-emerald-400",
      detail: "STAR 기법 완벽 적용",
    },
    {
      label: "직무 적합",
      value: "B+",
      color: "text-blue-400",
      detail: "키워드 매칭률 78%",
    },
    {
      label: "설득력",
      value: "A-",
      color: "text-amber-400",
      detail: "정량 데이터 포함",
    },
  ];

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-[#000000] text-white" style={{ overflowX: "clip" }}>
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
        className="sticky top-0 z-50 bg-[#000]/70 backdrop-blur-2xl border-b border-white/[0.06]"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-6 lg:px-10">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-[14px] font-semibold tracking-tight">
              PassMate
            </span>
          </div>

          <div className="hidden md:flex items-center gap-7">
            {[
              "자소서 분석",
              "취준 OS 가이드",
              "1:1 멘토링",
              "합격 포스트",
            ].map((label, i) => (
              <span
                key={label}
                className="text-[13px] text-gray-500 hover:text-white transition-colors duration-200 cursor-pointer"
                onClick={() => i === 0 && navigate("/analyze")}
              >
                {label}
              </span>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-[13px] text-gray-500 hover:text-white font-medium h-8 px-3"
          >
            로그인
          </Button>
        </div>
      </motion.nav>

      {/* ══════════════════════════════════════════════════
          HERO  (Step 1 – Premium Centered Hero)
          ══════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Background aura */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[1200px] h-[700px]"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(59,130,246,0.07) 0%, rgba(139,92,246,0.03) 40%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Announcement Badge */}
          <motion.a
            href="#"
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm text-[13px] text-gray-400 hover:border-blue-500/30 hover:text-gray-300 transition-all duration-300 cursor-pointer mb-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.1,
              duration: 0.7,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
          >
            <Rocket className="w-3.5 h-3.5 text-blue-400" />
            <span>
              <span className="font-semibold text-blue-400">[New]</span>{" "}
              현직 삼성·현차 PM의 합격 로직 데이터베이스 업데이트 완료
            </span>
            <ArrowRight className="w-3 h-3 text-gray-600 group-hover:translate-x-0.5 transition-transform duration-200" />
          </motion.a>

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
            단순한 스펙 나열은 그만. 실무진이 당장 &lsquo;같이 일하고 싶은
            사람&rsquo;으로 느낄 수 있도록, 현직 PM의 시선으로 분석한 인사이트
            리포트를 받아보세요.
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
              className="group inline-flex items-center gap-2 bg-white text-[#000] h-12 px-7 rounded-[10px] text-[14px] font-medium transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] hover:bg-gray-100 active:scale-[0.98]"
              onClick={() => navigate("/analyze")}
            >
              내 자소서 무료로 진단받기
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
            매끄러운 AI 자소서,{" "}
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
            있도록, 실무자의 기준으로 합격 로직을 재설계해야 합니다.
          </motion.p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STEP 2-B: How it Works — 6-Card Feature Grid
          ══════════════════════════════════════════════════ */}
      <section className="relative py-28 md:py-36 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <ScrollReveal className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-5">
              <span className="w-4 h-px bg-gray-700" />
              핵심 분석 기능
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              현직자 기준으로 설계된 6가지 분석 엔진
            </h2>
            <p className="text-gray-500 font-light text-[15px] leading-[1.8] max-w-xl mx-auto">
              단순 첨삭이 아닌, 합격을 위한 전략적 인사이트를 제공합니다.
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Target,
                title: "직무 적합도 (JD Fit) 매칭",
                desc: "채용 공고(JD) 요구 역량과 자소서 비교, 합격 기준 대비 Fit 점수 도출.",
              },
              {
                icon: BarChart3,
                title: "종합 점수 및 합격 예측",
                desc: "현직자 평가 로직 기반 완성도 수치화, 항목별 밸런스 진단.",
              },
              {
                icon: Zap,
                title: "나만의 킬러 소재 발굴",
                desc: "수많은 경험 중 실무진의 눈길을 사로잡을 강력한 무기 추출.",
              },
              {
                icon: CheckCircle2,
                title: "경험 팩트 체크",
                desc: "모호하고 추상적인 표현 필터링, 구체적인 성과와 과정의 논리성 검증.",
              },
              {
                icon: Shield,
                title: "객관적 강점·약점 분석",
                desc: "진짜 역량(강점) 파악 및 논리가 비약되는 치명적 결함(약점) 진단.",
              },
              {
                icon: MessageCircle,
                title: "자소서 맞춤형 예상 질문",
                desc: "이력서 바탕의 예상 꼬리 질문 리스트 및 실전 방어 가이드 제공.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <ScrollReveal key={title} delay={i * 0.07}>
                <motion.div
                  className="group relative bg-[#0A0A0A] border border-white/[0.08] rounded-2xl p-7 h-full backdrop-blur-sm transition-colors duration-500 hover:border-white/[0.16]"
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  {/* Hover glow overlay */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/[0.03] via-transparent to-purple-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className="relative">
                    <div className="w-10 h-10 bg-white/[0.04] rounded-xl flex items-center justify-center mb-5 group-hover:bg-white/[0.07] transition-colors duration-300">
                      <Icon className="w-[18px] h-[18px] text-gray-500 group-hover:text-white transition-colors duration-300" />
                    </div>
                    <h3 className="text-[15px] font-semibold text-white mb-2.5 tracking-[-0.01em]">
                      {title}
                    </h3>
                    <p className="text-[13px] text-gray-500 font-light leading-[1.8]">
                      {desc}
                    </p>
                  </div>
                </motion.div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STEP 3: Report Showcase — Sticky Scroll Deep-Dive
          ══════════════════════════════════════════════════ */}
      <ReportShowcase />

      {/* ── Interactive Demo Card ── */}
      <section className="relative py-12 md:py-20 px-6">
        <div className="max-w-xl mx-auto">
          <ScrollReveal>
            <div
              ref={cardRef}
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              style={{
                transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transformStyle: "preserve-3d",
                transition: "transform 0.2s ease-out",
              }}
            >
              <div className="relative">
                {/* Glow */}
                <div
                  className="absolute -inset-8 rounded-3xl blur-3xl opacity-60"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(59,130,246,0.1) 0%, transparent 70%)",
                  }}
                />

                {/* Card */}
                <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-2xl backdrop-blur-md overflow-hidden">
                  {/* Window chrome */}
                  <div className="flex items-center gap-1.5 px-5 py-3 border-b border-white/[0.06]">
                    <div className="w-2 h-2 rounded-full bg-white/[0.08]" />
                    <div className="w-2 h-2 rounded-full bg-white/[0.08]" />
                    <div className="w-2 h-2 rounded-full bg-white/[0.08]" />
                    <span className="ml-3 text-[11px] text-gray-600 font-medium tracking-wide">
                      PassMate — 분석 리포트
                    </span>
                  </div>

                  <div className="p-7 space-y-6">
                    {/* Score ring */}
                    <div className="text-center py-2">
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.2em] mb-4">
                        현직자 점수
                      </p>
                      <div className="relative inline-flex items-center justify-center">
                        <svg
                          className="w-28 h-28"
                          viewBox="0 0 120 120"
                        >
                          <circle
                            cx="60"
                            cy="60"
                            r="50"
                            fill="none"
                            stroke="rgba(255,255,255,0.04)"
                            strokeWidth="6"
                          />
                          <defs>
                            <linearGradient
                              id="scoreGrad"
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="100%"
                            >
                              <stop
                                offset="0%"
                                stopColor="#3B82F6"
                              />
                              <stop
                                offset="100%"
                                stopColor="#8B5CF6"
                              />
                            </linearGradient>
                          </defs>
                          <motion.circle
                            cx="60"
                            cy="60"
                            r="50"
                            fill="none"
                            stroke="url(#scoreGrad)"
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${82 * 3.14} ${100 * 3.14}`}
                            transform="rotate(-90 60 60)"
                            initial={{
                              strokeDasharray: `0 ${100 * 3.14}`,
                            }}
                            whileInView={{
                              strokeDasharray: `${82 * 3.14} ${100 * 3.14}`,
                            }}
                            transition={{
                              duration: 1.8,
                              delay: 0.3,
                              ease: "easeOut",
                            }}
                            viewport={{ once: true }}
                          />
                        </svg>
                        <motion.span
                          className="absolute text-3xl font-bold tracking-tight"
                          initial={{ opacity: 0, scale: 0.5 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          transition={{
                            delay: 1,
                            type: "spring",
                            stiffness: 200,
                          }}
                          viewport={{ once: true }}
                        >
                          82
                        </motion.span>
                      </div>
                    </div>

                    {/* Interactive Metrics */}
                    <div className="grid grid-cols-3 gap-3">
                      {metrics.map(
                        ({ label, value, color, detail }, i) => (
                          <motion.div
                            key={label}
                            className="relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 text-center cursor-pointer"
                            onMouseEnter={() =>
                              setHoveredMetric(i)
                            }
                            onMouseLeave={() =>
                              setHoveredMetric(null)
                            }
                            whileHover={{
                              borderColor:
                                "rgba(255,255,255,0.15)",
                              backgroundColor:
                                "rgba(255,255,255,0.05)",
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-[0.15em] mb-1">
                              {label}
                            </p>
                            <p
                              className={`text-lg font-bold ${color}`}
                            >
                              {value}
                            </p>
                            <AnimatePresence>
                              {hoveredMetric === i && (
                                <motion.div
                                  className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/[0.06] border border-white/[0.1] backdrop-blur-xl text-[10px] text-gray-300 px-3 py-1.5 rounded-lg whitespace-nowrap z-20"
                                  initial={{
                                    opacity: 0,
                                    y: 4,
                                  }}
                                  animate={{
                                    opacity: 1,
                                    y: 0,
                                  }}
                                  exit={{
                                    opacity: 0,
                                    y: 4,
                                  }}
                                  transition={{
                                    duration: 0.15,
                                  }}
                                >
                                  {detail}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )
                      )}
                    </div>

                    {/* Typing status */}
                    <div className="flex items-center gap-2 bg-blue-500/[0.06] border border-blue-500/[0.1] rounded-lg px-4 py-2.5">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                      <span className="text-[11px] text-blue-400 font-medium">
                        <TypeWriter
                          text="PM 어드바이스 준비 완료 — 3건의 제안이 생성되었습니다"
                          delay={600}
                        />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

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
              현직 PM의 합격 로직을 학습한 AI가 당신의 자소서를
              분석합니다.
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
                    AI 분석 엔진
                  </h3>
                  <p className="text-[13px] text-gray-500 font-light leading-[1.7]">
                    합격 로직 + 현직자 데이터
                    <br />
                    기반 다차원 분석
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
                  종합 점수, 강점/약점,
                  <br />
                  예상 질문 3건 포함
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                  {["점수 82점", "강점 3건", "예상 질문"].map(
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
              추상적인 표현에서 구체적인 데이터와 STAR 기법으로
              개선된 실제 사례
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
                <div className="space-y-2.5 text-[14px] text-gray-400 leading-[1.9] font-light">
                  <p>
                    <span className="text-white font-medium">
                      S:
                    </span>{" "}
                    사용자 이탈률 35% 증가 상황
                  </p>
                  <p>
                    <span className="text-white font-medium">
                      T:
                    </span>{" "}
                    3주 내 개선안 도출
                  </p>
                  <p>
                    <span className="text-white font-medium">
                      A:
                    </span>{" "}
                    A/B 테스트 3회 진행, 데이터 분석
                  </p>
                  <p>
                    <span className="text-white font-medium">
                      R:
                    </span>{" "}
                    이탈률 18% 감소, 월 매출 12% 증가
                  </p>
                </div>
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
