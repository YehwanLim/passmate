import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, ChevronDown, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * AuthButton
 *
 * Header에서 사용하는 인증 상태 버튼 컴포넌트.
 * - 비로그인: "로그인" 버튼 → /login 이동
 * - 로그인: 프로필 이미지 + 이름 + 드롭다운 (로그아웃)
 */
export default function AuthButton() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // 세션 로딩 중에는 빈 자리 유지 (레이아웃 흔들림 방지)
  if (isLoading) {
    return <div className="w-16 h-8" />;
  }

  // ── 비로그인 상태 ──
  if (!isAuthenticated) {
    return (
      <button
        id="header-login-btn"
        onClick={() => navigate("/login")}
        className="header-action-link text-[13px] font-medium h-8 px-3 rounded-md"
      >
        로그인
      </button>
    );
  }

  // ── 로그인 상태 ──
  const displayName = user?.name ?? user?.email?.split("@")[0] ?? "사용자";
  const avatarUrl = user?.profile_image;

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
        <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-blue-500/30 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-blue-300" />
            </div>
          )}
        </div>
        {/* 이름 */}
        <span className="text-[13px] font-medium hidden sm:block max-w-[100px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
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
            className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-white/[0.08] bg-[#111111] backdrop-blur-xl overflow-hidden z-50"
            style={{
              boxShadow:
                "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* 사용자 정보 */}
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-[13px] font-medium text-white truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {user?.email}
              </p>
            </div>

            {/* 로그아웃 */}
            <div className="p-1.5">
              <button
                id="header-logout-btn"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-300 hover:text-white hover:bg-white/10 transition-colors duration-150 disabled:opacity-50"
              >
                {isSigningOut ? (
                  <div className="w-4 h-4 border border-gray-500 border-t-gray-300 rounded-full animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 text-gray-500" />
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
