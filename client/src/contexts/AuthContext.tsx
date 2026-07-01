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
// users 테이블 Upsert
// 로그인 성공 시 DB에 사용자 정보를 저장/갱신합니다.
// ============================================================

async function upsertUser(profile: UserProfile): Promise<void> {
  const { error } = await supabase.from("users").upsert(
    {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      profile_image: profile.profile_image,
      provider: profile.provider,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "id",     // id 기준 충돌 시 UPDATE
      ignoreDuplicates: false,
    }
  );

  if (error) {
    // RLS 미설정 등의 이유로 실패해도 로그인 흐름은 막지 않음
    console.warn("[AuthContext] users upsert 실패:", error.message);
  }
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

    const resolve = (session: import("@supabase/supabase-js").Session | null, source: string) => {
      if (!mounted || resolved) return;
      resolved = true;
      console.log("[Auth] resolved from:", source, "| user:", session?.user?.email ?? "none");
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
      console.log("[Auth] event:", event, "| user:", session?.user?.email ?? "none");

      if (session) {
        const profile = sessionToProfile(session);
        setUser(profile);
        // 로그인 완료 시 users 테이블 upsert
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          upsertUser(profile);
        }
      } else {
        setUser(null);
      }

      // 최초 resolved 처리 (INITIAL_SESSION 또는 SIGNED_IN으로)
      resolve(session, event);
    });

    // 2) getSession() — onAuthStateChange가 늦게 발생할 경우 fallback
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.warn("[Auth] getSession error:", error.message);
      console.log("[Auth] getSession:", session?.user?.email ?? "none");
      resolve(session, "getSession");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Google OAuth 로그인
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // OAuth 완료 후 돌아올 URL (현재 origin 기준)
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) {
      console.error("[AuthContext] Google 로그인 오류:", error.message);
      throw error;
    }
  }, []);

  // 로그아웃
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[AuthContext] 로그아웃 오류:", error.message);
      throw error;
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
