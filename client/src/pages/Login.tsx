import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import Logo from "@/components/Logo";
import MoodShiftBackground from "@/components/MoodShiftBackground";
import { ArrowLeft, Check, Lock, Shield } from "lucide-react";

// 로그인 버튼 위에서 "로그인하면 무엇을 받는지"를 먼저 보여 준다. 수치·점수 표현은 쓰지 않는다(제품 원칙).
const LOGIN_BENEFITS = [
  "첫인상부터 예상 질문까지, 7개 섹션 리포트",
  "리포트는 1분 안에 도착해요",
  "첫 분석 1회 무료, 카드 등록 없이",
] as const;

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

  // 세션 확인 중에도 카드를 먼저 그린다. 예전엔 전체 스피너만 보여 CTA 클릭 뒤 수 초간 빈 화면이었다.
  // 버튼 영역은 GoogleSignInButton 이 세션이 정해질 때까지 "로그인 준비 중"으로 둔다.

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
            <p className="text-[14px] text-gray-400 text-center mb-6 leading-relaxed">
              Google 계정으로 간편하게 로그인하고
              <br />
              로그인만 하면 무료로 자소서 분석을 시작할 수 있어요.
            </p>

            <ul className="mb-7 space-y-2.5 rounded-xl border border-white/[0.06] px-4 py-3.5">
              {LOGIN_BENEFITS.map(benefit => (
                <li key={benefit} className="flex items-center gap-2.5 text-[13px] text-zinc-300">
                  <Check className="h-3.5 w-3.5 flex-shrink-0 text-zinc-500" aria-hidden="true" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <GoogleSignInButton redirectPath={redirectPath} />

            {/* 구분선 + 보안 안내 */}
            <div className="mt-6 pt-6 border-t border-white/[0.06] space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-[12px] text-gray-500">
                <Shield className="w-3.5 h-3.5 text-gray-600" />
                <span>Google 계정 비밀번호는 Pre:View에 저장되지 않습니다.</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[12px] text-gray-500">
                <Lock className="w-3.5 h-3.5 text-gray-600" />
                <span>자소서 본문은 분석에만 사용하고, 서버 로그에 남기지 않습니다.</span>
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
