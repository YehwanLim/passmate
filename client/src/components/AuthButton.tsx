import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, ChevronDown, User, FileText, Ticket } from "lucide-react";
import { readStoredProfile, useAuth } from "@/contexts/AuthContext";
import { useCreditSummary } from "@/hooks/useCreditSummary";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

/**
 * AuthButton
 *
 * Header에서 사용하는 인증 상태 버튼 컴포넌트.
 * - 비로그인: "로그인" 버튼 → /login 이동. 랜딩(/)에서 누르면 로그인 뒤 분석 폼(/analyze)으로 보낸다 —
 *   랜딩으로 되돌려 보내면 가입하고도 다음 할 일을 못 찾고 나갔다(10-01 실사례).
 * - 로그인: 프로필 이미지 + 이름 + 드롭다운 (남은 이용권 · 마이페이지 · 내 이용권 · 로그아웃)
 */
export function loginPathFrom(currentPath: string): string {
  return currentPath === "/" ? "/login?redirect=%2Fanalyze" : "/login";
}

/** tone="light": 밝은 화면(마이페이지·작업실)의 흰 헤더용. 드롭다운도 흰 판으로 바꾼다. */
export default function AuthButton({ tone = "dark" }: { tone?: "dark" | "light" } = {}) {
  const light = tone === "light";
  const menuItem = light
    ? "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-ink-2 hover:text-ink hover:bg-fill transition-colors duration-150"
    : "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-300 hover:text-white hover:bg-white/10 transition-colors duration-150";
  const menuIcon = light ? "w-4 h-4 text-ink-4" : "w-4 h-4 text-gray-500";
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // 세션 확인(지연 청크 + 만료 토큰 갱신)이 1~2초 걸려도 프로필이 바로 보이도록 저장된 세션을 먼저 읽는다.
  // 프리렌더 HTML 과 하이드레이션 첫 패스는 빈 자리여야 하므로 useState 초기값이 아니라 첫 페인트 전 레이아웃 이펙트에서 읽는다.
  const [storedUser, setStoredUser] = useState<ReturnType<typeof readStoredProfile>>(null);
  useLayoutEffect(() => {
    setStoredUser(readStoredProfile());
  }, []);
  // 남은 이용권은 메뉴를 열 때만 읽는다(헤더는 모든 화면에 있으니 매번 부르지 않는다).
  const { summary: credits, failed: creditsFailed } = useCreditSummary(dropdownOpen && isAuthenticated);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setDropdownOpen(false);
    try {
      await signOut();
      navigate("/");
    } catch {
      // 로그아웃 실패해도 UI 복원
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleNavigate = (path: "/my" | "/my/entitlements") => {
    setDropdownOpen(false);
    navigate(path);
  };

  // 세션 로딩 중에는 저장된 프로필을 먼저 보여 주고, 없으면 빈 자리 유지 (레이아웃 흔들림 방지)
  const shownUser = isLoading ? storedUser : user;
  if (isLoading && !shownUser) {
    return <div className="w-16 h-8" />;
  }

  // ── 비로그인 상태 ──
  if (!isLoading && !isAuthenticated) {
    return (
      <button
        id="header-login-btn"
        onClick={() => navigate(loginPathFrom(location))}
        className="header-action-link text-[13px] font-medium h-8 px-3 rounded-md"
      >
        로그인
      </button>
    );
  }

  // ── 로그인 상태 ──
  const displayName = shownUser?.name ?? shownUser?.email?.split("@")[0] ?? "사용자";
  const avatarUrl = shownUser?.profile_image;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 프로필 버튼 */}
      <button
        id="header-profile-btn"
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="header-action-link flex items-center gap-2 h-8 px-2 pr-2.5 rounded-md"
        aria-label="사용자 메뉴"
        aria-expanded={dropdownOpen}
      >
        {/* 아바타 */}
        <div className={`w-6 h-6 rounded-full overflow-hidden border flex-shrink-0 ${light ? "border-line" : "border-white/20"}`}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${light ? "bg-brand-soft" : "bg-blue-500/30"}`}>
              <User className={`w-3.5 h-3.5 ${light ? "text-brand-ink" : "text-blue-300"}`} />
            </div>
          )}
        </div>
        {/* 이름 */}
        <span className="text-[13px] font-medium hidden sm:block max-w-[100px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 ${light ? "text-ink-4" : "text-gray-500"} transition-transform duration-200 ${
            dropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* 드롭다운 메뉴 */}
      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 top-full mt-1.5 w-52 rounded-xl border overflow-hidden z-50 ${light ? "border-line bg-surface" : "border-white/[0.08] bg-[#111111] backdrop-blur-xl"}`}
            style={{
              boxShadow: light
                ? "0 12px 32px rgba(18,32,90,0.12)"
                : "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* 사용자 정보 */}
            <div className={`px-4 py-3 border-b ${light ? "border-line-soft" : "border-white/[0.06]"}`}>
              <p className={`text-[13px] font-medium truncate ${light ? "text-ink" : "text-white"}`}>
                {displayName}
              </p>
              <p className={`text-[11px] truncate mt-0.5 ${light ? "text-ink-4" : "text-gray-500"}`}>
                {shownUser?.email}
              </p>
            </div>

            {/* 남은 이용권 — 누르면 내 이용권 화면 */}
            <button
              type="button"
              id="header-credits-btn"
              onClick={() => handleNavigate("/my/entitlements")}
              className={`block w-full px-4 py-2.5 text-left border-b transition-colors ${light ? "border-line-soft hover:bg-fill-soft" : "border-white/[0.06] hover:bg-white/5"}`}
            >
              <span className={`block text-[11px] font-semibold ${light ? "text-ink-4" : "text-gray-500"}`}>{WORKSPACE_COPY.credits.heading}</span>
              {creditsFailed ? (
                <span className={`mt-0.5 block text-[12px] ${light ? "text-ink-4" : "text-gray-400"}`}>{WORKSPACE_COPY.credits.error}</span>
              ) : credits ? (
                <span className={`mt-0.5 block text-[12.5px] font-bold ${light ? "text-ink" : "text-white"}`}>
                  {WORKSPACE_COPY.credits.compactLine(credits.remaining, credits.companyAnalysisEnabled ? credits.companyRemaining : null)}
                </span>
              ) : (
                <span className={`mt-1 block h-3 w-28 animate-pulse rounded ${light ? "bg-fill" : "bg-white/10"}`} aria-hidden="true" />
              )}
            </button>

            <div className={`p-1.5 border-b ${light ? "border-line-soft" : "border-white/[0.06]"}`}>
              <button
                id="header-my-projects-btn"
                onClick={() => handleNavigate("/my")}
                className={menuItem}
              >
                <FileText className={menuIcon} />
                마이페이지
              </button>
              <button
                id="header-entitlements-btn"
                onClick={() => handleNavigate("/my/entitlements")}
                className={menuItem}
              >
                <Ticket className={menuIcon} />
                내 이용권
              </button>
            </div>

            {/* 로그아웃 — 회원 탈퇴는 내 이용권 화면 하단에서만 제공한다 */}
            <div className="p-1.5">
              <button
                id="header-logout-btn"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className={`${menuItem} disabled:opacity-50`}
              >
                {isSigningOut ? (
                  <div className={`w-4 h-4 border rounded-full animate-spin ${light ? "border-line border-t-ink-3" : "border-gray-500 border-t-gray-300"}`} />
                ) : (
                  <LogOut className={menuIcon} />
                )}
                {isSigningOut ? "로그아웃 중..." : "로그아웃"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
