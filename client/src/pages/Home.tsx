import { Button } from "@/components/ui/button";
import ReportShowcase from "@/components/ReportShowcase";
import SocialProofSection from "@/components/SocialProofSection";
import { BrandName } from "@/components/BrandName";
import ProcessSection from "@/components/ProcessSection";
import PricingSection from "@/components/PricingSection";
import CompanyMarqueeSection from "@/components/CompanyMarqueeSection";
import FounderSection, {
  FounderNoteSection,
} from "@/components/FounderSection";
import MoodShiftBackground from "@/components/MoodShiftBackground";
import HeroReportCard from "@/components/HeroReportCard";
import Logo from "@/components/Logo";
import { ArrowRight, CheckCircle2, Menu, X } from "lucide-react";
import { useState, useCallback } from "react";
import { motion, useScroll, useSpring, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import AuthButton from "@/components/AuthButton";

export const HOME_NAV_ITEMS = [
  { label: "서비스 소개", type: "section", target: "service-intro" },
  { label: "자소서 분석", type: "route", target: "/analyze" },
  { label: "이용권 구매", type: "route", target: "/entitlements" },
  { label: "내 지원서", type: "route", target: "/my" },
] as const;

// 소셜 프루프(후기·지표)는 실제 사용자 후기를 확보할 때까지 숨긴다.
// 실후기로 교체한 뒤 true로 되돌리면 기존 위치에 그대로 복귀한다.
// 로고 마퀴는 CompanyMarqueeSection이 "분석 지원 기업" 프레임으로 상시
// 노출 중이므로, 복원 시 SocialProofSection 쪽 마퀴와 중복을 정리할 것.
const SHOW_SOCIAL_PROOF = false;

/**
 * PreView – Premium Dark SaaS Landing Page
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

/* ─────────────────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────────────────── */

export default function Home() {
  const [, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = useCallback(
    (target: string, type: string) => {
      setIsMobileMenuOpen(false);

      if (type === "section") {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      navigate(target);
    },
    [navigate]
  );

  // Scroll progress
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
  });
  /* ─── Render ─── */
  return (
    <div
      className="min-h-screen bg-[#050505] text-white"
      style={{ overflowX: "clip" }}
    >
      {/* ── Mood Shift Background (마우스 반응형) ── */}
      <MoodShiftBackground />

      {/* ── Scroll Progress ── */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-px z-[60] origin-left"
        style={{
          scaleX: smoothProgress,
          background: "linear-gradient(90deg, #3B82F6, #8B5CF6)",
        }}
      />

      {/* ══════════════════════════════════════════════════
          GNB
          ══════════════════════════════════════════════════ */}
      <motion.nav
        className="sticky top-0 z-50 bg-[#050505]/10 backdrop-blur-2xl border-b border-white/[0.045]"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-6 lg:px-10">
          <div
            className="flex items-center cursor-pointer"
            onClick={() => navigate("/")}
          >
            <Logo className="h-5 w-auto" />
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
              onClick={() => setIsMobileMenuOpen(open => !open)}
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
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 pt-24 md:pt-28 overflow-hidden">
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
            서류 탈락의 <br className="sm:hidden" />
            진짜 이유,
            <br />
            현직자는 <br className="sm:hidden" />
            <span className="bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(125,145,255,0.35)]">
              10초면
            </span>{" "}
            압니다.
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
            현직자의 시선으로 &lsquo;같이 일하고 싶은 사람&rsquo;으로 기억될 수
            있도록 피드백합니다.
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
              <span className="relative z-10">내 자소서 분석하기</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
            <p className="mt-3.5 text-[12.5px] text-zinc-500">
              첫 분석 무료 <span className="text-zinc-700">·</span> 리포트는 1분
              안에
            </p>
          </motion.div>

          <HeroReportCard />
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
            아직도 AI로 만든 자소서 <br className="hidden md:inline" />
            그대로 복붙하세요?
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
            매끈한 문장은 이제 누구나 씁니다.
            <br />
            서류를 읽는 실무자 눈에는 다 비슷해 보일 뿐이에요.
            <br />
            <BrandName />는 문장을 다듬는 대신, 지원한 회사의 채용 기준으로
            <br />
            당신의 자소서가 어떻게 읽히는지 알려드립니다.
          </motion.p>
        </div>
      </section>

      {/* ── Before & After ── */}
      <section className="py-28 md:py-36 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              합격하는 자소서는 구조부터 다릅니다.
            </h2>
            <p className="text-gray-500 font-light text-[15px] max-w-xl mx-auto leading-[1.8]">
              추상적인 표현이 데이터와 판단 과정으로 바뀌면 어떻게 읽히는지
              보여주는 예시입니다. 리포트는 이 방향을 문장 단위로 짚어줍니다.
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
                  &ldquo;프로젝트를 진행하면서 많은 것을 배웠고, 팀원들과
                  협력하여 좋은 결과를 얻었습니다. 이러한 경험이 회사에서 도움이
                  될 것 같습니다.&rdquo;
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
                  &ldquo;신규 사용자의 온보딩 이탈률이 35%까지 높아진 원인을
                  찾기 위해 클릭 로그 3,000건을 세그먼트별로 분석했습니다. 핵심
                  기능을 처음 접하는 시점에서 이탈이 집중된다는 점을 확인했고,
                  개발팀과 함께 첫 화면 안내 문구와 추천 흐름을 A/B
                  테스트했습니다. 그 결과 이탈률을 18%로 낮추고, 일간 활성
                  사용자 수를 20% 늘렸습니다.&rdquo;
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Company Marquee ── */}
      <CompanyMarqueeSection />

      {/* ══════════════════════════════════════════════════
          STEP 3: Report Showcase — Sticky Scroll Deep-Dive
          (구 "이렇게 읽습니다" 방법론은 장면별 lens 문구로 병합)
          ══════════════════════════════════════════════════ */}
      <ReportShowcase />

      {/* ── Pricing Section — 리포트를 본 직후 가격 대비가 가장 강하게 남는다 ── */}
      <PricingSection />

      {SHOW_SOCIAL_PROOF && <SocialProofSection />}

      {/* ── Founder Note ── */}
      <FounderNoteSection />

      {/* ── Process Section ── */}
      <ProcessSection />

      {/* ── Founder + CTA + Footer ── */}
      <FounderSection />
    </div>
  );
}
