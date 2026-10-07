import { useEffect, useState } from "react";
import { Link, useLocation, type RouteComponentProps } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import InAppBrowserNotice from "@/components/InAppBrowserNotice";
import KakaoSignInButton from "@/components/KakaoSignInButton";
import Logo from "@/components/Logo";
import { detectInAppBrowser, type InAppBrowserKind } from "@/lib/inAppBrowser";
import { ArrowLeft, Lock, Shield } from "lucide-react";

// ============================================================
// 로그인 페이지
// ============================================================
export default function Login({
  inAppBrowser,
}: Partial<RouteComponentProps> & {
  /** 테스트용. 기본은 User-Agent 로 판별한다 */
  inAppBrowser?: InAppBrowserKind | null;
} = {}) {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const redirectPath = getSafeRedirectPath();
  // 인앱 브라우저(카카오톡·인스타그램 등)에서는 Google 이 로그인을 막으므로 안내 카드로 바꾸고 카카오만 남긴다.
  const [detectedInApp] = useState(() => detectInAppBrowser());
  const inApp = inAppBrowser === undefined ? detectedInApp : inAppBrowser;

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
      className="min-h-screen bg-stage text-ink flex flex-col"
      style={{ overflowX: "clip" }}
    >
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
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-4 transition-colors hover:bg-fill hover:text-ink-2 sm:left-6"
          aria-label="홈으로 돌아가기"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="cursor-pointer" onClick={() => navigate("/")}>
          <Logo className="h-6 w-auto" variant="default" />
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
          <div className="relative rounded-[20px] bg-surface px-8 py-10">
            {/* 타이틀 */}
            <h1 className="text-[28px] font-bold text-center tracking-[-0.03em] text-ink mb-2">
              시작하기
            </h1>
            <p className="text-[14px] text-ink-3 text-center mb-6 leading-relaxed">
              Google 또는 카카오 계정으로 간편하게 로그인하고
              <br />
              로그인만 하면 무료로 자소서 분석을 시작할 수 있어요.
            </p>

            <div className="mt-8 space-y-3">
              {inApp ? (
                <InAppBrowserNotice kind={inApp} />
              ) : (
                <GoogleSignInButton redirectPath={redirectPath} />
              )}
              <KakaoSignInButton redirectPath={redirectPath} />
            </div>

            {/* 구분선 + 보안 안내 */}
            <div className="mt-6 pt-6 border-t border-line-soft space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-[12px] text-ink-4">
                <Shield className="w-3.5 h-3.5 text-ink-5" />
                <span>계정 비밀번호는 Pre:View에 저장되지 않습니다.</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[12px] text-ink-4">
                <Lock className="w-3.5 h-3.5 text-ink-5" />
                <span>자소서는 분석에만 쓰이고, AI 학습에 사용되지 않습니다.</span>
              </div>
            </div>
          </div>

          {/* 하단 안내 */}
          <p className="text-center text-[12px] text-ink-4 mt-5 leading-relaxed">
            로그인 시{" "}
            <Link
              href="/terms"
              className="text-ink-3 underline underline-offset-2 transition-colors hover:text-ink"
            >
              이용약관
            </Link>{" "}
            및{" "}
            <Link
              href="/privacy"
              className="text-ink-3 underline underline-offset-2 transition-colors hover:text-ink"
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
