import { createClient } from "@supabase/supabase-js";

// ============================================================
// Supabase 클라이언트 싱글톤
// 환경변수: .env 파일의 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// ============================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[Supabase] VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 .env에 설정되지 않았습니다."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    // PKCE 플로우 사용 (기본값) — ?code= 쿼리 파라미터 방식
    // implicit 플로우는 access_token 직접 검증 시 401 발생 이슈 있음
    flowType: "pkce",
  },
});
