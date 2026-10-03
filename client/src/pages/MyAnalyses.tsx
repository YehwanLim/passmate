import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Building2, Briefcase } from "lucide-react";
import type { AnalysisSummary } from "@/types/my";
import AnalysisCard from "@/components/my/AnalysisCard";
import ApplicationEditor from "@/components/my/ApplicationEditor";
import SkeletonCard from "@/components/my/SkeletonCard";
import SiteHeader from "@/components/SiteHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";
import { getAuthorizationHeader } from "@/lib/apiAuth";
import { parseAnalysisSections } from "@/lib/analysisSections";
import { analysisPendingPath } from "@/lib/analysisRequest";
import { resolveIdempotencyKey, submitAnalysisRequest, type IdempotentRequest } from "@/lib/analysisSubmit";
import {
  WorkspaceApiError,
  daysUntil,
  fetchApplication,
  saveApplicationQuestions,
  type ApplicationDetail,
  type ApplicationQuestionDraft,
} from "@/lib/workspace";
import { getAnalyzeErrorMessage, getAnalyzeErrorTitle } from "./analyzeErrors";
import { WORKSPACE_COPY } from "./workspaceCopy";

const MAX_QUESTIONS = 5;
const MAX_PROMPT_CHARS = 300;

function deadlineLabel(deadline: string | null): string {
  const days = daysUntil(deadline);
  if (days === null) return WORKSPACE_COPY.deadlineNone;
  if (days < 0) return WORKSPACE_COPY.deadlinePassed;
  if (days === 0) return WORKSPACE_COPY.deadlineToday;
  return WORKSPACE_COPY.deadlineDays(days);
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

        let drafts: ApplicationQuestionDraft[] = application.questions.map((q) => ({
          prompt: q.prompt,
          charLimit: q.char_limit,
          answer: q.answer,
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

  const save = useCallback(
    async (value: ApplicationQuestionDraft[]) => {
      const result = await saveApplicationQuestions(projectId, value, baseUpdatedAt.current);
      baseUpdatedAt.current = result.questions_updated_at;
      setSeeded(false);
    },
    [projectId]
  );

  // 미리채움은 서버에 아직 없는 값이라 빈 배열을 기준선으로 줘서 바로 저장되게 한다.
  const autosave = useDraftAutosave({
    value: questions,
    save,
    enabled: loaded,
    baseline: seeded ? [] : undefined,
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

  const updateQuestion = (index: number, patch: Partial<ApplicationQuestionDraft>) => {
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...patch } : q)));
    if (seeded) setSeeded(false);
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
              </div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">{detail.title}</h1>
            </header>

            {seeded && <p className="text-[13px] text-zinc-400">{WORKSPACE_COPY.seeded}</p>}

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
                setSeeded(false);
              }}
              saveState={autosave.state}
            />

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
