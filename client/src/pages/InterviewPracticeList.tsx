import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { Loader2 } from "lucide-react";

import SiteHeader from "@/components/SiteHeader";
import { INTERVIEW_MODE_COPY, INTERVIEW_TITLE } from "@/copy/interviewCopy";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { listInterviewSessions, type InterviewSession } from "@/lib/interview/interviewApi";

const STATUS_LABEL: Record<InterviewSession["status"], string> = {
  CREATED: "시작 전",
  ACTIVE: "진행 중",
  ENDED: "끝남",
  INTERRUPTED: "중단됨",
  CANCELLED: "취소(돌려드림)",
};

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** 지난 AI 모의 면접 목록. 리포트별(analysisId)로 좁힐 수 있다. */
export default function InterviewPracticeList() {
  const search = useSearch();
  const analysisId = new URLSearchParams(search).get("analysisId") ?? undefined;
  const { isLoading: authLoading } = useRequireAuth({ redirectPath: `/my/interview-practice${search ? `?${search}` : ""}` });
  const [sessions, setSessions] = useState<InterviewSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    listInterviewSessions(analysisId)
      .then((rows) => { if (alive) setSessions(rows); })
      .catch(() => { if (alive) setError("지난 면접을 불러오지 못했어요."); });
    return () => { alive = false; };
  }, [authLoading, analysisId]);

  return (
    <div className="min-h-screen bg-stage pb-24 text-ink">
      <SiteHeader variant="light" />
      <main className="container max-w-2xl pt-10">
        <h1 className="text-[28px] font-bold tracking-[-0.03em]">{INTERVIEW_TITLE}</h1>
        <p className="mt-1.5 text-[15px] text-ink-4">지난 면접의 피드백과 대화 글을 다시 볼 수 있어요.</p>
        {/* 상단 '마이페이지 > AI 모의 면접 기록'·내 이용권에서 들어온 사람에게 새 면접을 어디서 시작하는지 알려 준다(11-08) */}
        <p className="mt-1 text-[14px] text-ink-4">
          새 면접은 자기소개서 리포트의 예상 질문 아래에서 시작해요.{" "}
          <Link href="/my" className="font-semibold text-brand-ink underline-offset-4 hover:underline">
            내 자기소개서 보기
          </Link>
        </p>
        <section className="mt-8" aria-live="polite">
          {error ? (
            <p className="rounded-2xl bg-surface px-6 py-5 text-[15px] text-danger">{error}</p>
          ) : sessions === null ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink-4" aria-hidden="true" /></div>
          ) : sessions.length === 0 ? (
            <p className="rounded-2xl bg-surface px-6 py-5 text-[15px] text-ink-4">아직 본 면접이 없어요.</p>
          ) : (
            <ul className="space-y-3">
              {sessions.map((session) => (
                <li key={session.id}>
                  <Link href={`/my/interview-practice/${session.id}`} className="block rounded-2xl bg-surface px-6 py-5 transition-colors hover:bg-fill-soft">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-[16px] font-bold">{[session.company, session.jobRole].filter(Boolean).join(" ") || INTERVIEW_MODE_COPY[session.mode].label}</p>
                      <span className="shrink-0 text-[13px] text-ink-4">{STATUS_LABEL[session.status]}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-4">
                      {INTERVIEW_MODE_COPY[session.mode].label} · {formatDate(session.createdAt)}
                      {session.feedbackStatus === "SUCCEEDED" ? " · 피드백 있음" : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
