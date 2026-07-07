import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";
import type { UserRole } from "@/types/admin";
import { Separator } from "@/components/ui/separator";

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      // 1) Supabase 이메일/비밀번호 로그인
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(getAuthErrorMessage(authError.message));
        setIsSubmitting(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        setError("로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
        setIsSubmitting(false);
        return;
      }

      // 2) role 확인
      const { data: userData, error: roleError } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .single<{ role: UserRole }>();

      if (roleError || !userData) {
        // users 테이블에 row가 없는 경우 (아직 upsert 되지 않은 신규 관리자)
        setError("사용자 정보를 찾을 수 없습니다. 관리자에게 문의해 주세요.");
        await supabase.auth.signOut();
        setIsSubmitting(false);
        return;
      }

      // 3) admin role 확인
      if (userData.role !== "admin") {
        setError("관리자 권한이 없는 계정입니다.");
        await supabase.auth.signOut();
        setIsSubmitting(false);
        return;
      }

      // 4) 성공 → /admin으로 이동
      navigate("/admin");
    } catch (err) {
      setError("알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.");
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/admin`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
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
                "relative w-full flex items-center justify-center gap-3 mb-6",
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

            {/* 구분선 */}
            <div className="flex items-center gap-2 mb-6">
              <Separator className="flex-1 bg-white/[0.08]" />
              <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold whitespace-nowrap">
                또는 이메일로 로그인
              </span>
              <Separator className="flex-1 bg-white/[0.08]" />
            </div>

            {/* 로그인 폼 */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* 이메일 */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-email"
                  className="block text-[13px] font-medium text-gray-300"
                >
                  이메일
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className={[
                    "w-full h-11 px-4 rounded-xl text-[14px]",
                    "bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-gray-600",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
                    "transition-all duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  ].join(" ")}
                />
              </div>

              {/* 비밀번호 */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-[13px] font-medium text-gray-300"
                >
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className={[
                      "w-full h-11 px-4 pr-11 rounded-xl text-[14px]",
                      "bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-gray-600",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50",
                      "transition-all duration-200",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    ].join(" ")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 로그인 버튼 */}
              <button
                id="admin-login-btn"
                type="submit"
                disabled={isSubmitting || !email || !password}
                className={[
                  "relative w-full flex items-center justify-center gap-2.5",
                  "h-11 px-6 rounded-xl font-semibold text-[14px] mt-2",
                  "bg-blue-600 text-white",
                  "border border-blue-500/50",
                  "transition-all duration-200",
                  "hover:bg-blue-500 hover:scale-[1.01] active:scale-[0.99]",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                  "shadow-[0_4px_16px_rgba(59,130,246,0.25)]",
                ].join(" ")}
              >
                {isSubmitting ? (
                  <>
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>로그인 중...</span>
                  </>
                ) : (
                  <>
                    <Lock className="size-4" />
                    <span>관리자 로그인</span>
                  </>
                )}
              </button>
            </form>

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

// ============================================================
// 에러 메시지 한글화
// ============================================================

function getAuthErrorMessage(message: string): string {
  if (
    message.includes("Invalid login credentials") ||
    message.includes("invalid_credentials")
  ) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (message.includes("Email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다. 이메일을 확인해 주세요.";
  }
  if (message.includes("Too many requests")) {
    return "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (message.includes("User not found")) {
    return "등록되지 않은 이메일입니다.";
  }
  return "로그인 중 오류가 발생했습니다. 다시 시도해 주세요.";
}
