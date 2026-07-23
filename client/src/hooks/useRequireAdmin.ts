import { useEffect, useState } from "react";
import { useLocation } from "wouter";

import { useAuth } from "@/contexts/AuthContext";
import { AdminApiError, adminApiFetch } from "@/lib/adminApi";
import type { AdminRoleState } from "@/types/admin";

export function useRequireAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [roleState, setRoleState] = useState<AdminRoleState>("loading");

  useEffect(() => {
    if (authLoading) {
      setRoleState("loading");
      return;
    }
    if (!user) {
      setRoleState("unauthenticated");
      navigate("/admin/login");
      return;
    }

    let cancelled = false;
    const loadCurrentUser = async () => {
      setRoleState("loading");
      try {
        const currentUser = await adminApiFetch<{ role: string }>("/api/auth/me");
        if (!cancelled) setRoleState(currentUser.role === "admin" ? "admin" : "forbidden");
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
  }, [authLoading, navigate, user]);

  return {
    roleState,
    isLoading: roleState === "loading",
    isAdmin: roleState === "admin",
    isForbidden: roleState === "forbidden",
    user,
  };
}
