// ============================================================
// Auth 관련 TypeScript 타입 정의
// ============================================================

/** users 테이블과 1:1 매핑 */
export interface UserProfile {
  id: string;             // Supabase auth uid (UUID)
  email: string;
  name: string | null;
  profile_image: string | null;
  provider: string;       // 'google' | 'github' 등
  created_at: string;
  updated_at: string;
}

/** Auth Context가 제공하는 값 */
export interface AuthState {
  /** 로그인된 사용자 프로필 (null = 미로그인) */
  user: UserProfile | null;
  /** 세션 초기화 중 여부 (앱 최초 마운트 시) */
  isLoading: boolean;
  /** 로그인 여부 */
  isAuthenticated: boolean;
  /** Google OAuth 로그인 실행 */
  signInWithGoogle: (options?: { redirectTo?: string }) => Promise<void>;
  /** 로그아웃 */
  signOut: () => Promise<void>;
}
