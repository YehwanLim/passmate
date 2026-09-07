import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

import { useAuth } from "@/contexts/AuthContext";
import { AdminApiError, adminApiFetch } from "@/lib/adminApi";
import type { AdminRoleState } from "@/types/admin";

export function useRequireAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [roleState, setRoleState] = useState<AdminRoleState>("loading");
  // 서버에 관리자임을 확인받은 사용자 id. Supabase 는 탭 복귀·토큰 갱신마다 세션 이벤트를 보내
  // user 객체가 새로 만들어지는데, 같은 사람이면 다시 묻지 않는다 — 그때마다 "권한 확인 중" 으로
  // 화면을 내리면 입력 중이던 값이 날아간다. 실제 권한 경계는 서버 핸들러다.
  const verifiedUserId = useRef<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (authLoading) {
      setRoleState("loading");
      return;
    }
    if (!userId) {
      verifiedUserId.current = null;
      setRoleState("unauthenticated");
      navigate("/admin/login");
      return;
    }
    if (verifiedUserId.current === userId) {
      return;
    }

    let cancelled = false;
    const loadCurrentUser = async () => {
      setRoleState("loading");
      try {
        const currentUser = await adminApiFetch<{ role: string }>("/api/auth/me");
        if (cancelled) return;
        if (currentUser.role === "admin") {
          verifiedUserId.current = userId;
          setRoleState("admin");
        } else {
          setRoleState("forbidden");
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) {
          setRoleState("unauthenticated");
          navigate("/admin/login");
          return;
        }
        setRoleState("forbidden");
      }
    };
    loadCurrentUser();
    return () => { cancelled = true; };
  }, [authLoading, navigate, userId]);

  return {
    roleState,
    isLoading: roleState === "loading",
    isAdmin: roleState === "admin",
    isForbidden: roleState === "forbidden",
    user,
  };
}
