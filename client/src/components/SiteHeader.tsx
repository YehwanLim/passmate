import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";

import AuthButton from "@/components/AuthButton";
import Logo from "@/components/Logo";
import { isCurrentNavItem, SITE_NAV_ITEMS, type SiteNavItem } from "@/lib/siteNav";
import { cn } from "@/lib/utils";

/**
 * 전역 상단 메뉴. 랜딩·분석 폼·가이드·이용권·내 지원서·약관이 같은 헤더를 쓴다(리포트 화면만 자체 내비).
 * 랜딩 GNB(56px, 1280px 컨테이너, .landing-nav-link)를 그대로 옮긴 것이라 스타일은 styles/landing.css 에 있다.
 *
 * - transparent: 랜딩·문서 페이지(#050505). 배경이 거의 비치고 블러만 준다.
 * - solid: 앱 화면(#0A0A0A). 스크롤되는 폼 위에서 글자가 겹치지 않게 불투명하게.
 * - light: 10월 새 디자인으로 바꾼 밝은 화면(마이페이지·작업실). 흰 헤더 + 검은 워드마크. 글자색은 landing.css 의 .site-header-light.
 * - floating: 랜딩 전용. light 와 같은 글자색에, 회색 무대 위에 떠 있는 둥근 흰 바(스픽식) + "무료로 시작하기" 버튼.
 * 항목은 실제 <a> 라 지연 하이드레이션 전에도 동작하고 크롤러가 따라간다. 현재 페이지는 aria-current 로 표시한다.
 * 768px 미만에서는 햄버거 메뉴로 바꾼다(landing.css 의 미디어쿼리도 같은 기준). 메뉴가 다섯 개라 640px 에선 넘친다.
 */
type SiteHeaderProps = {
  variant?: "transparent" | "solid" | "light" | "floating";
};

const SURFACE_CLASS: Record<NonNullable<SiteHeaderProps["variant"]>, string> = {
  transparent: "bg-[#050505]/10 backdrop-blur-2xl border-white/[0.045]",
  solid: "bg-[#0A0A0A]/80 backdrop-blur-lg border-white/5",
  light: "site-header-light bg-white/90 backdrop-blur-lg border-line-soft",
  floating: "site-header-light border-transparent px-3 pt-3 sm:px-6 lg:px-10",
};

export default function SiteHeader({ variant = "solid" }: SiteHeaderProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderItem = (item: SiteNavItem, className: string) => {
    const current = isCurrentNavItem(item, location);
    return (
      <Link
        key={item.label}
        href={item.target}
        className={className}
        aria-current={current ? "page" : undefined}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        {item.label}
      </Link>
    );
  };

  const isLight = variant === "light" || variant === "floating";
  const isFloating = variant === "floating";

  return (
    <nav className={cn("sticky top-0 z-50 border-b", SURFACE_CLASS[variant])}>
      <div
        className={cn(
          "max-w-7xl mx-auto flex items-center justify-between",
          isFloating
            ? "h-14 rounded-[16px] bg-white px-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] sm:h-16 sm:rounded-[20px] sm:px-7"
            : "h-14 px-6 lg:px-10"
        )}
      >
        <Link href="/" className="flex items-center" aria-label="Pre:View 홈">
          <Logo className="h-5 w-auto" variant={isLight ? "default" : "inverse"} />
        </Link>

        <div className="hidden md:flex items-center gap-4 lg:gap-7">
          {SITE_NAV_ITEMS.map(item => renderItem(item, "landing-nav-link"))}
        </div>

        <div className="flex items-center gap-2">
          <AuthButton tone={isLight ? "light" : "dark"} />
          {isFloating && (
            <Link
              href="/analyze"
              data-funnel-cta="header"
              className="hidden h-10 items-center whitespace-nowrap rounded-[10px] bg-brand px-4 text-[14px] font-bold text-white transition-colors hover:bg-brand-hover lg:inline-flex"
            >
              무료로 시작하기
            </Link>
          )}
          <button
            type="button"
            className="mobile-nav-toggle md:hidden"
            aria-label="모바일 메뉴 열기"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-site-nav"
            onClick={() => setIsMobileMenuOpen(open => !open)}
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            id="mobile-site-nav"
            className={cn("mobile-nav-panel md:hidden", isFloating && "mx-0 mt-2")}
            initial={{ opacity: 0, y: -8, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            {SITE_NAV_ITEMS.map(item => renderItem(item, "mobile-nav-link"))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
