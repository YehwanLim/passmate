import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Building2, Briefcase } from "lucide-react";
import type { AnalysisSummary } from "@/types/my";
import AnalysisCard from "@/components/my/AnalysisCard";
import JobPostingSection, { getJobPostingTitle } from "@/components/analyze/JobPostingSection";
import ApplicationEditor, { type DraftUiState } from "@/components/my/ApplicationEditor";
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
  daysUntil,
  fetchApplication,
  listExperiences,
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

const metaField = "w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm text-zinc-100";

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
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-3">
      <label className="block space-y-1 text-[13px] text-zinc-400">
        <span>{labels.company}</span>
        <input aria-label={labels.company} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={100} className={metaField} />
      </label>
      <label className="block space-y-1 text-[13px] text-zinc-400">
        <span>{labels.job}</span>
        <input aria-label={labels.job} value={jobKeyword} onChange={(e) => setJobKeyword(e.target.value)} maxLength={100} className={metaField} />
      </label>
      <label className="block space-y-1 text-[13px] text-zinc-400">
        <span>{labels.deadline}</span>
        <input aria-label={labels.deadline} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={metaField} />
      </label>
      <div className="flex items-center justify-end gap-2 sm:col-span-3">
        {error && <p role="alert" className="mr-auto text-[13px] text-red-400">{error}</p>}
        <button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-sm text-zinc-400">{WORKSPACE_COPY.meta.cancel}</button>
        <button type="submit" disabled={busy} className="h-9 rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-50">
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
        const stored = readBackup(`${BACKUP_PREFIX}${projectId}`);
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

  // 미리채움도 불러온 값 그대로를 기준선으로 삼는다. 사용자가 고치기 전에는 DB 에 쓰지 않는다.
  const autosave = useDraftAutosave({
    value: questions,
    save,
    enabled: loaded,
    isConflict: (error) => error instanceof WorkspaceApiError && error.code === "STALE_DRAFT",
  });

  // 화면을 떠날 때 디바운스 중이던 마지막 입력을 내보낸다(훅 정리 단계는 타이머만 지운다).
  // 불러오기 전에는 기준선이 없어 빈 값을 덮어쓸 수 있으므로 loaded 일 때만.
  const flushRef = useRef(autosave.flush);
  flushRef.current = autosave.flush;
  const loadedRef = useRef(false);
  loadedRef.current = loaded;
  useEffect(
    () => () => {
      if (loadedRef.current) void flushRef.current();
    },
    []
  );

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

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28">
      <SiteHeader />
      <div className="container space-y-6 pt-10">
        {loadError ? (
          <p role="alert" className="py-10 text-center text-sm text-red-400">
            {loadError}
          </p>
        ) : !detail || !loaded ? (
          <SkeletonCard variant="analysis" />
        ) : (
          <>
            <header className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500">
                {detail.company_name && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {detail.company_name}
                  </span>
                )}
                {detail.job_role && (
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    {detail.job_role}
                  </span>
                )}
                <span className="text-zinc-400">{deadlineLabel(detail.deadline)}</span>
                {!editingMeta && (
                  <button type="button" onClick={() => setEditingMeta(true)} className="text-zinc-400 underline underline-offset-4 hover:text-zinc-200">
                    {WORKSPACE_COPY.meta.edit}
                  </button>
                )}
              </div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">{detail.title}</h1>
            </header>

            {editingMeta && (
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
            )}

            <details className="rounded-xl border border-white/[0.06] px-4 py-3">
              <summary className="cursor-pointer text-[13px] text-zinc-300">
                {posting ? WORKSPACE_COPY.draft.postingAttached(getJobPostingTitle(posting)) : WORKSPACE_COPY.draft.attachPosting}
              </summary>
              <div className="pt-3">
                <JobPostingSection
                  value={posting}
                  onChange={changePosting}
                  isAuthenticated
                  onRequireLogin={() => navigate("/login")}
                />
                {postingError && (
                  <p role="alert" className="pt-2 text-[13px] text-red-400">
                    {WORKSPACE_COPY.meta.failed}
                  </p>
                )}
              </div>
            </details>

            {seeded && <p className="text-[13px] text-zinc-400">{WORKSPACE_COPY.seeded}</p>}

            {backup && (
              <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/5 px-4 py-3 text-[13px] text-zinc-300">
                <span>{WORKSPACE_COPY.backup.notice}</span>
                <div className="ml-auto flex gap-2">
                  <button type="button" onClick={dismissBackup} className="h-9 rounded-lg px-3 text-[13px] text-zinc-400 hover:text-zinc-200">
                    {WORKSPACE_COPY.backup.dismiss}
                  </button>
                  <button type="button" onClick={restoreBackup} className="h-9 rounded-lg bg-white px-3 text-[13px] font-semibold text-black">
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
              saveState={autosave.state}
              draft={draft}
              onRequestDraft={(index, opts) => void requestDraft(index, opts)}
              onApplyDraft={applyDraft}
              onCloseDraft={() => setDraft(null)}
              experienceTitles={experienceTitles}
              experienceCount={experienceCount}
              draftLimitReached={draftLimitReached}
            />
            {autosave.state === "error" && (
              <div className="-mt-3 flex justify-end">
                <button type="button" onClick={() => void autosave.flush()} className="text-[13px] font-medium text-zinc-300 underline underline-offset-4 hover:text-zinc-100">
                  {WORKSPACE_COPY.save.retry}
                </button>
              </div>
            )}

            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={diagnose}
                disabled={submitting}
                className="h-11 rounded-xl bg-white px-5 text-sm font-semibold text-black transition-opacity disabled:opacity-50"
              >
                {WORKSPACE_COPY.diagnose}
              </button>
              {submitError && (
                <p role="alert" className="text-[13px] text-red-400">
                  {submitError.title} · {submitError.message}
                </p>
              )}
            </div>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-300">{WORKSPACE_COPY.history}</h2>
              {historyFailed ? (
                <p role="alert" className="text-[13px] text-red-400">{WORKSPACE_COPY.historyError}</p>
              ) : analyses.length === 0 ? (
                <p className="text-[13px] text-zinc-500">{WORKSPACE_COPY.historyEmpty}</p>
              ) : (
                <div className="grid gap-3">
                  {analyses.map((analysis) => (
                    <AnalysisCard key={analysis.id} analysis={analysis} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
