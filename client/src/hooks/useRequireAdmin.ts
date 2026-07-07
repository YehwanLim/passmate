import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { AdminRoleState, UserRole } from "@/types/admin";

/**
 * useRequireAdmin
 *
 * 관리자 페이지에서 사용하는 커스텀 훅.
 * Supabase `users` 테이블의 `role` 컬럼을 조회하여 권한을 검사합니다.
 *
 * 상태 전이:
 * - 인증 로딩 중           → roleState = 'loading'
 * - 비로그인               → roleState = 'unauthenticated' + navigate('/admin/login')
 * - 로그인 + role != admin → roleState = 'forbidden'
 * - 로그인 + role = admin  → roleState = 'admin'
 *
 * @example
 * function AdminGuard({ children }) {
 *   const { roleState } = useRequireAdmin();
 *   if (roleState === 'loading') return <Spinner />;
 *   if (roleState === 'forbidden') return <AdminForbiddenPage />;
 *   return roleState === 'admin' ? children : null;
 * }
 */
export function useRequireAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [roleState, setRoleState] = useState<AdminRoleState>("loading");

  useEffect(() => {
    // 1) 인증 정보 로딩 중이면 대기
    if (authLoading) {
      setRoleState("loading");
      return;
    }

    // 2) 비로그인 → /admin/login 리다이렉트
    if (!user) {
      setRoleState("unauthenticated");
      navigate("/admin/login");
      return;
    }

    // 3) 로그인 상태 → users 테이블에서 role 조회
    let cancelled = false;

    const fetchRole = async () => {
      setRoleState("loading");

      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single<{ role: UserRole }>();

      if (cancelled) return;

      if (error) {
        console.warn("[useRequireAdmin] role 조회 실패:", error.message);
        // 조회 실패 시 보안 원칙에 따라 forbidden 처리
        setRoleState("forbidden");
        return;
      }

      setRoleState(data?.role === "admin" ? "admin" : "forbidden");
    };

    fetchRole();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate]);

  return {
    roleState,
    isLoading: roleState === "loading",
    isAdmin: roleState === "admin",
    isForbidden: roleState === "forbidden",
    user,
  };
}
