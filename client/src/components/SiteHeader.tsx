import { useCallback, useEffect, useRef, useState, type FocusEvent, type SyntheticEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Menu, X } from "lucide-react";
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
 * 하위 항목(siteNav children)이 있는 칸은 데스크톱에선 마우스를 올리면 펼치고, 폰 메뉴에선 들여 쓴 채 늘 보인다.
 * 밝은 헤더의 데스크톱 메뉴는 회색 칸 하나가 마우스를 따라 미끄러지고, 마우스가 떠나면 현재 페이지로 돌아간다(없으면 사라진다).
 * 칸을 처음 재기 전(프리렌더·하이드레이션 전)에는 링크마다 회색 바탕을 까는 기존 CSS 가 그대로 동작한다.
 */
// 마우스를 올리면 글자가 굵어진다. 굵은 글자 폭을 미리 잡아 둬서(landing.css .nav-label::after) 옆 메뉴가 밀리지 않는다.
function NavLabel({ label }: { label: string }) {
  return (
    <span className="nav-label" data-label={label}>
      {label}
    </span>
  );
}

type NavPill = { x: number; width: number; visible: boolean; instant: boolean };

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
  const navRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<NavPill | null>(null);

  const renderItem = (item: SiteNavItem, className: string, navSlot = false) => {
    const current = isCurrentNavItem(item, location);
    return (
      <Link
        key={item.label}
        href={item.target}
        className={className}
        aria-current={current ? "page" : undefined}
        data-nav-slot={navSlot || undefined}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        {navSlot ? <NavLabel label={item.label} /> : item.label}
      </Link>
    );
  };

  const isLight = variant === "light" || variant === "floating";
  const isFloating = variant === "floating";

  // 회색 칸을 link 위치로 옮긴다. link 가 없으면 감춘다. 감춰져 있다가 나타날 땐 미끄러지지 않고 그 자리에서 떠오른다.
  const movePill = useCallback((link: HTMLElement | null) => {
    const nav = navRef.current;
    if (!nav) return;
    if (!link) {
      setPill(prev => (prev ? { ...prev, visible: false } : { x: 0, width: 0, visible: false, instant: true }));
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const rect = link.getBoundingClientRect();
    setPill(prev => ({
      x: rect.left - navRect.left,
      width: rect.width,
      visible: true,
      instant: !prev?.visible,
    }));
  }, []);

  const restPill = useCallback(() => {
    movePill(navRef.current?.querySelector<HTMLElement>('.landing-nav-link[aria-current="page"]') ?? null);
  }, [movePill]);

  useEffect(() => {
    if (!isLight) return;
    restPill();
    window.addEventListener("resize", restPill);
    return () => window.removeEventListener("resize", restPill);
  }, [isLight, location, restPill]);

  // 하위 메뉴 안으로 들어가도 부모 칸에 머물도록, 링크가 아니라 칸(data-nav-slot) 단위로 찾는다.
  const handleNavEnter = (event: SyntheticEvent) => {
    const slot = (event.target as HTMLElement).closest<HTMLElement>("[data-nav-slot]");
    if (!slot) return;
    movePill(slot.matches(".landing-nav-link") ? slot : slot.querySelector<HTMLElement>(".landing-nav-link"));
  };

  const handleNavBlur = (event: FocusEvent) => {
    if (!navRef.current?.contains(event.relatedTarget as Node | null)) restPill();
  };

  // 하위 항목이 있는 칸: 부모 링크는 그대로 누를 수 있고, 마우스를 올리거나 키보드로 들어가면(focus-within) 아래로 펼친다.
  // JS 상태 없이 CSS 로만 열어 프리렌더 HTML 에서도 같은 모양이고, 하위 링크도 크롤러가 따라간다.
  const renderDesktopItem = (item: SiteNavItem) => {
    if (!item.children) return renderItem(item, "landing-nav-link", true);
    const current = isCurrentNavItem(item, location);
    return (
      <div key={item.label} className="group relative" data-nav-slot>
        <Link href={item.target} className="landing-nav-link gap-1" aria-current={current ? "page" : undefined} aria-haspopup="true">
          <NavLabel label={item.label} />
          <ChevronDown className="size-3 opacity-60 transition-transform group-hover:rotate-180" aria-hidden="true" />
        </Link>
        <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
          <div
            className={cn(
              "w-[300px] rounded-[14px] border p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.08)]",
              isLight ? "border-line bg-surface" : "border-white/10 bg-[#111]"
            )}
          >
            {item.children.map(child => (
              <Link
                key={child.target}
                href={child.target}
                className={cn(
                  "block rounded-[10px] px-3 py-2.5 transition-colors",
                  isLight ? "hover:bg-fill-soft focus-visible:bg-fill-soft" : "hover:bg-white/5 focus-visible:bg-white/5"
                )}
              >
                <span className={cn("block text-[14px] font-semibold", isLight ? "text-ink" : "text-white")}>{child.label}</span>
                {child.description && (
                  <span className={cn("mt-0.5 block text-[13px]", isLight ? "text-ink-4" : "text-white/60")}>{child.description}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  };

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

        <div
          ref={navRef}
          className="relative hidden md:flex items-center gap-4 lg:gap-7"
          data-nav-pill-ready={isLight && pill ? "" : undefined}
          onPointerOver={isLight ? handleNavEnter : undefined}
          onPointerLeave={isLight ? restPill : undefined}
          onFocus={isLight ? handleNavEnter : undefined}
          onBlur={isLight ? handleNavBlur : undefined}
        >
          {isLight && pill && (
            <span
              aria-hidden="true"
              className="nav-hover-pill"
              data-instant={pill.instant ? "" : undefined}
              style={{ width: pill.width, transform: `translate(${pill.x}px, -50%)`, opacity: pill.visible ? 1 : 0 }}
            />
          )}
          {SITE_NAV_ITEMS.map(renderDesktopItem)}
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
            {/* 폰은 마우스를 올릴 수 없어 하위 항목을 늘 펼쳐 둔다 */}
            {SITE_NAV_ITEMS.map(item => [
              renderItem(item, "mobile-nav-link"),
              ...(item.children ?? []).map(child => (
                <Link
                  key={`${item.label}-${child.target}`}
                  href={child.target}
                  className="mobile-nav-link mobile-nav-sublink"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {child.label}
                </Link>
              )),
            ])}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
