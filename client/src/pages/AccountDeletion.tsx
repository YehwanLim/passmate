import { useState } from "react";
import { Link, useLocation } from "wouter";

import { useAuth } from "@/contexts/AuthContext";
import { getAuthorizationHeader } from "@/lib/apiAuth";

function hasPendingDeletionIntent() {
  return new URLSearchParams(window.location.search).get("pending") === "1";
}

export default function AccountDeletion() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const [pendingIntent, setPendingIntent] = useState(hasPendingDeletionIntent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const requestDeletion = async () => {
    if (isSubmitting || !window.confirm("계정과 저장된 분석 데이터를 30일 후 삭제하도록 예약할까요?")) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/deletion", {
        headers: await getAuthorizationHeader(),
        method: "POST",
      });
      if (!response.ok) throw new Error("ACCOUNT_DELETION_REQUEST_FAILED");

      await signOut();
      setPendingIntent(true);
      navigate("/account/deletion?pending=1");
    } catch {
      setMessage("삭제 예약을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDeletion = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/deletion/cancel", {
        headers: await getAuthorizationHeader(),
        method: "POST",
      });
      if (!response.ok) throw new Error("ACCOUNT_DELETION_CANCEL_FAILED");

      setPendingIntent(false);
      setMessage("계정 삭제 예약을 취소했습니다.");
      navigate("/");
    } catch {
      setMessage("삭제 예약을 취소하지 못했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#09090B] text-sm text-zinc-400">로그인 정보를 확인하는 중이에요.</main>;
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-zinc-100">
        <section className="max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8">
          <h1 className="text-xl font-semibold">계정 삭제 예약</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            삭제 예약 후 30일 안에 다시 로그인하면 이 화면에서 취소할 수 있어요.
          </p>
          <Link href="/login?redirect=%2Faccount%2Fdeletion%3Fpending%3D1" className="mt-6 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900">
            로그인하기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8">
        <h1 className="text-xl font-semibold">{pendingIntent ? "계정 삭제 예약 취소" : "계정 삭제 예약"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {pendingIntent
            ? "예약을 취소하면 계정과 저장된 분석 데이터를 계속 사용할 수 있어요."
            : "예약 즉시 앱 API 접근이 차단되며, 30일 후 계정과 저장된 분석 데이터가 파기됩니다."}
        </p>
        {message && <p role="alert" className="mt-4 text-sm text-amber-300">{message}</p>}
        <div className="mt-7 flex gap-3">
          <button
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-zinc-300"
            disabled={isSubmitting}
            onClick={() => navigate("/")}
          >
            돌아가기
          </button>
          <button
            className="rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={isSubmitting}
            onClick={pendingIntent ? cancelDeletion : requestDeletion}
          >
            {isSubmitting ? "처리 중..." : pendingIntent ? "삭제 예약 취소" : "30일 후 계정 삭제 예약"}
          </button>
        </div>
      </section>
    </main>
  );
}
