import type { ReactNode } from "react";

import { useAuth } from "@/contexts/AuthContext";

// dark: 기업 분석 리포트(어두운 화면). light: 10월 밝은 디자인으로 바꾼 자소서 리포트.
const TONE = {
  dark: {
    main: "bg-[#09090B]",
    loading: "text-zinc-400",
    card: "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8",
    title: "text-lg font-semibold text-white",
    body: "text-zinc-400",
    button: "rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900",
  },
  light: {
    main: "bg-stage",
    loading: "text-ink-4",
    card: "rounded-3xl bg-surface p-8",
    title: "text-lg font-bold text-ink",
    body: "text-ink-3",
    button: "rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-hover",
  },
} as const;

/**
 * 리포트 화면 공통 로그인 게이트. 인증이 끝나기 전에는 리포트 DOM 을 전혀 만들지 않는다.
 * 소유권 검사는 서버(/api/analysis/:id)가 한다. 이 게이트는 편의 계층일 뿐이다.
 */
export function ReportAuthGate({
  loginRedirect,
  message,
  children,
  tone = "dark",
}: {
  /** 로그인 후 돌아올 경로 */
  loginRedirect: string;
  message: string;
  children: ReactNode;
  tone?: keyof typeof TONE;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const style = TONE[tone];

  if (isLoading) {
    return (
      <main className={`flex min-h-screen items-center justify-center px-6 text-center text-sm ${style.main} ${style.loading}`}>
        로그인 정보를 확인하는 중이에요.
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className={`flex min-h-screen items-center justify-center px-6 text-center ${style.main}`}>
        <section className={`max-w-sm ${style.card}`}>
          <h1 className={style.title}>로그인이 필요해요</h1>
          <p className={`mt-3 text-sm leading-relaxed ${style.body}`}>{message}</p>
          <a
            href={`/login?redirect=${encodeURIComponent(loginRedirect)}`}
            className={`mt-6 inline-flex ${style.button}`}
          >
            로그인하기
          </a>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
