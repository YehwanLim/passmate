import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import Logo from "@/components/Logo";
import MoodShiftBackground from "@/components/MoodShiftBackground";
import { Shield, ArrowLeft } from "lucide-react";

// ============================================================
// 로그인 페이지
// ============================================================
export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const redirectPath = getSafeRedirectPath();

  // 이미 로그인된 사용자는 메인으로 리다이렉트
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirectPath);
    }
  }, [authLoading, isAuthenticated, navigate, redirectPath]);

  // 세션 초기화 대기
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#050505] text-white flex flex-col"
      style={{ overflowX: "clip" }}
    >
      {/* 배경 */}
      <MoodShiftBackground />

      {/* 상단 로고 영역 */}
      <motion.header
        className="relative z-10 flex items-center justify-center pt-10 pb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white sm:left-6"
          aria-label="홈으로 돌아가기"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="cursor-pointer" onClick={() => navigate("/")}>
          <Logo className="h-6 w-auto" />
        </div>
      </motion.header>

      {/* 메인 카드 */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 32, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          {/* 카드 */}
          <div
            className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl px-8 py-10"
            style={{
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.05), 0 24px 64px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* 타이틀 */}
            <h1 className="text-2xl font-bold text-center tracking-tight mb-2">
              시작하기
            </h1>
            <p className="text-[14px] text-gray-400 text-center mb-8 leading-relaxed">
              Google 계정으로 간편하게 로그인하고
              <br />
              로그인만 하면 무료로 자소서 분석을 시작할 수 있어요.
            </p>

            <GoogleSignInButton redirectPath={redirectPath} />

            {/* 구분선 + 보안 안내 */}
            <div className="mt-6 pt-6 border-t border-white/[0.06]">
              <div className="flex items-center justify-center gap-1.5 text-[12px] text-gray-500">
                <Shield className="w-3.5 h-3.5 text-gray-600" />
                <span>Google 계정 비밀번호는 Pre:View에 저장되지 않습니다.</span>
              </div>
            </div>
          </div>

          {/* 하단 안내 */}
          <p className="text-center text-[12px] text-gray-500 mt-5 leading-relaxed">
            로그인 시{" "}
            <Link
              href="/terms"
              className="text-gray-400 underline underline-offset-2 transition-colors hover:text-white"
            >
              이용약관
            </Link>{" "}
            및{" "}
            <Link
              href="/privacy"
              className="text-gray-400 underline underline-offset-2 transition-colors hover:text-white"
            >
              개인정보 처리방침
            </Link>
            에 동의하는 것으로 간주합니다.
          </p>
        </motion.div>
      </main>
    </div>
  );
}

function getSafeRedirectPath() {
  const redirect = new URLSearchParams(window.location.search).get("redirect");
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/";
  }

  return redirect;
}
