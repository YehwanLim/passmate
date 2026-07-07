import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import AdminForbiddenPage from "@/pages/admin/AdminForbiddenPage";

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * AdminGuard
 *
 * Next.js middleware를 대체하는 SPA 라우트 가드 컴포넌트.
 * `/admin/login`을 제외한 모든 `/admin/*` 라우트를 이 컴포넌트로 래핑합니다.
 *
 * 내부적으로 `useRequireAdmin`을 사용하여 Supabase `users.role` 컬럼을 확인합니다.
 *
 * 상태별 동작:
 * - loading        → 전체화면 로딩 스피너
 * - unauthenticated → useRequireAdmin이 /admin/login으로 리다이렉트 (null 반환)
 * - forbidden      → 403 페이지 렌더링 (AdminForbiddenPage)
 * - admin          → children 렌더링
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { roleState } = useRequireAdmin();

  // ── 로딩 중 ──────────────────────────────────────────────
  if (roleState === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <span className="text-sm text-muted-foreground">권한 확인 중...</span>
        </div>
      </div>
    );
  }

  // ── 비로그인 → useRequireAdmin이 /admin/login으로 navigate ──
  if (roleState === "unauthenticated") {
    return null;
  }

  // ── 로그인됐지만 admin role 없음 → 403 ────────────────────
  if (roleState === "forbidden") {
    return <AdminForbiddenPage />;
  }

  // ── admin 확인 완료 → 콘텐츠 렌더링 ──────────────────────
  return <>{children}</>;
}
