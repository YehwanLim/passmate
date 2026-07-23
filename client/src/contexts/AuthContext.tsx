import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AuthState, UserProfile } from "@/types/auth";
import { trackLogin, trackSignUp } from "@/lib/analytics";
import { getGoogleOAuthOptions } from "@/lib/authOptions";
import { clearPassMateStorage } from "@/utils/storage";

// ============================================================
// Context
// ============================================================

const AuthContext = createContext<AuthState | undefined>(undefined);

// ============================================================
// Helper — Supabase session → UserProfile
// ============================================================

function sessionToProfile(session: Session): UserProfile {
  const { user } = session;
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? "",
    name: (meta.full_name ?? meta.name ?? null) as string | null,
    profile_image: (meta.avatar_url ?? meta.picture ?? null) as string | null,
    provider: user.app_metadata?.provider ?? "google",
    created_at: user.created_at,
    updated_at: user.updated_at ?? user.created_at,
  };
}

// ============================================================
// Provider
// ============================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 앱 마운트 시 기존 세션 복원 + OAuth 콜백 처리
  useEffect(() => {
    let mounted = true;
    let resolved = false;
    // GA4 중복 이벤트 방지: 세션 ID별로 한 번만 추적
    let trackedSessionId: string | null = null;

    const resolve = (session: import("@supabase/supabase-js").Session | null) => {
      if (!mounted || resolved) return;
      resolved = true;
      if (session) {
        setUser(sessionToProfile(session));
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    // 1) onAuthStateChange — 모든 세션 변화 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (session) {
        const profile = sessionToProfile(session);
        setUser(profile);
        // GA4: 로그인 이벤트 추적 (세션 ID 기준 중복 방지)
        if (event === "SIGNED_IN" && trackedSessionId !== session.user.id) {
          trackedSessionId = session.user.id;
          const provider = session.user.app_metadata?.provider ?? "google";
          trackLogin(provider);
          // 신규 가입 판별: created_at과 updated_at이 5초 이내면 최초 가입으로 간주
          const createdAt = new Date(session.user.created_at).getTime();
          const updatedAt = new Date(
            session.user.updated_at ?? session.user.created_at
          ).getTime();
          if (Math.abs(updatedAt - createdAt) < 5000) {
            trackSignUp(provider);
          }
        }
      } else {
        setUser(null);
        trackedSessionId = null; // 로그아웃 시 초기화
      }

      // 최초 resolved 처리 (INITIAL_SESSION 또는 SIGNED_IN으로)
      resolve(session);
    });

    // 2) getSession() — onAuthStateChange가 늦게 발생할 경우 fallback
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolve(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Google OAuth 로그인
  const signInWithGoogle = useCallback(async (options?: { redirectTo?: string }) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: getGoogleOAuthOptions(options?.redirectTo ?? `${window.location.origin}/`),
    });
    if (error) {
      throw error;
    }
  }, []);

  // 로그아웃
  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } finally {
      clearPassMateStorage();
    }
  }, []);

  const value: AuthState = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================
// Hook
// ============================================================

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
