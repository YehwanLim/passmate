import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowRight, Building2, Briefcase, ChevronLeft, Lock } from "lucide-react";
import type { AnalysisSummary } from "@/types/my";
import AnalysisCard from "@/components/my/AnalysisCard";
import CompanyCombobox from "@/components/analyze/CompanyCombobox";
import JobPostingSection from "@/components/analyze/JobPostingSection";
import JobRoleCombobox from "@/components/analyze/JobRoleCombobox";
import ApplicationEditor, { saveLabel, type DraftUiState } from "@/components/my/ApplicationEditor";
import SkeletonCard from "@/components/my/SkeletonCard";
import SiteHeader from "@/components/SiteHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";
import { getAuthorizationHeader } from "@/lib/apiAuth";
import { parseAnalysisSections } from "@/lib/analysisSections";
import { analysisPendingPath } from "@/lib/analysisRequest";
import { resolveIdempotencyKey, submitAnalysisRequest, type IdempotentRequest } from "@/lib/analysisSubmit";
import { requestExperienceDraft } from "@/lib/experienceDraft";
import {
  WorkspaceApiError,
  countChars,
  createApplication,
  daysUntil,
  fetchApplication,
  listExperiences,
  monthDay,
  saveApplicationQuestions,
  updateApplicationMeta,
  type ApplicationDetail,
  type ApplicationMeta,
  type ApplicationQuestionDraft,
} from "@/lib/workspace";
import { getAnalyzeErrorMessage, getAnalyzeErrorTitle } from "./analyzeErrors";
import type { JobPostingRecord } from "@/types/jobPosting";
import { WORKSPACE_COPY } from "./workspaceCopy";

const MAX_QUESTIONS = 5;
const MAX_PROMPT_CHARS = 300;
// 이 기기 임시 보관. passmate_ 접두사라 로그아웃 때 clearPassMateStorage 가 같이 지운다.
const BACKUP_PREFIX = "passmate_workspace_draft_";

function isDraftList(value: unknown): value is ApplicationQuestionDraft[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_QUESTIONS &&
    value.every((item: unknown) => {
      if (typeof item !== "object" || item === null) return false;
      const q = item as Record<string, unknown>;
      return typeof q.prompt === "string" && typeof q.answer === "string" && (q.charLimit === null || typeof q.charLimit === "number");
    })
  );
}

// 초안 경험은 있을 때만 싣는다. 초안을 안 쓴 문항은 저장·보관 모양이 예전과 같아 보관본 비교가 흔들리지 않는다.
function withDraftExperiences(ids: unknown): { draftExperienceIds?: string[] } {
  return Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === "string")
    ? { draftExperienceIds: ids }
    : {};
}

// 저장소는 사생활 보호 모드 등에서 없거나 예외를 던질 수 있다. 그때는 서버 자동 저장만 한다.
function readBackup(key: string): ApplicationQuestionDraft[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraftList(parsed)
      ? parsed.map(({ prompt, charLimit, answer, draftExperienceIds }) => ({
          prompt,
          charLimit,
          answer,
          ...withDraftExperiences(draftExperienceIds),
        }))
      : null;
  } catch {
    return null;
  }
}

function writeBackup(key: string, value: ApplicationQuestionDraft[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 보관하지 못해도 화면은 그대로 쓴다.
  }
}

function clearBackup(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 지우지 못해도 다음 불러오기에서 서버 내용과 비교해 다시 정리한다.
  }
}

function reportPath(analysisId: string): string {
  return `/report-new?analysisId=${encodeURIComponent(analysisId)}`;
}

function deadlineLabel(deadline: string | null): string {
  const days = daysUntil(deadline);
  if (days === null) return WORKSPACE_COPY.deadlineNone;
  if (days < 0) return WORKSPACE_COPY.deadlinePassed;
  if (days === 0) return WORKSPACE_COPY.deadlineToday;
  return WORKSPACE_COPY.deadlineDays(days);
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// <input type="date"> 값(YYYY-MM-DD)은 한국 날짜로 맞춘다. 마감은 그날 23:59 KST 로 저장한다.
function toKstDateInput(deadline: string | null): string {
  if (!deadline) return "";
  const time = new Date(deadline).getTime();
  return Number.isNaN(time) ? "" : new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
}

const metaField = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink focus:border-brand focus:outline-none";

function ApplicationMetaForm({
  projectId,
  detail,
  onSaved,
  onCancel,
}: {
  projectId: string;
  detail: ApplicationDetail;
  onSaved: (meta: ApplicationMeta) => void;
  onCancel: () => void;
}) {
  const labels = WORKSPACE_COPY.newApplicationForm;
  const [company, setCompany] = useState(detail.company_name ?? "");
  const [jobKeyword, setJobKeyword] = useState(detail.job_role ?? "");
  const [deadline, setDeadline] = useState(toKstDateInput(detail.deadline));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!company.trim()) {
      setError(labels.companyRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await updateApplicationMeta(projectId, {
          company: company.trim(),
          jobKeyword: jobKeyword.trim() || null,
          deadline: deadline ? `${deadline}T23:59:00+09:00` : null,
        })
      );
    } catch {
      setError(WORKSPACE_COPY.meta.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3">
      <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
        <span>{labels.company}</span>
        <CompanyCombobox compact ariaLabel={labels.company} value={company} onChange={setCompany} placeholder={labels.companyPlaceholder} />
      </label>
      <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
        <span>{labels.job}</span>
        <JobRoleCombobox compact ariaLabel={labels.job} value={jobKeyword} onChange={setJobKeyword} placeholder={labels.jobPlaceholder} />
      </label>
      <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
        <span>{labels.deadline}</span>
        <input aria-label={labels.deadline} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={metaField} />
      </label>
      <div className="flex items-center justify-end gap-2">
        {error && <p role="alert" className="mr-auto text-[13px] text-danger">{error}</p>}
        <button type="button" onClick={onCancel} className="h-10 rounded-[10px] px-4 text-[14px] font-semibold text-ink-3 hover:bg-fill">{WORKSPACE_COPY.meta.cancel}</button>
        <button type="submit" disabled={busy} className="h-10 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-white hover:bg-brand-hover disabled:opacity-50">
          {WORKSPACE_COPY.meta.save}
        </button>
      </div>
    </form>
  );
}

// 지원서가 바뀌면 자동 저장 기준선·멱등성 키까지 새로 시작하도록 projectId 로 인스턴스를 가른다.
export default function MyAnalyses() {
  const { projectId } = useParams<{ projectId: string }>();
  return <ApplicationWorkspace key={projectId} projectId={projectId} />;
}

function ApplicationWorkspace({ projectId }: { projectId: string }) {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useRequireAuth(); // 미인증 시 /login 리다이렉트

  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [questions, setQuestions] = useState<ApplicationQuestionDraft[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [seeded, setSeeded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [submitError, setSubmitError] = useState<{ title: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [backup, setBackup] = useState<ApplicationQuestionDraft[] | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [experienceTitles, setExperienceTitles] = useState<Map<string, string>>(new Map());
  const [experienceCount, setExperienceCount] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftUiState>(null);
  const [draftLimitReached, setDraftLimitReached] = useState(false);
  const [posting, setPosting] = useState<JobPostingRecord | null>(null);
  const [postingError, setPostingError] = useState(false);
  const draftSeq = useRef(0);
  const backupKey = `${BACKUP_PREFIX}${projectId}`;
  const baseUpdatedAt = useRef<string | null>(null);
  const analysisRequestRef = useRef<IdempotentRequest | null>(null);

  useEffect(() => {
    if (authLoading || !user?.id || !projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthorizationHeader();
        const [application, analysesRes] = await Promise.all([
          fetchApplication(projectId),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/analyses`, { headers }),
        ]);
        if (cancelled) return;
        setDetail(application);
        if (analysesRes.ok) {
          setAnalyses(await analysesRes.json());
        } else {
          setHistoryFailed(true);
        }
        baseUpdatedAt.current = application.questions_updated_at;

        setPosting(
          application.job_posting
            ? {
                id: application.job_posting.job_posting_id,
                sourceUrl: application.job_posting.source_url,
                summary: application.job_posting.summary,
              }
            : null
        );

        let drafts: ApplicationQuestionDraft[] = application.questions.map((q) => ({
          prompt: q.prompt,
          charLimit: q.char_limit,
          answer: q.answer,
          ...withDraftExperiences(q.draft_experience_ids),
        }));
        let fromAnalysis = false;
        // 작업실 이전 지원서: 문항 초안이 없으면 최신 진단의 문항·답변으로 미리 채운다(저장 전까지 DB 에 쓰지 않음).
        if (drafts.length === 0 && application.latest_analysis_id) {
          const res = await fetch(`/api/analysis/${encodeURIComponent(application.latest_analysis_id)}`, { headers });
          if (res.ok) {
            const analysis = await res.json();
            drafts = parseAnalysisSections(analysis.question_text, analysis.input_text)
              .slice(0, MAX_QUESTIONS)
              .map((s) => ({ prompt: s.question.slice(0, MAX_PROMPT_CHARS), charLimit: null, answer: s.answer }));
            fromAnalysis = drafts.length > 0;
          }
        }
        if (cancelled) return;
        if (drafts.length === 0) drafts = [{ prompt: "", charLimit: null, answer: "" }];
        // 지난번에 저장하지 못한 내용이 이 기기에 남아 있으면 불러올지 묻는다. 서버와 같으면 묻지 않는다.
        // 분석이 끝나 잠긴 지원서는 고칠 수 없으니 묻지 않는다.
        const stored = application.analyzed_report ? null : readBackup(`${BACKUP_PREFIX}${projectId}`);
        setBackup(stored && JSON.stringify(stored) !== JSON.stringify(drafts) ? stored : null);
        setSeeded(fromAnalysis);
        setQuestions(drafts);
        setLoaded(true);
      } catch {
        if (!cancelled) setLoadError(WORKSPACE_COPY.loadError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, projectId, user?.id]);

  // 초안 버튼용 경험 목록. 실패해도 작업실은 그대로 쓰고, 경험 유무는 서버(422)가 판단한다.
  useEffect(() => {
    if (authLoading || !user?.id) return;
    let cancelled = false;
    listExperiences()
      .then((list) => {
        if (cancelled) return;
        setExperienceTitles(new Map(list.map((e) => [e.id, e.title])));
        setExperienceCount(list.length);
      })
      .catch(() => {
        if (!cancelled) setExperienceCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  const save = useCallback(
    async (value: ApplicationQuestionDraft[]) => {
      const result = await saveApplicationQuestions(projectId, value, baseUpdatedAt.current);
      baseUpdatedAt.current = result.questions_updated_at;
      setSeeded(false);
    },
    [projectId]
  );

  // 분석이 성공한 지원서는 글을 잠근다. 더 고치려면 "수정하기"로 글을 복사한 새 지원서를 만든다.
  const analyzedReport = detail?.analyzed_report ?? null;
  const locked = analyzedReport !== null;

  // 미리채움도 불러온 값 그대로를 기준선으로 삼는다. 사용자가 고치기 전에는 DB 에 쓰지 않는다.
  const autosave = useDraftAutosave({
    value: questions,
    save,
    enabled: loaded && !locked,
    isConflict: (error) => error instanceof WorkspaceApiError && error.code === "STALE_DRAFT",
  });

  // 화면을 떠날 때 디바운스 중이던 마지막 입력을 내보낸다(훅 정리 단계는 타이머만 지운다).
  // 불러오기 전에는 기준선이 없어 빈 값을 덮어쓸 수 있으므로 loaded 일 때만.
  const flushRef = useRef(autosave.flush);
  flushRef.current = autosave.flush;
  const loadedRef = useRef(false);
  loadedRef.current = loaded && !locked;
  useEffect(
    () => () => {
      if (loadedRef.current) void flushRef.current();
    },
    []
  );

  const [copying, setCopying] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  // 잠긴 글을 그대로 복사한 새 지원서를 만들고 그쪽 작성 화면으로 간다. 공고는 붙이기만 하고 실패해도 넘어간다.
  const editAsNew = async () => {
    if (!detail || copying) return;
    setCopying(true);
    setCopyFailed(false);
    try {
      const { id } = await createApplication({
        company: detail.company_name || detail.title,
        ...(detail.job_role ? { jobKeyword: detail.job_role } : {}),
        deadline: detail.deadline,
        questions: questions.map(({ prompt, charLimit, answer }) => ({ prompt, charLimit, answer })),
      });
      if (posting) await updateApplicationMeta(id, { jobPostingId: posting.id }).catch(() => undefined);
      navigate(`/my/${id}`);
    } catch {
      setCopyFailed(true);
      setCopying(false);
    }
  };

  // 저장되지 않은 동안(대기·저장 중·실패·충돌)은 이 기기에 보관하고, 서버와 맞으면 지운다.
  // 남은 보관본을 사용자가 고르기 전에는 덮어쓰거나 지우지 않는다.
  useEffect(() => {
    if (!loaded || backup) return;
    if (autosave.state === "saved" || autosave.state === "idle") clearBackup(backupKey);
    else writeBackup(backupKey, questions);
  }, [loaded, backup, autosave.state, questions, backupKey]);

  const restoreBackup = () => {
    if (!backup) return;
    // 고친 내용처럼 에디터에 넣으면 평소 자동 저장이 지금 불러온 기준 시각으로 저장한다.
    setQuestions(backup);
    setActiveIndex(0);
    setSeeded(false);
    setBackup(null);
  };

  const dismissBackup = () => {
    clearBackup(backupKey);
    setBackup(null);
  };

  const updateQuestion = (index: number, patch: Partial<ApplicationQuestionDraft>) => {
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...patch } : q)));
    if (seeded) setSeeded(false);
  };

  const requestDraft = async (index: number, opts?: { retry: boolean }) => {
    const q = questions[index];
    if (!q || q.prompt.trim().length === 0) return;
    // "다른 경험으로 다시"는 방금 고른 경험을 피한다.
    const previous =
      opts?.retry && draft?.index === index && draft.status === "done" && draft.result.kind === "ok"
        ? draft.result.chosen.map((c) => c.experienceId)
        : [];
    const seq = ++draftSeq.current;
    setDraft({ index, status: "loading" });
    const result = await requestExperienceDraft({
      projectId,
      prompt: q.prompt.trim(),
      charLimit: q.charLimit,
      avoidExperienceIds: previous,
    });
    if (result.kind === "rate_limited" || (result.kind === "ok" && result.remainingToday === 0)) {
      setDraftLimitReached(true);
    }
    // 기다리는 동안 다른 문항에서 새로 요청했으면 늦게 온 결과는 버린다.
    if (seq === draftSeq.current) setDraft({ index, status: "done", result });
  };

  const applyDraft = (index: number) => {
    if (!draft || draft.index !== index || draft.status !== "done" || draft.result.kind !== "ok") return;
    updateQuestion(index, {
      answer: draft.result.draftText,
      draftExperienceIds: draft.result.chosen.map((c) => c.experienceId),
    });
    setDraft(null);
  };

  const changePosting = (record: JobPostingRecord | null) => {
    const before = posting;
    setPosting(record);
    setPostingError(false);
    updateApplicationMeta(projectId, { jobPostingId: record?.id ?? null }).catch(() => {
      setPosting(before);
      setPostingError(true);
    });
  };

  const diagnose = async () => {
    if (!detail || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await autosave.flush();
      const payload = {
        projectId,
        questions: questions.map((q, i) => ({ question: q.prompt.trim() || WORKSPACE_COPY.questionLabel(i + 1), answer: q.answer })),
        ...(detail.company_name ? { company: detail.company_name } : {}),
        ...(detail.job_role ? { jobKeyword: detail.job_role } : {}),
      };
      const request = resolveIdempotencyKey(analysisRequestRef.current, JSON.stringify(payload));
      analysisRequestRef.current = request;
      const result = await submitAnalysisRequest("/api/analyze", payload, request.idempotencyKey);
      if (result.kind === "accepted") {
        analysisRequestRef.current = null;
        navigate(analysisPendingPath(result.receipt.analysisRequestId));
        return;
      }
      if (result.kind === "rejected") {
        setSubmitError({
          title: getAnalyzeErrorTitle(result.errorData, result.status),
          message: getAnalyzeErrorMessage(result.errorData),
        });
        return;
      }
      setSubmitError({ title: WORKSPACE_COPY.diagnoseFailed, message: getAnalyzeErrorMessage(null) });
    } finally {
      setSubmitting(false);
    }
  };

  // 목록은 최신순(api orderBy createdAt desc)이라 처음 만나는 성공 진단이 가장 최근 리포트다.
  const latestReportId = analyses.find((analysis) => analysis.status === "SUCCESS")?.id ?? null;

  const days = detail ? daysUntil(detail.deadline) : null;
  const saveText = saveLabel(autosave.state);
  const saveFailed = autosave.state === "error" || autosave.state === "conflict";

  return (
    <div className="min-h-screen bg-stage pb-28">
      <SiteHeader variant="light" />
      {loadError ? (
        <p role="alert" className="container py-10 text-center text-sm text-danger">
          {loadError}
        </p>
      ) : !detail || !loaded ? (
        <div className="container max-w-6xl pt-10">
          <SkeletonCard variant="analysis" />
        </div>
      ) : (
        <>
          {/* ════════ 편집기 위 막대: 돌아가기 · 지원서 이름 | 저장 상태 · 리포트 보기 · 분석받기 ════════ */}
          <div className="sticky top-14 z-30 border-b border-line bg-surface/95 backdrop-blur">
            <div className="container flex h-14 max-w-6xl items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/my")}
                  className="-ml-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1 text-[13.5px] font-semibold text-ink-3 hover:bg-fill"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{WORKSPACE_COPY.page.title}</span>
                </button>
                <h1 className="truncate text-[16px] font-bold tracking-[-0.02em] text-ink">{detail.title}</h1>
              </div>
              {locked ? (
                <button
                  type="button"
                  onClick={() => void editAsNew()}
                  disabled={copying}
                  className="h-9 shrink-0 rounded-[10px] border border-line bg-surface px-3.5 text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-fill-soft disabled:opacity-50"
                >
                  {copying ? WORKSPACE_COPY.locked.editing : WORKSPACE_COPY.locked.edit}
                </button>
              ) : (
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <span className={`hidden text-[12.5px] sm:inline ${saveFailed ? "text-danger" : "text-ink-4"}`} role={saveFailed ? "alert" : undefined} aria-live="polite">
                  {saveText}
                </span>
                {autosave.state === "error" && (
                  <button type="button" onClick={() => void autosave.flush()} className="text-[12.5px] font-semibold text-brand-ink underline-offset-4 hover:underline">
                    {WORKSPACE_COPY.save.retry}
                  </button>
                )}
                {latestReportId && (
                  <button
                    type="button"
                    onClick={() => navigate(reportPath(latestReportId))}
                    className="h-9 rounded-[10px] border border-line bg-surface px-3 text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-fill-soft"
                  >
                    {WORKSPACE_COPY.viewReport}
                  </button>
                )}
                <button
                  type="button"
                  onClick={diagnose}
                  disabled={submitting}
                  className="h-9 rounded-[10px] bg-brand px-3.5 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
                >
                  {WORKSPACE_COPY.diagnose}
                </button>
              </div>
              )}
            </div>
          </div>

          <div className="container max-w-6xl pt-6">
            {submitError && (
              <p role="alert" className="mb-4 rounded-[14px] bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
                {submitError.title} · {submitError.message}
              </p>
            )}
            {copyFailed && (
              <p role="alert" className="mb-4 rounded-[14px] bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
                {WORKSPACE_COPY.locked.editFailed}
              </p>
            )}

            {/* ════════ 왼쪽 원고지 | 오른쪽 지원 정보 · 채용공고 ════════ */}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-4">
                {analyzedReport ? (
                  <>
                    {/* 잠긴 지원서: 리포트가 화면의 주인공, 글은 읽기만 */}
                    <section className="rounded-[20px] bg-surface p-6 sm:p-7">
                      <p className="text-[13px] font-semibold text-ink-4">
                        {WORKSPACE_COPY.analyzedOn(monthDay(analyzedReport.analyzed_at) ?? "")}
                      </p>
                      <p className="mt-1.5 text-[19px] font-bold leading-[1.5] tracking-[-0.02em] text-ink break-keep sm:text-[21px]">
                        {analyzedReport.summary || WORKSPACE_COPY.locked.summaryFallback}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate(reportPath(analyzedReport.analysis_id))}
                        className="mt-5 inline-flex h-12 items-center gap-1.5 rounded-[12px] bg-brand px-5 text-[15px] font-bold text-white transition-colors hover:bg-brand-hover"
                      >
                        {WORKSPACE_COPY.viewReport}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </button>
                    </section>

                    <p className="flex items-start gap-1.5 px-1 text-[13px] leading-[1.6] text-ink-4">
                      <Lock className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
                      {WORKSPACE_COPY.locked.notice}
                    </p>

                    <section className="divide-y divide-line-soft rounded-[20px] bg-surface" data-testid="locked-questions">
                      {questions.map((q, i) => (
                        <article key={i} className="px-5 py-5 sm:px-7">
                          <p className="text-[13px] font-bold text-brand-ink">{WORKSPACE_COPY.questionLabel(i + 1)}</p>
                          {q.prompt.trim() && <h3 className="mt-1 text-[16px] font-semibold leading-[1.6] text-ink break-keep">{q.prompt}</h3>}
                          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.9] text-ink-2">
                            {q.answer.trim() ? q.answer : <span className="text-ink-5">{WORKSPACE_COPY.locked.emptyAnswer}</span>}
                          </p>
                          <p className="mt-3 text-[12.5px] text-ink-4">
                            {WORKSPACE_COPY.editor.charCount(countChars(q.answer).withSpaces, countChars(q.answer).withoutSpaces)}
                          </p>
                        </article>
                      ))}
                    </section>
                  </>
                ) : (
                <>
                {seeded && <p className="text-[14px] text-ink-3">{WORKSPACE_COPY.seeded}</p>}

                {backup && (
                  <div role="status" className="flex flex-wrap items-center gap-3 rounded-[20px] bg-blank-soft px-5 py-3.5 text-[14px] text-ink-2">
                    <span>{WORKSPACE_COPY.backup.notice}</span>
                    <div className="ml-auto flex gap-2">
                      <button type="button" onClick={dismissBackup} className="h-9 rounded-[10px] px-3 text-[13px] font-semibold text-ink-3 hover:bg-white/60">
                        {WORKSPACE_COPY.backup.dismiss}
                      </button>
                      <button type="button" onClick={restoreBackup} className="h-9 rounded-[10px] bg-ink px-3.5 text-[13px] font-semibold text-white hover:bg-ink-2">
                        {WORKSPACE_COPY.backup.restore}
                      </button>
                    </div>
                  </div>
                )}

                <ApplicationEditor
                  questions={questions}
                  activeIndex={Math.min(activeIndex, questions.length - 1)}
                  onSelect={setActiveIndex}
                  onChange={updateQuestion}
                  onAdd={() => {
                    setQuestions((current) => [...current, { prompt: "", charLimit: null, answer: "" }]);
                    setActiveIndex(questions.length);
                    setSeeded(false);
                  }}
                  onRemove={(index) => {
                    setQuestions((current) => current.filter((_, i) => i !== index));
                    setActiveIndex(0);
                    draftSeq.current += 1; // 문항 번호가 바뀌므로 진행 중인 초안 결과는 버린다
                    setDraft(null);
                    setSeeded(false);
                  }}
                  heading={
                    <p className="min-w-0 truncate text-[15px] font-bold text-brand-ink">
                      {[detail.company_name, detail.job_role].filter(Boolean).join(" ")}
                      <span className="ml-2 text-[13px] font-medium text-ink-4">{deadlineLabel(detail.deadline)}</span>
                    </p>
                  }
                  draft={draft}
                  onRequestDraft={(index, opts) => void requestDraft(index, opts)}
                  onApplyDraft={applyDraft}
                  onCloseDraft={() => setDraft(null)}
                  experienceTitles={experienceTitles}
                  experienceCount={experienceCount}
                  draftLimitReached={draftLimitReached}
                />
                </>
                )}

                {/* 잠긴 지원서는 위 카드가 리포트로 보내므로, 회차가 둘 이상일 때만 지난 진단을 보인다. */}
                {(!locked || analyses.length > 1) && (
                <section id="history" className="space-y-3 pt-4">
                  <h2 className="text-[17px] font-bold text-ink">
                    {WORKSPACE_COPY.history}
                    {analyses.length > 0 && <span className="ml-1.5 text-ink-5">{analyses.length}</span>}
                  </h2>
                  {historyFailed ? (
                    <p role="alert" className="text-[13px] text-danger">{WORKSPACE_COPY.historyError}</p>
                  ) : analyses.length === 0 ? (
                    <p className="text-[14px] text-ink-4">{WORKSPACE_COPY.historyEmpty}</p>
                  ) : (
                    <div className="grid gap-3">
                      {analyses.map((analysis) => (
                        <AnalysisCard
                          key={analysis.id}
                          analysis={analysis}
                          onViewReport={analysis.status === "SUCCESS" ? () => navigate(reportPath(analysis.id)) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </section>
                )}
              </div>

              {/* 오른쪽: 지원 정보 · 채용공고 (넓은 화면에서는 따라 내려온다) */}
              <aside className="space-y-4 lg:sticky lg:top-32">
                <section className="rounded-[18px] bg-surface p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-ink">{WORKSPACE_COPY.newApplicationForm.basicsTitle}</h2>
                    {!editingMeta && (
                      <button type="button" onClick={() => setEditingMeta(true)} className="text-[13px] font-semibold text-brand-ink underline-offset-4 hover:underline">
                        {WORKSPACE_COPY.meta.edit}
                      </button>
                    )}
                  </div>
                  {editingMeta ? (
                    <ApplicationMetaForm
                      projectId={projectId}
                      detail={detail}
                      onCancel={() => setEditingMeta(false)}
                      onSaved={(meta) => {
                        setDetail((current) =>
                          current
                            ? { ...current, title: meta.title, company_name: meta.company_name, job_role: meta.job_role, deadline: meta.deadline }
                            : current
                        );
                        setEditingMeta(false);
                      }}
                    />
                  ) : (
                    <dl className="mt-3 space-y-2.5 text-[14px]">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-ink-4"><Building2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{WORKSPACE_COPY.newApplicationForm.company}</dt>
                        <dd className="text-right font-semibold text-ink break-keep">{detail.company_name || "—"}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-ink-4"><Briefcase className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{WORKSPACE_COPY.newApplicationForm.job}</dt>
                        <dd className="text-right font-semibold text-ink break-keep">{detail.job_role || "—"}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-ink-4">{WORKSPACE_COPY.newApplicationForm.deadline}</dt>
                        <dd className={`text-right font-semibold ${days !== null && days >= 0 && days <= 3 ? "text-danger" : "text-ink"}`}>{deadlineLabel(detail.deadline)}</dd>
                      </div>
                    </dl>
                  )}
                </section>

                <section className="rounded-[18px] bg-surface p-5">
                  <JobPostingSection value={posting} onChange={changePosting} isAuthenticated onRequireLogin={() => navigate("/login")} tone="light" />
                  {postingError && (
                    <p role="alert" className="pt-2 text-[13px] text-danger">
                      {WORKSPACE_COPY.meta.failed}
                    </p>
                  )}
                </section>
              </aside>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
