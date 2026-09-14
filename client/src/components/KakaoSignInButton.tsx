import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// 카카오 로그인 버튼 디자인 가이드: 배경 #FEE500, 글자·심볼 검정 85%.
function KakaoSymbol({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.32 4.66 6.74l-.96 3.6c-.08.3.26.55.52.38l4.27-2.86c.5.06 1 .09 1.51.09 5.52 0 10-3.58 10-8S17.52 3 12 3z"
        fill="#000000"
        fillOpacity="0.85"
      />
    </svg>
  );
}

interface KakaoSignInButtonProps {
  /** 로그인 뒤 돌아올 경로. /login?redirect= 로 감싸서 Supabase 에 넘긴다 */
  redirectPath: string;
  /** 페이지를 떠나기 직전에 호출. 분석 폼은 여기서 초안을 저장한다 */
  onBeforeRedirect?: () => void;
}

/**
 * 카카오 로그인 버튼. 로그인 페이지와 분석 폼의 로그인 모달이 같이 쓴다.
 *
 * 구글의 GIS 버튼과 달리 항상 전체 페이지 리다이렉트다(Supabase OAuth → 카카오 → Supabase → /login?redirect=).
 * 그래서 화면의 메모리 상태는 사라진다. 보존이 필요하면 onBeforeRedirect 에서 저장한다.
 * 성공은 AuthContext 의 onAuthStateChange 가 알린다.
 */
export default function KakaoSignInButton({
  redirectPath,
  onBeforeRedirect,
}: KakaoSignInButtonProps) {
  const { signInWithKakao } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (isSigningIn) return; // 중복 클릭 방지
    setError(null);
    setIsSigningIn(true);
    try {
      onBeforeRedirect?.();
      await signInWithKakao({
        redirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(
          redirectPath,
        )}`,
      });
      // signInWithOAuth 가 페이지를 카카오로 보내므로 성공 시 이 아래는 실행되지 않는다.
    } catch {
      setError("카카오 로그인을 시작하지 못했어요. 다시 시도해 주세요.");
      setIsSigningIn(false);
    }
  };

  return (
    <>
      {error && (
        <div className="flex items-start gap-2.5 mb-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isSigningIn}
        // 크기·모양은 GoogleSignInButton(40px, 336px, 10px 모서리, 14px 글자)에 맞춘다.
        className={[
          "relative mx-auto w-full max-w-[336px] flex items-center justify-center gap-2.5",
          "h-10 px-5 rounded-[10px] font-medium text-[14px]",
          "bg-[#FEE500] text-black/85",
          "transition-colors duration-200",
          "hover:bg-[#F5DC00]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        ].join(" ")}
        aria-label="카카오로 계속하기"
      >
        {isSigningIn ? (
          <>
            <div className="w-4 h-4 border-2 border-black/20 border-t-black/70 rounded-full animate-spin" />
            <span>연결 중...</span>
          </>
        ) : (
          <>
            <KakaoSymbol className="w-[18px] h-[18px] flex-shrink-0" />
            <span>카카오로 계속하기</span>
          </>
        )}
      </button>
    </>
  );
}
