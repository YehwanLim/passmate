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
      avatar_url: profile.profile_image,
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
    // GA4 중복 이벤트 방지: 세션 ID별로 한 번만 추적
    let trackedSessionId: string | null = null;

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
  const signInWithGoogle = useCallback(async (options?: { redirectTo?: string }) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: getGoogleOAuthOptions(options?.redirectTo ?? `${window.location.origin}/`),
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
