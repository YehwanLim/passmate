import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowRight, Loader2 } from "lucide-react";

import CompanyCombobox from "@/components/analyze/CompanyCombobox";
import JobRoleCombobox from "@/components/analyze/JobRoleCombobox";
import InterviewPracticeIntroSection, { INTERVIEW_START_FORM_ID } from "@/components/InterviewPracticeIntroSection";
import SiteHeader from "@/components/SiteHeader";
import { useAuth } from "@/contexts/AuthContext";
import { INTERVIEW_CARD_COPY, INTERVIEW_MODE_COPY, INTERVIEW_START_COPY } from "@/copy/interviewCopy";
import { useCreditSummary } from "@/hooks/useCreditSummary";
import { directSourceFromApplication, loadInterviewDirectDraft, saveInterviewDirectDraft } from "@/lib/interview/directDraft";
import { INTERVIEW_DIRECT_LIMITS, listInterviewSessions, type InterviewMode, type InterviewSession } from "@/lib/interview/interviewApi";
import { fetchApplication, listApplications } from "@/lib/workspace";
import type { ProjectSummary } from "@/types/my";

const STATUS_LABEL: Record<InterviewSession["status"], string> = {
  CREATED: "시작 전",
  ACTIVE: "진행 중",
  ENDED: "끝남",
  INTERRUPTED: "중단됨",
  CANCELLED: "취소(돌려드림)",
};
const HISTORY_ID = "interview-history";

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * /my/interview-practice — AI 모의 면접 소개 화면(11-09). 로그인 없이도 열린다.
 * 위: 소개 → 진행 순서 → 리포트 없이 시작하는 입력 칸(회사·직무·자소서) → 로그인했다면 지난 면접 목록.
 * 로그인했고 답을 쓴 지원서가 있으면 '저장한 지원서 불러오기'로 회사·직무·자소서를 한 번에 채운다(11-09).
 * 입력은 sessionStorage 로 시작 화면(/start?source=direct)에 넘기고, 로그인은 시작 화면이 요구한다.
 * ?analysisId= 로 들어오면(리포트의 '지난 면접 보기') 목록을 그 리포트로 좁히고 목록으로 내려간다.
 */
export default function InterviewPracticeList() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const analysisId = new URLSearchParams(search).get("analysisId") ?? undefined;
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { summary } = useCreditSummary(isAuthenticated);
  const [sessions, setSessions] = useState<InterviewSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [initialDraft] = useState(loadInterviewDirectDraft);
  const [company, setCompany] = useState(initialDraft?.company ?? "");
  const [jobRole, setJobRole] = useState(initialDraft?.jobRole ?? "");
  const [coverLetter, setCoverLetter] = useState(initialDraft?.coverLetter ?? "");
  const [mode, setMode] = useState<InterviewMode>("FULL");
  const [formError, setFormError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ProjectSummary[]>([]);
  const [pickedApplication, setPickedApplication] = useState("");
  const [importing, setImporting] = useState(false);

  // 불러올 지원서 목록. 편의 기능이라 실패하면 고르는 칸만 숨긴다.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let alive = true;
    listApplications()
      .then((rows) => {
        if (alive) setApplications(rows.filter((row) => row.kind !== "COMPANY" && (row.answered_count ?? 0) > 0));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [authLoading, isAuthenticated]);

  const importApplication = async (id: string) => {
    setPickedApplication(id);
    if (!id) return;
    setImporting(true);
    setFormError(null);
    try {
      const source = directSourceFromApplication(await fetchApplication(id));
      if (!source) {
        setFormError(INTERVIEW_START_COPY.importEmpty);
        return;
      }
      if (source.company) setCompany(source.company);
      if (source.jobRole) setJobRole(source.jobRole);
      setCoverLetter(source.coverLetter);
    } catch {
      setFormError(INTERVIEW_START_COPY.importFailed);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let alive = true;
    listInterviewSessions(analysisId)
      .then((rows) => { if (alive) setSessions(rows); })
      .catch(() => { if (alive) setError("지난 면접을 불러오지 못했어요."); });
    return () => { alive = false; };
  }, [authLoading, isAuthenticated, analysisId]);

  // 리포트의 '지난 면접 보기'로 들어오면 소개를 건너뛰고 목록을 보여 준다.
  useEffect(() => {
    if (analysisId && sessions) document.getElementById(HISTORY_ID)?.scrollIntoView({ block: "start" });
  }, [analysisId, sessions]);

  const closed = Boolean(summary && !summary.interviewEnabled);
  const noCredits = Boolean(summary && summary.interviewEnabled && summary.interviewRemaining === 0);
  const canBuy = Boolean(summary?.checkoutUrls?.interview || summary?.checkoutUrls?.interview3);
  const letterLength = coverLetter.trim().length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const draft = { company: company.trim(), jobRole: jobRole.trim(), coverLetter: coverLetter.trim() };
    if (!draft.company || !draft.jobRole) return setFormError(INTERVIEW_START_COPY.needCompany);
    if (draft.coverLetter.length < INTERVIEW_DIRECT_LIMITS.coverLetterMin) return setFormError(INTERVIEW_START_COPY.needLetter);
    setFormError(null);
    saveInterviewDirectDraft(draft);
    navigate(`/my/interview-practice/start?source=direct&mode=${mode}`);
  };

  const fieldLabel = "mb-1.5 block text-[13px] font-semibold text-ink-3";

  return (
    <div className="min-h-screen bg-stage pb-24 text-ink">
      <SiteHeader variant="light" />
      <InterviewPracticeIntroSection variant="page" />

      <main className="container max-w-3xl">
        <section className="pt-14" aria-labelledby="interview-steps-heading">
          <h2 id="interview-steps-heading" className="text-[22px] font-bold tracking-[-0.03em]">{INTERVIEW_START_COPY.stepsHeading}</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {INTERVIEW_START_COPY.steps.map((step, index) => (
              <li key={step.title} className="rounded-2xl bg-surface px-5 py-5">
                <span className="text-[13px] font-bold text-brand-ink">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-1.5 text-[16px] font-bold">{step.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-4 text-pretty">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id={INTERVIEW_START_FORM_ID} className="scroll-mt-24 pt-14" aria-labelledby="interview-start-heading">
          <h2 id="interview-start-heading" className="text-[22px] font-bold tracking-[-0.03em]">{INTERVIEW_START_COPY.formHeading}</h2>
          <p className="mt-1.5 text-[15px] text-ink-4 text-pretty">{INTERVIEW_START_COPY.formHint}</p>

          <form onSubmit={submit} className="mt-5 space-y-5 rounded-3xl bg-surface px-5 py-6 md:px-8 md:py-8">
            {applications.length > 0 && (
              <div>
                <label htmlFor="interview-application" className={fieldLabel}>{INTERVIEW_START_COPY.importLabel}</label>
                <div className="flex items-center gap-2">
                  <select
                    id="interview-application"
                    value={pickedApplication}
                    onChange={(event) => void importApplication(event.target.value)}
                    disabled={importing}
                    className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink focus:border-brand focus:outline-none disabled:opacity-60"
                  >
                    <option value="">{INTERVIEW_START_COPY.importPlaceholder}</option>
                    {applications.map((application) => (
                      <option key={application.id} value={application.id}>
                        {[application.company_name, application.job_role].filter(Boolean).join(" · ") || application.title}
                      </option>
                    ))}
                  </select>
                  {importing && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-ink-4" aria-hidden="true" />}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-4">{INTERVIEW_START_COPY.importHint}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={fieldLabel}>회사</label>
                <CompanyCombobox compact ariaLabel="회사" value={company} onChange={(value) => setCompany(value.slice(0, INTERVIEW_DIRECT_LIMITS.companyMax))} placeholder="예: CJ제일제당" />
              </div>
              <div>
                <label className={fieldLabel}>직무</label>
                <JobRoleCombobox compact ariaLabel="직무" value={jobRole} onChange={(value) => setJobRole(value.slice(0, INTERVIEW_DIRECT_LIMITS.jobRoleMax))} placeholder="예: 마케팅" />
              </div>
            </div>

            <div>
              <label htmlFor="interview-cover-letter" className={fieldLabel}>자기소개서</label>
              <textarea
                id="interview-cover-letter"
                value={coverLetter}
                onChange={(event) => setCoverLetter(event.target.value.slice(0, INTERVIEW_DIRECT_LIMITS.coverLetterMax))}
                placeholder={INTERVIEW_START_COPY.letterPlaceholder}
                className="min-h-[220px] w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-[1.75] text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none"
              />
              <p className="mt-1 text-right text-[12.5px] tabular-nums text-ink-4">
                {letterLength.toLocaleString()} / {INTERVIEW_DIRECT_LIMITS.coverLetterMax.toLocaleString()}자 · 200자 이상
              </p>
            </div>

            <fieldset>
              <legend className={fieldLabel}>길이</legend>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {(["FULL", "SHORT"] as const).map((value) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-xl border px-4 py-3.5 transition-colors ${mode === value ? "border-brand bg-brand-soft" : "border-line hover:bg-fill-soft"}`}
                  >
                    <input type="radio" name="interview-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
                    <span className="block text-[15px] font-bold">{INTERVIEW_MODE_COPY[value].label}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-4">{INTERVIEW_START_COPY.modeHint[value]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {formError && <p role="alert" className="text-[14px] font-semibold text-danger">{formError}</p>}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={closed || noCredits}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-[15px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                <span>면접 시작하기</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="text-[13px] text-ink-4">
                {closed
                  ? INTERVIEW_CARD_COPY.disabled
                  : noCredits
                    ? INTERVIEW_CARD_COPY.none
                    : summary
                      ? INTERVIEW_CARD_COPY.remaining(summary.interviewRemaining)
                      : !authLoading && !isAuthenticated
                        ? INTERVIEW_START_COPY.loginHint
                        : null}
              </p>
              {noCredits && canBuy && (
                <Link href="/entitlements#interview" className="text-[14px] font-semibold text-brand-ink underline-offset-4 hover:underline">
                  {INTERVIEW_CARD_COPY.buy}
                </Link>
              )}
            </div>
            <p className="text-[13px] leading-relaxed text-ink-4">
              {INTERVIEW_START_COPY.reportHint}{" "}
              <Link href="/my" className="font-semibold text-ink-3 underline underline-offset-2">내 리포트 보기</Link>
            </p>
          </form>
        </section>

        {isAuthenticated && (
          <section id={HISTORY_ID} className="scroll-mt-24 pt-14" aria-labelledby="interview-history-heading" aria-live="polite">
            <h2 id="interview-history-heading" className="text-[22px] font-bold tracking-[-0.03em]">지난 면접</h2>
            <p className="mt-1.5 text-[15px] text-ink-4">지난 면접의 피드백과 대화 글을 다시 볼 수 있어요.</p>
            <div className="mt-5">
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
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
