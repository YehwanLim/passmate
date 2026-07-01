import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

/**
 * useRequireAuth
 *
 * 로그인이 필요한 페이지에서 사용하는 커스텀 훅.
 * - 세션 로딩 완료 후 미인증 상태이면 /login 으로 리다이렉트합니다.
 * - 로딩 중에는 아무런 동작도 하지 않습니다.
 *
 * @example
 * export default function ProtectedPage() {
 *   const { isLoading } = useRequireAuth();
 *   if (isLoading) return <LoadingSpinner />;
 *   return <PageContent />;
 * }
 */
export function useRequireAuth() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);

  return { user, isLoading, isAuthenticated };
}
