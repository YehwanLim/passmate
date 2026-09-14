import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { createSignInNonce, loadGoogleIdentity } from "@/lib/googleIdentity";
import { AlertCircle } from "lucide-react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;
// 소셜 로그인 버튼 공통 너비. KakaoSignInButton 의 max-w-[336px] 와 같은 값.
const SOCIAL_BUTTON_MAX_WIDTH = 336;

// ============================================================
// Google 아이콘 SVG
// ============================================================
function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

interface GoogleSignInButtonProps {
  /** OAuth 폴백(전체 페이지 리다이렉트)이 끝난 뒤 돌아올 경로 */
  redirectPath: string;
  /** 폴백 버튼일 때만 아래에 그린다. 폴백은 페이지를 떠나므로, 화면의 입력이 사라진다는 안내용 */
  fallbackNotice?: ReactNode;
  /** 폴백(리다이렉트)으로 페이지를 떠나기 직전에 호출. GIS 경로에서는 부르지 않는다 */
  onBeforeRedirect?: () => void;
}

/**
 * Google 로그인 버튼. 로그인 페이지와 분석 폼의 로그인 모달이 같이 쓴다.
 *
 * 기본은 GIS(Google이 그려주는 버튼) → ID 토큰 → signInWithIdToken 이라 페이지를 떠나지 않는다.
 * 그래서 모달 뒤의 폼 입력이 메모리에 그대로 남는다. 성공은 AuthContext 의 onAuthStateChange 가 알린다.
 * GIS 를 못 쓰면(클라이언트 ID 없음·스크립트 실패) Supabase OAuth 리다이렉트로 폴백한다.
 */
export default function GoogleSignInButton({
  redirectPath,
  fallbackNotice,
  onBeforeRedirect,
}: GoogleSignInButtonProps) {
  const { isAuthenticated, isLoading: authLoading, signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // GIS(Google 공식 버튼) 상태: 로드 실패 시 기존 리다이렉트 방식으로 폴백
  const [gisStatus, setGisStatus] = useState<"loading" | "ready" | "fallback">(
    GOOGLE_CLIENT_ID ? "loading" : "fallback",
  );
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // GIS 초기화: Google이 그려주는 버튼 → ID 토큰 → signInWithIdToken.
  // Supabase 서버를 경유하지 않아 동의 화면에 우리 도메인이 표시된다.
  useEffect(() => {
    if (authLoading || isAuthenticated || !GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    (async () => {
      try {
        const { nonce, hashedNonce } = await createSignInNonce();
        const googleId = await loadGoogleIdentity();
        const container = googleButtonRef.current;
        if (cancelled || !container) return;

        googleId.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashedNonce,
          callback: async ({ credential }) => {
            setError(null);
            setIsSigningIn(true);
            const { error: signInError } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: credential,
              nonce,
            });
            if (signInError) {
              setError(
                "로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.",
              );
              setIsSigningIn(false);
            }
            // 성공 시 onAuthStateChange → 호출하는 화면이 isAuthenticated 로 다음 동작을 한다
          },
        });
        googleId.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          // GIS 는 pill(20px) 아니면 rectangular(4px)뿐이라, rectangular 로 그리고 바깥 상자(rounded-[10px] overflow-hidden)로 모서리를 맞춘다.
          shape: "rectangular",
          logo_alignment: "center",
          width: Math.min(SOCIAL_BUTTON_MAX_WIDTH, container.offsetWidth || SOCIAL_BUTTON_MAX_WIDTH),
          locale: "ko",
        });
        setGisStatus("ready");
      } catch {
        if (!cancelled) setGisStatus("fallback");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const handleGoogleLogin = async () => {
    if (isSigningIn) return; // 중복 클릭 방지
    setError(null);
    setIsSigningIn(true);
    try {
      onBeforeRedirect?.();
      await signInWithGoogle({
        redirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(
          redirectPath,
        )}`,
      });
      // signInWithOAuth는 페이지를 Google로 리다이렉트하므로
      // 이 이후 코드는 실행되지 않습니다.
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "로그인 중 오류가 발생했습니다. 다시 시도해 주세요.";
      setError(message);
      setIsSigningIn(false);
    }
  };

  return (
    <>
      {/* 에러 메시지 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-2.5 mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google 로그인 버튼: GIS 공식 버튼 (실패 시 아래 폴백 버튼) */}
      {gisStatus !== "fallback" && (
        <div className="relative min-h-10">
          <div
            ref={googleButtonRef}
            className={[
              "mx-auto w-full max-w-[336px] h-10 overflow-hidden rounded-[10px] transition-opacity duration-200",
              gisStatus === "ready" && !isSigningIn
                ? "opacity-100"
                : "opacity-0 pointer-events-none",
            ].join(" ")}
          />
          {(gisStatus === "loading" || isSigningIn) && (
            <div className="absolute inset-0 mx-auto max-w-[336px] flex items-center justify-center gap-3 rounded-[10px] bg-white/[0.04] border border-white/10">
              <div className="w-5 h-5 border-2 border-gray-500/40 border-t-gray-300 rounded-full animate-spin" />
              <span className="text-[14px] text-gray-400">
                {isSigningIn ? "연결 중..." : "로그인 준비 중..."}
              </span>
            </div>
          )}
        </div>
      )}
      {gisStatus === "fallback" && (
        <>
          <button
            id="google-login-btn"
            onClick={handleGoogleLogin}
            disabled={isSigningIn}
            // 폴백도 GIS 버튼·카카오 버튼과 같은 크기(40px, 10px 모서리)로 맞춘다.
            className={[
              "relative mx-auto w-full max-w-[336px] flex items-center justify-center gap-2.5",
              "h-10 px-5 rounded-[10px] font-medium text-[14px]",
              "bg-white text-gray-900",
              "border border-white/20",
              "transition-colors duration-200",
              "hover:bg-gray-50",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            ].join(" ")}
            aria-label="Google로 계속하기"
          >
            {isSigningIn ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                <span className="text-gray-600">연결 중...</span>
              </>
            ) : (
              <>
                <GoogleIcon className="w-5 h-5 flex-shrink-0" />
                <span>Google로 계속하기</span>
              </>
            )}
          </button>
          {fallbackNotice}
        </>
      )}
    </>
  );
}
