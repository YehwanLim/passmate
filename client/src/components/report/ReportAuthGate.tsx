import type { ReactNode } from "react";

import { useAuth } from "@/contexts/AuthContext";

/**
 * 리포트 화면 공통 로그인 게이트. 인증이 끝나기 전에는 리포트 DOM 을 전혀 만들지 않는다.
 * 소유권 검사는 서버(/api/analysis/:id)가 한다. 이 게이트는 편의 계층일 뿐이다.
 */
export function ReportAuthGate({
  loginRedirect,
  message,
  children,
}: {
  /** 로그인 후 돌아올 경로 */
  loginRedirect: string;
  message: string;
  children: ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-zinc-400">
        로그인 정보를 확인하는 중이에요.
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center">
        <section className="max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8">
          <h1 className="text-lg font-semibold text-white">로그인이 필요해요</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">{message}</p>
          <a
            href={`/login?redirect=${encodeURIComponent(loginRedirect)}`}
            className="mt-6 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900"
          >
            로그인하기
          </a>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
