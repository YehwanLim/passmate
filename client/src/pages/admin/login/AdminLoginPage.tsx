import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, AlertCircle, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getGoogleOAuthOptions } from "@/lib/authOptions";
import Logo from "@/components/Logo";
import type { UserRole } from "@/types/admin";

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

export default function AdminLoginPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 로그인 + admin인 경우 바로 /admin으로 이동
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .single<{ role: UserRole }>();
      if (data?.role === "admin") navigate("/admin");
    });
  }, [authLoading, isAuthenticated, navigate]);

  const handleGoogleLogin = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: getGoogleOAuthOptions(`${window.location.origin}/admin`),
      });
      if (error) {
        setError(error.message);
        setIsSubmitting(false);
      }
    } catch (err) {
      setError("Google 로그인 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setIsSubmitting(false);
    }
  };

  // 세션 초기화 대기
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="size-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* 배경 도트 그리드 */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* 배경 그라디언트 글로우 */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,0.08) 0%, transparent 70%)",
        }}
      />

      {/* 상단 로고 */}
      <motion.header
        className="relative z-10 flex items-center justify-center pt-10 pb-4"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="cursor-pointer" onClick={() => navigate("/")}>
          <Logo className="w-5 h-5" textClassName="text-lg font-bold text-white" />
        </div>
      </motion.header>

      {/* 메인 카드 */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          {/* 카드 */}
          <div
            className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl px-8 py-10"
            style={{
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.05), 0 24px 64px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* 상단 배지 */}
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 tracking-wider uppercase">
                <Lock className="w-3 h-3" />
                Admin Console
              </span>
            </div>

            {/* 타이틀 */}
            <h1 className="text-2xl font-bold text-center tracking-tight mb-2">
              관리자 로그인
            </h1>
            <p className="text-[13px] text-gray-400 text-center mb-8 leading-relaxed">
              PassMate 관리자 전용 페이지입니다.
              <br />
              허가된 계정으로만 접근할 수 있습니다.
            </p>

            {/* 에러 메시지 */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden mb-5"
                >
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Google 로그인 버튼 */}
            <button
              id="admin-google-login-btn"
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className={[
                "relative w-full flex items-center justify-center gap-3",
                "h-11 px-6 rounded-xl font-medium text-[14px]",
                "bg-white text-gray-900",
                "border border-white/20",
                "transition-all duration-200",
                "hover:bg-gray-50 hover:scale-[1.01] active:scale-[0.99]",
                "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100",
                "shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
              ].join(" ")}
              aria-label="Google로 계속하기"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  <span className="text-gray-600">연결 중...</span>
                </>
              ) : (
                <>
                  <GoogleIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Google로 계속하기</span>
                </>
              )}
            </button>

            {/* 하단 보안 안내 */}
            <div className="mt-6 pt-5 border-t border-white/[0.06]">
              <div className="flex items-center justify-center gap-1.5 text-[12px] text-gray-600">
                <Shield className="w-3.5 h-3.5 text-gray-700" />
                <span>관리자 권한이 없으면 접근이 차단됩니다.</span>
              </div>
            </div>
          </div>

          {/* 일반 사용자 안내 */}
          <p className="text-center text-[12px] text-gray-700 mt-5">
            일반 사용자이신가요?{" "}
            <span
              className="text-gray-500 underline underline-offset-2 cursor-pointer hover:text-gray-300 transition-colors"
              onClick={() => navigate("/")}
            >
              메인 페이지로 이동
            </span>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
