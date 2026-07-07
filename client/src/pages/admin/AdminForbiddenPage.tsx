import { ShieldX, ArrowLeft, Home } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";

/**
 * AdminForbiddenPage
 *
 * 관리자 영역 403 페이지.
 * 로그인은 됐지만 admin role이 없는 사용자에게 표시됩니다.
 *
 * - AdminLayout 없이 독립적으로 렌더링됩니다.
 * - 일반 사용자 페이지(/)로 이동하거나, 로그아웃할 수 있습니다.
 */
export default function AdminForbiddenPage() {
  const [, navigate] = useLocation();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-4">
      {/* 배경 그리드 */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* 상단 로고 */}
      <div
        className="absolute top-8 left-1/2 -translate-x-1/2 cursor-pointer"
        onClick={() => navigate("/")}
      >
        <Logo
          className="w-5 h-5"
          textClassName="text-base font-bold text-white"
        />
      </div>

      {/* 본문 */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      >
        {/* 아이콘 */}
        <div className="mb-6 flex items-center justify-center size-20 rounded-2xl bg-red-500/10 border border-red-500/20">
          <ShieldX className="size-9 text-red-400" />
        </div>

        {/* 에러 코드 */}
        <span className="text-xs font-semibold tracking-[0.2em] uppercase text-red-500/70 mb-3">
          403 Forbidden
        </span>

        {/* 제목 */}
        <h1 className="text-2xl font-bold tracking-tight mb-3">
          접근 권한이 없습니다
        </h1>

        {/* 설명 */}
        <p className="text-sm text-gray-400 leading-relaxed mb-2">
          이 페이지는 관리자 전용입니다.
        </p>
        {user?.email && (
          <p className="text-xs text-gray-600 mb-8">
            현재 로그인:{" "}
            <span className="text-gray-500 font-medium">{user.email}</span>
          </p>
        )}

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            variant="outline"
            className="flex-1 gap-2 border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.06] hover:text-white"
            onClick={() => navigate("/")}
          >
            <Home className="size-4" />
            사용자 페이지로
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.06] hover:text-white"
            onClick={handleSignOut}
          >
            <ArrowLeft className="size-4" />
            다른 계정으로 로그인
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
