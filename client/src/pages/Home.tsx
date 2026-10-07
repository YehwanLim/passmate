import { Button } from "@/components/ui/button";
import ReportShowcase from "@/components/ReportShowcase";
import SocialProofSection from "@/components/SocialProofSection";
import ProcessSection from "@/components/ProcessSection";
import GuideTeaserSection from "@/components/GuideTeaserSection";
import PricingSection from "@/components/PricingSection";
import ChatGptComparisonSection from "@/components/ChatGptComparisonSection";
import CompanyReportIntroSection from "@/components/CompanyReportIntroSection";
import CompanyMarqueeSection from "@/components/CompanyMarqueeSection";
import FounderSection, {
  FounderNoteSection,
} from "@/components/FounderSection";
import HeroWorkflowDemo from "@/components/HeroWorkflowDemo";
import SiteHeader from "@/components/SiteHeader";
import { Check, X } from "lucide-react";
import { useEffect, type CSSProperties } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { Link } from "wouter";
import { RESUME_REPORT_SAMPLE_PATH } from "@/constants/resumeReportSampleMeta";
import { sendFunnelEvent } from "@/lib/siteVisits";

/**
 * 랜딩에서 눌린 요소가 퍼널 버튼이면 그 위치 이름을 돌려준다. 분석 폼·예시 리포트·기업 분석으로 가는 것만 센다.
 * 위치는 `data-funnel-cta`(히어로·쇼케이스·하단)가 있으면 그것, 없으면 링크 주소로 정한다.
 */
export function landingCtaWhere(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>("[data-funnel-cta], a[href]");
  if (!el) return null;
  if (el.dataset.funnelCta) return el.dataset.funnelCta;
  const href = el.getAttribute("href") ?? "";
  if (href.includes("sample=1")) return "sample";
  if (href.startsWith("/company-analysis")) return "company";
  if (href.startsWith("/analyze")) return "analyze";
  return null;
}

function trackLandingCta(event: React.MouseEvent) {
  const where = landingCtaWhere(event.target);
  if (where) void sendFunnelEvent("landing_cta_click", where);
}

// 랜딩 → 폼 이동이 빈 화면 없이 바로 그려지도록 폼 청크를 미리 받는다. 첫 화면 그리기와 겹치지 않게 유휴 시간에.
function prefetchAnalyze() {
  void import("./Analyze").catch(() => {
    // 미리 받기 실패는 무시한다 — 실제 이동 때 App 의 lazy 가 다시 받는다.
  });
}

// 히어로 h1은 랜딩의 LCP 요소다. opacity 0 → 1 등장은 브라우저가 애니메이션이 끝날 때까지
// LCP를 미루고(모바일 Lighthouse 7.7s), blur 필터는 큰 글자를 매 프레임 다시 그린다.
// 그래서 제목만 이동(transform)으로 등장시키고 페이드·블러는 아래 요소들에만 남긴다.
export const HERO_TITLE_MOTION = {
  initial: { y: 24 },
  animate: { y: 0 },
  transition: { duration: 0.9, ease: [0.21, 0.47, 0.32, 0.98] },
} as const;

// 소셜 프루프(후기·지표)는 실제 사용자 후기를 확보할 때까지 숨긴다.
// 실후기로 교체한 뒤 true로 되돌리면 기존 위치에 그대로 복귀한다.
// 로고 마퀴는 CompanyMarqueeSection이 "분석 지원 기업" 프레임으로 상시
// 노출 중이므로, 복원 시 SocialProofSection 쪽 마퀴와 중복을 정리할 것.
const SHOW_SOCIAL_PROOF = false;

/**
 * Pre:View 랜딩 — 10월 밝은 서비스형 디자인(디자인 캔버스 "랜딩 · 밝은 서비스형" + "움직이는 첫 화면").
 * 회색 무대(#f2f4f6 / #f9fafb 번갈아) 위 흰 둥근 카드, 강조색은 파랑(#0064ff) 하나, 어두운 띠는 ChatGPT 비교 하나.
 */

/* ─────────────────────────────────────────────────────────
   Helper Components
   ───────────────────────────────────────────────────────── */

/** 섹션 래퍼. 예전엔 스크롤 등장(opacity 0→1)이었지만, 그 시작 상태가 프리렌더 HTML 에 구워져
 *  폰에서 JS 가 올 때까지 섹션이 통째로 투명했다. 첫 진입엔 내용이 먼저 보이는 쪽을 택했다. */
function ScrollReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────────────────── */

export default function Home() {
  // Scroll progress
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
  });
  // 랜딩 문서 배경을 히어로 바탕색으로. iOS 오버스크롤·미도색 타일에 비치는 색을 맞춘다(landing.css 참고).
  // 프리렌더 HTML 은 scripts/prerender-landing.mjs 가 같은 클래스를 미리 붙여 두므로 첫 진입은 하이드레이션 전에도 같다.
  useEffect(() => {
    document.documentElement.classList.add("landing-canvas");
    return () => {
      document.documentElement.classList.remove("landing-canvas");
    };
  }, []);

  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetchAnalyze, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(prefetchAnalyze, 2500);
    return () => window.clearTimeout(id);
  }, []);

  /* ─── Render ─── */
  return (
    <div
      className="min-h-screen bg-fill-soft text-ink"
      style={{ overflowX: "clip" }}
      onClickCapture={trackLandingCta}
    >
      {/* ── Scroll Progress ── */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-0.5 z-[60] origin-left bg-brand"
        style={{ scaleX: smoothProgress }}
      />

      {/* ══════════════════════════════════════════════════
          GNB + HERO — 회색 무대 위 떠 있는 흰 바, 왼쪽 문구 + 오른쪽 움직이는 작업실 시연
          ══════════════════════════════════════════════════ */}
      {/* 헤더는 히어로 래퍼 밖에 둬야 sticky 가 페이지 끝까지 따라온다(sticky 는 부모 안에서만 붙는다). */}
      <SiteHeader variant="floating" />

      <div className="bg-fill-soft">
        {/* 시연 칸은 폭 600px 안팎에서 짜여 있다. 좌우로 나누면 1280px 미만에선 시연이 400px 대로 좁아져 글자가 겹치므로,
            xl 부터만 좌우로 두고 그 아래는 문구 → 시연 순으로 쌓는다. */}
        <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-6 pb-20 pt-14 lg:px-10 lg:pb-[120px] lg:pt-16 xl:grid-cols-[520px_minmax(0,1fr)] xl:gap-14">
          <div className="flex flex-col items-start gap-6">
            {/* H1 */}
            <motion.h1
              className="text-[36px] font-semibold leading-[1.3] tracking-[-0.03em] text-navy sm:text-[44px] xl:text-[50px]"
              {...HERO_TITLE_MOTION}
            >
              흩어진 경험을,
              <br />
              <span className="text-brand">합격하는 자소서</span>로
            </motion.h1>

            {/* Sub copy */}
            <div
              className="landing-rise flex flex-col gap-3.5"
              style={{ "--rise-delay": "0.3s" } as CSSProperties}
            >
              <p className="text-[16px] leading-[1.75] text-ink-3 md:text-[18px]">
                내 경험을 모아 두면 공고에 맞춰 초안을 잡아 드리고,
                {/* JSX 는 요소와 붙은 줄바꿈 공백을 지운다. br 이 숨겨지는 모바일에서 붙지 않도록 공백을 명시한다. */}{" "}
                <br className="hidden md:inline" />
                다 쓰면 채용 담당자 눈으로 고칠 곳을 짚어 드려요.
              </p>
              <p className="text-[13px] leading-[1.6] text-ink-4">
                대기업 현직 PM이 200번 넘는 커피챗에서 찾은 기준으로 만들었어요.
              </p>
            </div>

            {/* CTA */}
            <div
              className="landing-rise mt-1.5 flex flex-wrap gap-2.5"
              style={{ "--rise-delay": "0.45s", "--rise-y": "16px", "--rise-duration": "0.7s" } as CSSProperties}
            >
              {/* 일반 링크: 번들 평가가 첫 프레임 뒤로 미뤄져 있어(public/landing-boot.js) 그 사이 탭해도 이동해야 한다.
                  하이드레이션 뒤에는 wouter 가 클라이언트 라우팅으로 가로챈다. */}
              <Link href="/analyze" className="landing-primary-cta" data-funnel-cta="hero">
                내 자소서 무료로 분석하기
              </Link>
              {/* 로그인 없이 결과물부터 보고 싶은 방문자용 예시 리포트(ReportResult 의 ?sample=1, 가상의 지원자). */}
              <Link href={RESUME_REPORT_SAMPLE_PATH} className="landing-secondary-cta" data-funnel-cta="sample">
                예시 리포트 보기
              </Link>
            </div>
          </div>

          <HeroWorkflowDemo className="mx-auto w-full max-w-[640px] xl:max-w-none" />
        </section>
      </div>

      {/* ── ChatGPT 와의 차이 — 히어로 다음. 방문자가 가장 먼저 떠올리는 대안이 ChatGPT 라, 왜 또 필요한지부터 답한다 ── */}
      <ChatGptComparisonSection />

      {/* ── Before & After ── */}
      <section className="bg-fill py-24 md:py-[120px]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <ScrollReveal className="text-center mb-12 md:mb-14">
            <h2 className="mb-4 text-[30px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink md:text-[46px]">
              합격하는 자소서는 구조부터 다릅니다.
            </h2>
            <p className="mx-auto max-w-xl text-[16px] leading-[1.7] text-ink-3 md:text-[17px]">
              추상적인 표현이 데이터와 판단 과정으로 바뀌면 어떻게 읽히는지
              보여주는 예시입니다. 리포트는 이 방향을 문장 단위로 짚어줍니다.
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Before */}
            <ScrollReveal>
              <div className="flex h-full flex-col gap-5 rounded-[28px] bg-surface p-8 md:p-11">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#FDECEE]">
                    <X className="h-[15px] w-[15px] text-[#C9252F]" strokeWidth={2.6} />
                  </div>
                  <span className="text-[15px] font-bold text-[#C9252F]">
                    개선 전
                  </span>
                </div>
                <p className="text-[16px] leading-[1.8] text-ink-3 md:text-[17px]">
                  &ldquo;프로젝트를 진행하면서 많은 것을 배웠고, 팀원들과
                  협력하여 좋은 결과를 얻었습니다. 이러한 경험이 회사에서 도움이
                  될 것 같습니다.&rdquo;
                </p>
              </div>
            </ScrollReveal>

            {/* After */}
            <ScrollReveal>
              <div className="flex h-full flex-col gap-5 rounded-[28px] bg-surface p-8 md:p-11">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ok-soft">
                    <Check className="h-[15px] w-[15px] text-ok" strokeWidth={2.6} />
                  </div>
                  <span className="text-[15px] font-bold text-ok">
                    개선 후
                  </span>
                </div>
                <p className="text-[16px] leading-[1.8] text-ink md:text-[17px]">
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

      {/* ── 기업 분석 리포트 소개 — 자소서 쇼케이스 다음. 두 상품을 다 본 뒤 신뢰 → 가격 순으로 내려간다 ── */}
      <CompanyReportIntroSection />

      {SHOW_SOCIAL_PROOF && <SocialProofSection />}

      {/* ── Founder Note ── */}
      <FounderNoteSection />

      {/* ── Process Section ── */}
      <ProcessSection />

      {/* ── Pricing Section — 누가 만들었고 어떻게 되는지 본 뒤에 가격. 첫 방문자의 81%가 첫 화면에서 나가던 시점(09-25)에
          가격이 파운더·프로세스보다 앞에 있어 "유료구나"를 신뢰보다 먼저 만났다 ── */}
      <PricingSection />

      {/* 취업 가이드 최신 3편 — 검색으로 들어온 글 독자와 랜딩 방문자를 잇는 진입점 */}
      <GuideTeaserSection />

      {/* ── Founder + CTA + Footer ── */}
      <FounderSection />
    </div>
  );
}
