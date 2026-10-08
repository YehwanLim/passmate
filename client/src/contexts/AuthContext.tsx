import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Session } from "@supabase/supabase-js";
import type { AuthState, UserProfile } from "@/types/auth";
import { trackLogin, trackSignUp } from "@/lib/analytics";
import { sendFunnelEvent } from "@/lib/siteVisits";
import { getGoogleOAuthOptions } from "@/lib/authOptions";
import { clearPassMateStorage } from "@/utils/storage";

// ============================================================
// Context
// ============================================================

const AuthContext = createContext<AuthState | undefined>(undefined);

// Supabase 클라이언트(@supabase/* 소스 ~840KB)는 랜딩 첫 페인트에 필요 없으므로 지연 로드한다.
// 정적 import로 되돌리면 Rollup이 진입 청크에 도로 합친다. (가드: AuthContext.test.tsx)
const loadSupabase = () => import("@/lib/supabase").then(module => module.supabase);

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

/**
 * 저장소에 남아 있는 Supabase 세션으로 만든 "임시" 프로필. 헤더가 지연 청크·토큰 갱신을 기다리지 않고
 * 프로필을 바로 그리는 데만 쓴다 — 권한 판단(isAuthenticated·가드)에는 쓰지 않는다.
 * 키 형식은 supabase-js 기본값 `sb-<프로젝트 ref>-auth-token`(userStorage 미사용이라 user 가 세션 안에 있다).
 */
export function readStoredProfile(): UserProfile | null {
  try {
    const ref = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split(".")[0];
    const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session | null;
    if (!session?.user?.id || !session.refresh_token) return null;
    return sessionToProfile(session);
  } catch {
    return null;
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
    let subscription: { unsubscribe: () => void } | null = null;
    // GA4 중복 이벤트 방지: 세션 ID별로 한 번만 추적
    let trackedSessionId: string | null = null;

    const resolve = (session: Session | null) => {
      if (!mounted || resolved) return;
      resolved = true;
      if (session) {
        setUser(sessionToProfile(session));
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    loadSupabase().then(supabase => {
      if (!mounted) return;

      // 1) onAuthStateChange — 모든 세션 변화 감지
      subscription = supabase.auth.onAuthStateChange((event, session) => {
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
              // DB 퍼널에도 남긴다. 콜백 안에서 세션 조회(토큰 첨부)를 기다리지 않도록 다음 틱으로 미룬다.
              setTimeout(() => void sendFunnelEvent("signup_complete", provider), 0);
            }
          }
        } else {
          setUser(null);
          trackedSessionId = null; // 로그아웃 시 초기화
        }

        // 최초 resolved 처리 (INITIAL_SESSION 또는 SIGNED_IN으로)
        resolve(session);
      }).data.subscription;

      // 2) getSession() — onAuthStateChange가 늦게 발생할 경우 fallback
      supabase.auth.getSession().then(({ data: { session } }) => {
        resolve(session);
      });
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Google OAuth 로그인
  const signInWithGoogle = useCallback(async (options?: { redirectTo?: string }) => {
    const supabase = await loadSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: getGoogleOAuthOptions(options?.redirectTo ?? `${window.location.origin}/`),
    });
    if (error) {
      throw error;
    }
  }, []);

  // 카카오 OAuth 로그인. Supabase 가 카카오 콘솔의 Redirect URI(…/auth/v1/callback)로 받아 redirectTo 로 돌려보낸다.
  const signInWithKakao = useCallback(async (options?: { redirectTo?: string }) => {
    const supabase = await loadSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: options?.redirectTo ?? `${window.location.origin}/` },
    });
    if (error) {
      throw error;
    }
  }, []);

  // 로그아웃
  const signOut = useCallback(async () => {
    try {
      const supabase = await loadSupabase();
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
    signInWithKakao,
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
