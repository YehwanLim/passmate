import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Loader2,
  BarChart3,
  Info,
  AlertTriangle,
  History,
  FileUp,
} from "lucide-react";
import CompanyCombobox from "@/components/analyze/CompanyCombobox";
import JobRoleCombobox from "@/components/analyze/JobRoleCombobox";
import {
  ANALYZE_BIG_SUBMIT_BUTTON_CLASS,
  AnalyzeBottomBar,
  AnalyzeErrorModal,
  type AnalyzeErrorView,
} from "@/components/analyze/AnalyzeShell";
import SiteHeader from "@/components/SiteHeader";
import ApplicationEditor from "@/components/my/ApplicationEditor";
import PreviousResumePicker from "@/components/analyze/PreviousResumePicker";
import ImportPreviewDialog from "@/components/analyze/ImportPreviewDialog";
import AnalyzeLoadingOverlay from "@/components/analyze/AnalyzeLoadingOverlay";
import AnalyzeLoginModal from "@/components/analyze/AnalyzeLoginModal";
import JobPostingSection from "@/components/analyze/JobPostingSection";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { sanitizeText } from "@/utils/sanitize";
import { supabase } from "@/lib/supabase";
import { fetchEntitlementSummary } from "@/lib/entitlements";
import { deviceClass, sendFunnelEvent } from "@/lib/siteVisits";
import { RESUME_REPORT_SAMPLE_PATH } from "@/constants/resumeReportSampleMeta";
import { checkDuplicateQuestions } from "@/utils/textSimilarity";
import { UI_LABELS } from "@/constants/labels";
import {
  trackResumeUpload,
  trackAnalysisStart,
  trackAnalysisFailed,
  trackLoginPrompt,
} from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthorizationHeader } from "@/lib/apiAuth";
import { analysisPendingPath } from "@/lib/analysisRequest";
import {
  resolveIdempotencyKey,
  submitAnalysisRequest,
  type IdempotentRequest,
} from "@/lib/analysisSubmit";
import { readQueryParam } from "@/lib/readQueryParam";
import { saveAnalyzeDraft, takeAnalyzeDraft } from "@/lib/analyzeDraft";
import { useSubmitAfterLogin } from "@/hooks/useSubmitAfterLogin";
import {
  extractTextFromFile,
  requestAiSplit,
  splitResumeText,
  ResumeImportError,
  type ResumeImportPair,
} from "@/lib/resumeFileImport";
import type { ProjectSummary } from "@/types/my";
import type { ApplicationQuestionDraft } from "@/lib/workspace";
import type { JobPostingRecord } from "@/types/jobPosting";
import { getAnalyzeErrorMessage, getAnalyzeErrorTitle } from "./analyzeErrors";
import {
  MAX_QUESTIONS,
  MAX_TOTAL_CHARS,
  MIN_TOTAL_CHARS,
  WARN_TOTAL_CHARS,
} from "./analyzeConstants";
import {
  createEmptyQuestion,
  parseSavedQuestions,
  type QuestionItem,
  type SavedAnalysisDetail,
} from "./analyzeQuestions";

const EMPTY_TITLES = new Map<string, string>();

/**
 * 자소서 분석 페이지 (/analyze). 10-08 부터 마이페이지 지원서 작성 화면과 같은 편집기 틀이다.
 *
 * - 위 막대: 제목 + 이전 지원서 불러오기 · 자소서 파일 올리기
 * - 왼쪽: 문항 번호 탭 + 원고지(최대 5문항), 오른쪽: 지원 정보(회사·직무 자동완성) + 채용공고
 * - 하단 고정 막대: 총 글자 수 + 큰 "자소서 분석하기" 버튼. 로그인은 이 버튼을 누를 때만 받는다.
 */
export default function Analyze() {
  const [, navigate] = useLocation();
  // 폼은 로그인 없이 쓸 수 있다. 로그인은 크레딧을 쓰는 제출 순간에만 받는다(AnalyzeLoginModal).
  // 서버(/api/analyze)는 여전히 인증을 요구하므로 권한 경계는 그대로다.
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  // 카카오 로그인(전체 페이지 리다이렉트)에서 돌아온 경우 떠나기 전 저장한 초안이 있다. 마운트 때 한 번만 꺼낸다.
  const [draft] = useState(() => takeAnalyzeDraft());
  // /company-report 의 CTA 가 회사·직무를 쿼리로 넘긴다. 없으면 빈 값.
  const [company, setCompany] = useState(
    () => draft?.company ?? readQueryParam("company")
  );
  const [jobRole, setJobRole] = useState(
    () => draft?.jobRole ?? readQueryParam("jobKeyword")
  );
  const [questions, setQuestions] = useState<QuestionItem[]>(() =>
    draft && draft.questions.length > 0 ? draft.questions : [createEmptyQuestion()]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<AnalyzeErrorView | null>(null);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  // 선택 입력. 서버가 정리한 공고 요약 레코드만 들고 있다가 제출 시 id 만 보낸다.
  const [jobPosting, setJobPosting] = useState<JobPostingRecord | null>(
    () => draft?.jobPosting ?? null
  );
  // 모달 안에서(또는 다른 탭에서) 로그인되면 닫는다. "분석 시작"을 눌러서 모달이 떴던 경우에는
  // 아래 useSubmitAfterLogin 이 제출까지 이어 준다(이미 한 번 누른 의도를 잇는 것이라 크레딧은 그 클릭에 대한 것).
  useEffect(() => {
    if (isAuthenticated) setLoginPromptOpen(false);
  }, [isAuthenticated]);
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [isResumePickerOpen, setIsResumePickerOpen] = useState(false);
  const [previousResumes, setPreviousResumes] = useState<ProjectSummary[]>([]);
  const [isPreviousResumesLoading, setIsPreviousResumesLoading] =
    useState(false);
  const [previousResumeError, setPreviousResumeError] = useState<string | null>(
    null
  );
  const [isApplyingPreviousResume, setIsApplyingPreviousResume] = useState<
    string | null
  >(null);
  const [resumeLoaded, setResumeLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileImportStage, setFileImportStage] = useState<
    "extracting" | "splitting" | null
  >(null);
  const [importPreview, setImportPreview] = useState<ResumeImportPair[] | null>(
    null
  );
  const analysisRequestRef = useRef<IdempotentRequest | null>(null);
  // 무료 분석이 남았는지. 가입하고도 "이제 뭐 하지?"에서 멈추던 사람에게 바로 보이게 한다. null = 모름/표시 안 함.
  const [freeRemaining, setFreeRemaining] = useState<number | null>(null);
  // 위 막대 제목 옆의 작은 "남은 이용권 N회"(자소서 분석 크레딧 합계). 로그인 전·못 불러오면 null 이라 숨긴다.
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  // 폼에 처음 손댄 순간을 한 번만 남긴다(퍼널: 폼 도달 → 입력 시작 → 제출).
  const formStartSentRef = useRef(false);
  const markFormStart = useCallback((how: "typed" | "file") => {
    if (formStartSentRef.current) return;
    formStartSentRef.current = true;
    void sendFunnelEvent("analyze_form_start", how);
  }, []);
  // 폰에서 초안이 손에 없을 때 PC 로 옮겨 가라고 주소를 복사해 준다.
  const [isPhone] = useState(() => deviceClass() === "m");
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const summary = await fetchEntitlementSummary(token);
        if (!cancelled) {
          setFreeRemaining(summary.freeRemaining);
          setCreditsRemaining(summary.remaining);
        }
      } catch {
        // 잔여 표시는 편의 정보다. 실패해도 폼은 쓸 수 있고 서버가 최종 판단한다.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const copyAnalyzeLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/analyze`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      // 클립보드가 막힌 브라우저(일부 인앱)는 조용히 넘어간다. 주소창에서 복사할 수 있다.
    }
  };

  // ── 글자 수 계산 ──
  const totalChars = useMemo(
    () => questions.reduce((sum, q) => sum + q.answer.length, 0),
    [questions]
  );
  const isOverLimit = totalChars > MAX_TOTAL_CHARS;
  const isBelowMinimum = totalChars < MIN_TOTAL_CHARS;
  const hasContent = questions.some(q => q.answer.trim().length > 0);
  // Hard Block: 200자 미만 OR 6000자 초과 → 버튼 완전 비활성화
  const canSubmit = hasContent && !isBelowMinimum && !isOverLimit && !isLoading;

  // ── 문항 CRUD (6000자 Hard Block 포함) ──
  const handleUpdateQuestion = useCallback(
    (id: string, field: "question" | "answer", value: string) => {
      markFormStart("typed");
      setQuestions(prev => {
        if (field === "answer") {
          const otherChars = prev
            .filter(q => q.id !== id)
            .reduce((sum, q) => sum + q.answer.length, 0);
          if (otherChars + value.length > MAX_TOTAL_CHARS) {
            const allowed = MAX_TOTAL_CHARS - otherChars;
            value = value.slice(0, Math.max(0, allowed));
          }
        }
        return prev.map(q => (q.id === id ? { ...q, [field]: value } : q));
      });
    },
    [markFormStart]
  );

  const handleDeleteQuestion = useCallback(
    (id: string) => {
      if (questions.length <= 1) return;
      setQuestions(prev => prev.filter(q => q.id !== id));
    },
    [questions.length]
  );

  const handleAddQuestion = useCallback(() => {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions(prev => [...prev, createEmptyQuestion()]);
  }, [questions.length]);

  const openPreviousResumePicker = async () => {
    if (!user?.id) return;

    setIsResumePickerOpen(true);
    setIsPreviousResumesLoading(true);
    setPreviousResumeError(null);

    try {
      const response = await fetch("/api/projects", {
        headers: await getAuthorizationHeader(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const projects: ProjectSummary[] = await response.json();
      // 기업 분석 프로젝트는 자소서가 없어 불러올 것이 없다.
      setPreviousResumes(
        projects.filter(
          project => project.kind !== "COMPANY" && project.latest_analysis_id
        )
      );
    } catch {
      setPreviousResumeError(
        "저장된 지원서를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setIsPreviousResumesLoading(false);
    }
  };

  const applyPreviousResume = async (analysisId: string) => {
    setIsApplyingPreviousResume(analysisId);
    setPreviousResumeError(null);

    try {
      const response = await fetch(
        `/api/analysis/${encodeURIComponent(analysisId)}`,
        {
          headers: await getAuthorizationHeader(),
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const analysis: SavedAnalysisDetail = await response.json();
      const restoredQuestions = parseSavedQuestions(
        analysis.question_text,
        analysis.input_text
      )
        .slice(0, MAX_QUESTIONS)
        .map(question => ({ ...question, id: crypto.randomUUID() }));

      if (restoredQuestions.length === 0) {
        throw new Error("저장된 문항을 찾을 수 없습니다.");
      }

      setCompany(analysis.company_name?.trim() || "");
      setQuestions(restoredQuestions);
      setActiveIndex(0);
      setJobRole(analysis.job_role?.trim() || "");
      setIsResumePickerOpen(false);
      setResumeLoaded(true);
      setTimeout(() => setResumeLoaded(false), 4000);
    } catch {
      setPreviousResumeError(
        "지원서 내용을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setIsApplyingPreviousResume(null);
    }
  };

  // ── PDF/Word 파일 불러오기 ──
  const handleResumeFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 파일 재선택 허용
    if (!file || fileImportStage) return;
    markFormStart("file");

    try {
      setFileImportStage("extracting");
      const text = await extractTextFromFile(file);

      setFileImportStage("splitting");
      let pairs: ResumeImportPair[];
      try {
        pairs = await requestAiSplit(text);
      } catch {
        // AI 분리 실패(레이트리밋·서버 오류 등) 시 로컬 휴리스틱으로 폴백
        pairs = splitResumeText(text);
      }
      if (pairs.length === 0) {
        throw new ResumeImportError(
          "EMPTY_TEXT",
          "파일에서 글자를 찾지 못했어요. 스캔·이미지 PDF는 텍스트 추출이 되지 않아요."
        );
      }
      setImportPreview(pairs.slice(0, MAX_QUESTIONS));
    } catch (error) {
      setErrorModal({
        title: "파일 불러오기 실패",
        message:
          error instanceof ResumeImportError
            ? error.message
            : "파일을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setFileImportStage(null);
    }
  };

  const applyImportedPairs = () => {
    if (!importPreview) return;
    setQuestions(
      importPreview.map(pair => ({
        id: crypto.randomUUID(),
        question: pair.question,
        answer: pair.answer,
      }))
    );
    setImportPreview(null);
    setActiveIndex(0);
    setResumeLoaded(true);
    setTimeout(() => setResumeLoaded(false), 4000);
  };

  // ── 분석 제출 (모든 예외 처리 포함) ──
  const executeSubmit = async () => {
    setIsLoading(true);

    const jobLabel = jobRole.trim();

    // XSS Sanitize + 구조화
    const structuredQuestions = questions.map((q, i) => ({
      question: sanitizeText(q.question.trim()) || `문항 ${i + 1}`,
      answer: sanitizeText(q.answer),
    }));
    const requestPayload = {
      questions: structuredQuestions,
      company: sanitizeText(company.trim()) || undefined,
      jobKeyword: sanitizeText(jobLabel) || undefined,
      // 공고를 붙였을 때만 키를 넣는다. 없는데 undefined 로 보내면 서버 검증이 키 존재를 볼 수 있다.
      ...(jobPosting ? { jobPostingId: jobPosting.id } : {}),
    };
    // 같은 입력 재시도는 같은 키, 입력이 바뀌면 새 키.
    const request = resolveIdempotencyKey(analysisRequestRef.current, JSON.stringify(requestPayload));
    analysisRequestRef.current = request;

    // GA4: 자소서 입력 완료 + 분석 시작 이벤트
    trackResumeUpload("text", totalChars);
    trackAnalysisStart("cover_letter", totalChars);

    try {
      const result = await submitAnalysisRequest("/api/analyze", requestPayload, request.idempotencyKey);

      // 분석 접수 실패
      if (result.kind === "rejected") {
        const { errorData, status } = result as { errorData?: { error?: unknown }; status: number };
        if (getAnalyzeErrorTitle(errorData, status) === "요청 제한") {
          trackAnalysisFailed("cover_letter", "rate_limit");
          setErrorModal({
            title: "요청 제한",
            message: UI_LABELS.RATE_LIMIT_ERROR,
          });
          return;
        }
        if (errorData?.error === "CONTEXT_IRRELEVANT") {
          trackAnalysisFailed("cover_letter", "context_irrelevant");
          setErrorModal({
            title: "내용 확인 필요",
            message: UI_LABELS.CONTEXT_IRRELEVANT,
          });
          return;
        }
        if (errorData?.error === "ANALYSIS_CREDITS_EXHAUSTED") {
          trackAnalysisFailed("cover_letter", "credits_exhausted");
          setErrorModal({
            title: "이용권 소진",
            message: getAnalyzeErrorMessage(errorData),
            actionLabel: "이용권 확인하기",
            actionHref: "/entitlements#standard",
          });
          return;
        }
        if (errorData?.error === "ANALYSIS_CONCURRENCY_LIMITED") {
          trackAnalysisFailed("cover_letter", "analysis_concurrency_limited");
          setErrorModal({
            title: getAnalyzeErrorTitle(errorData, status),
            message: getAnalyzeErrorMessage(errorData),
          });
          return;
        }
        trackAnalysisFailed("cover_letter", "server_error");
        setErrorModal({
          title: getAnalyzeErrorTitle(errorData, status),
          message: getAnalyzeErrorMessage(errorData),
        });
        return;
      }

      if (result.kind === "parse_error") {
        trackAnalysisFailed("cover_letter", "parse_error");
        setErrorModal({
          title: "파싱 오류",
          message: UI_LABELS.JSON_PARSE_ERROR,
        });
        return;
      }

      if (result.kind === "auth_required") {
        trackAnalysisFailed("cover_letter", "auth_required");
        submitAfterLogin.arm();
        setLoginPromptOpen(true);
        return;
      }

      if (result.kind === "network_error") {
        trackAnalysisFailed("cover_letter", "server_error");
        setErrorModal({ title: "연결 불안정", message: UI_LABELS.NETWORK_ERROR });
        return;
      }

      analysisRequestRef.current = null;
      navigate(analysisPendingPath(result.receipt.analysisRequestId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      trackLoginPrompt("analyze_submit");
      submitAfterLogin.arm();
      setLoginPromptOpen(true);
      return;
    }
    if (!canSubmit) return;

    // 도배 방지: 유사도 체크 (문항 2개 이상일 때만)
    if (questions.filter(q => q.answer.trim()).length >= 2) {
      const duplicate = checkDuplicateQuestions(questions.map(q => q.answer));
      if (duplicate) {
        setErrorModal({
          title: "중복 감지",
          message: UI_LABELS.DUPLICATE_DETECTED,
        });
        return;
      }
    }

    // 200~1000자 구간: confirm 모달
    if (totalChars >= MIN_TOTAL_CHARS && totalChars < WARN_TOTAL_CHARS) {
      setConfirmModal({
        message: UI_LABELS.CHAR_MINIMUM_WARNING,
        onConfirm: () => {
          setConfirmModal(null);
          executeSubmit();
        },
      });
      return;
    }

    executeSubmit();
  };

  // 로그인 모달이 "분석 시작" 때문에 떴다면, 로그인이 끝나는 순간 제출을 대신 누른다.
  // 카카오는 페이지를 떠났다 오므로 초안의 submitOnReturn 으로 마운트 때부터 켠다. 훅 선언이 handleSubmit 뒤인 건 최신 클로저를 쓰기 위해서다.
  const submitAfterLogin = useSubmitAfterLogin({
    isAuthenticated,
    onSubmit: handleSubmit,
    initiallyArmed: draft?.submitOnReturn === true,
  });

  // 편집기(ApplicationEditor)는 { prompt, charLimit, answer } 모양을 쓴다. 이 화면의 문항은 id 를 가진 QuestionItem 이라 여기서 맞춘다.
  const editorQuestions = questions.map(q => ({ prompt: q.question, charLimit: q.charLimit ?? null, answer: q.answer }));
  const shownIndex = Math.min(activeIndex, questions.length - 1);
  const updateEditorQuestion = (index: number, patch: Partial<ApplicationQuestionDraft>) => {
    const target = questions[index];
    if (!target) return;
    if (patch.prompt !== undefined) handleUpdateQuestion(target.id, "question", patch.prompt);
    if (patch.answer !== undefined) handleUpdateQuestion(target.id, "answer", patch.answer);
    if (patch.charLimit !== undefined) {
      setQuestions(prev => prev.map(q => (q.id === target.id ? { ...q, charLimit: patch.charLimit } : q)));
    }
  };
  const headingText = [company.trim(), jobRole.trim()].filter(Boolean).join(" ");
  const toolButton =
    "inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-fill disabled:cursor-wait";
  const sideLabel = "block text-[12.5px] font-semibold text-ink-4 mb-1.5";

  return (
    <div className="min-h-screen bg-stage pb-36">
      <SiteHeader variant="light" />

      {/* 위 막대: 지원서 작성 화면(마이페이지)과 같은 자리. 불러오기 도구는 오른쪽에 둔다. */}
      <div className="sticky top-14 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="container flex h-14 max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-[16px] font-bold tracking-[-0.02em] text-ink">자소서 분석</h1>
            {creditsRemaining !== null && (
              <span className="shrink-0 text-[12px] text-ink-4">
                남은 이용권 <span className="font-semibold tabular-nums text-ink-3">{creditsRemaining}회</span>
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user?.id && (
              <button type="button" onClick={openPreviousResumePicker} className={toolButton}>
                <History className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">이전 지원서 불러오기</span>
                <span className="sm:hidden">불러오기</span>
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(fileImportStage)}
              onClick={() => fileInputRef.current?.click()}
              className={toolButton}
              title="PDF·Word(.docx) 파일만 올릴 수 있어요"
            >
              {fileImportStage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
                  {fileImportStage === "extracting" ? "파일 읽는 중..." : "문항 나누는 중..."}
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">자소서 파일 올리기</span>
                  <span className="sm:hidden">파일</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={handleResumeFileSelected}
              aria-label="자소서 PDF 또는 Word 파일 선택"
            />
          </div>
        </div>
      </div>

      <div className="container max-w-6xl pt-6">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* 왼쪽: 번호 탭 + 원고지 */}
          <div className="min-w-0">
            <ApplicationEditor
              questions={editorQuestions}
              activeIndex={shownIndex}
              onSelect={setActiveIndex}
              onChange={updateEditorQuestion}
              onAdd={() => {
                handleAddQuestion();
                setActiveIndex(questions.length);
              }}
              onRemove={index => {
                const target = questions[index];
                if (target) handleDeleteQuestion(target.id);
                setActiveIndex(0);
              }}
              heading={
                headingText ? <p className="min-w-0 truncate text-[15px] font-bold text-brand-ink">{headingText}</p> : undefined
              }
              showDraft={false}
              answerPlaceholder="여기에 답변을 작성해 주세요."
              draft={null}
              onRequestDraft={() => undefined}
              onApplyDraft={() => undefined}
              onCloseDraft={() => undefined}
              experienceTitles={EMPTY_TITLES}
              experienceCount={null}
              draftLimitReached={false}
            />
          </div>

          {/* 오른쪽: 지원 정보 · 채용공고 (넓은 화면에서는 따라 내려온다) */}
          <aside className="space-y-4 lg:sticky lg:top-32">
            <section className="space-y-3 rounded-[18px] bg-surface p-5">
              <h2 className="text-[15px] font-bold text-ink">지원 정보</h2>
              <div>
                <label className={sideLabel}>지원 회사</label>
                <CompanyCombobox compact ariaLabel="지원 회사" value={company} onChange={setCompany} placeholder="예: CJ제일제당" />
                {/* 회사를 고른 순간의 조용한 진입점. 크레딧 유무는 기업 분석 폼과 서버가 판단한다. */}
                {company.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const path = `/company-analysis?company=${encodeURIComponent(company.trim())}&jobKeyword=${encodeURIComponent(jobRole.trim())}`;
                      // 작성 중인 자소서를 잃지 않도록 새 탭으로 연다. 팝업이 막히면 같은 탭으로 이동한다.
                      // noopener 피처를 넘기면 window.open 이 항상 null 을 돌려줘 폴백이 매번 발동하므로,
                      // 반환값으로 차단 여부를 판별한 뒤 opener 를 손으로 끊는다.
                      const opened = window.open(path, "_blank");
                      if (opened) {
                        opened.opener = null;
                      } else {
                        navigate(path);
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-ink-4 transition-colors hover:text-brand"
                  >
                    {company.trim()} 기업 분석 리포트 먼저 받기
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div>
                <label className={sideLabel}>지원 직무</label>
                <JobRoleCombobox compact ariaLabel="지원 직무" value={jobRole} onChange={setJobRole} placeholder="예: 마케팅" />
              </div>
            </section>

            <section className="rounded-[18px] bg-surface p-5">
              <JobPostingSection
                value={jobPosting}
                onChange={setJobPosting}
                isAuthenticated={isAuthenticated}
                onRequireLogin={() => {
                  trackLoginPrompt("job_posting");
                  setLoginPromptOpen(true);
                }}
                tone="light"
              />
            </section>

            {/* 붙여넣을 초안이 지금 손에 없는 방문자용 출구. 폰이면 주소를 복사해 PC 에서 이어 하게 한다. */}
            <div className="space-y-1.5 px-1 text-[12.5px] text-ink-4">
              {freeRemaining !== null && freeRemaining > 0 && (
                <p className="text-[13px] font-semibold text-ink-2">무료 분석 {freeRemaining}회가 남아 있어요</p>
              )}
              <p>
                아직 자소서가 없다면{" "}
                <Link href={RESUME_REPORT_SAMPLE_PATH} className="text-ink-2 underline underline-offset-4 hover:text-ink">
                  예시 리포트 먼저 보기
                </Link>
                {" · "}
                <Link href="/my" className="text-ink-2 underline underline-offset-4 hover:text-ink">
                  내 경험으로 초안 쓰기
                </Link>
                {isPhone && (
                  <>
                    {" · "}
                    <button type="button" onClick={copyAnalyzeLink} className="text-ink-2 underline underline-offset-4 hover:text-ink">
                      {linkCopied ? "주소를 복사했어요" : "PC에서 이어 하게 주소 복사"}
                    </button>
                  </>
                )}
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* ════════ STICKY BOTTOM BAR ════════ */}
      <AnalyzeBottomBar wide>
        {/* 글자 수 경고 메시지 */}
        {isOverLimit && (
          <div className="flex items-center gap-2 pt-2.5 pb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
            <span className="text-xs text-danger">
              {UI_LABELS.CHAR_OVER_LIMIT}
            </span>
          </div>
        )}
        {isBelowMinimum && hasContent && !isOverLimit && (
          <div className="flex items-center gap-2 pt-2.5 pb-1">
            <Info className="w-3.5 h-3.5 text-ink-4 flex-shrink-0" />
            <span className="text-xs text-ink-4">
              최소 {MIN_TOTAL_CHARS}자 이상 입력해 주세요
            </span>
          </div>
        )}

        <div className="flex h-[84px] items-center justify-between gap-4">
          {/* 총 글자 수 */}
          <div className="flex min-w-0 items-center gap-2.5">
            <BarChart3
              className={`hidden h-4 w-4 flex-shrink-0 sm:block ${
                isOverLimit ? "text-danger" : "text-ink-4"
              }`}
            />
            <span
              className={`text-sm font-medium tabular-nums whitespace-nowrap ${
                isOverLimit ? "text-danger" : "text-ink-3"
              }`}
            >
              <span className="hidden sm:inline">총 글자 수: </span>
              <span
                className={`font-semibold ${
                  isOverLimit ? "text-danger" : "text-ink"
                }`}
              >
                {totalChars.toLocaleString()}
              </span>{" "}
              / {MAX_TOTAL_CHARS.toLocaleString()}자
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              // 로그인 뒤 자동 제출(useSubmitAfterLogin)은 handleSubmit 을 직접 부르므로 여기서만 센다 — 사람의 클릭 1번 = 1건.
              void sendFunnelEvent("analyze_submit_click", isAuthenticated ? "authed" : "anon");
              handleSubmit();
            }}
            disabled={!canSubmit}
            className={ANALYZE_BIG_SUBMIT_BUTTON_CLASS}
          >
            {isLoading ? (
              <span className="inline-flex items-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                분석 중...
              </span>
            ) : (
              <>자소서 분석하기</>
            )}
          </button>
        </div>
      </AnalyzeBottomBar>

      <AnalyzeLoadingOverlay isLoading={isLoading} />

      <PreviousResumePicker
        open={isResumePickerOpen}
        resumes={previousResumes}
        isLoading={isPreviousResumesLoading}
        error={previousResumeError}
        applyingId={isApplyingPreviousResume}
        onPick={applyPreviousResume}
        onClose={() => setIsResumePickerOpen(false)}
      />

      <ImportPreviewDialog
        pairs={importPreview}
        willOverwrite={hasContent}
        onApply={applyImportedPairs}
        onCancel={() => setImportPreview(null)}
      />

      <AnalyzeErrorModal error={errorModal} onClose={() => setErrorModal(null)} />

      <AnalyzeLoginModal
        open={loginPromptOpen && !isAuthenticated}
        onClose={() => {
          submitAfterLogin.disarm();
          setLoginPromptOpen(false);
        }}
        onBeforeRedirect={() =>
          saveAnalyzeDraft({ company, jobRole, questions, jobPosting, submitOnReturn: true })
        }
      />

      {/* ════════ CONFIRM MODAL ════════ */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmModal(null)}
          >
            <motion.div
              className="bg-surface border border-line rounded-2xl w-full max-w-md p-6 shadow-[0_12px_32px_rgba(25,31,40,0.12)]"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blank-soft flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-blank" />
                </div>
                <h3 className="text-lg font-semibold text-ink">
                  내용이 적어요
                </h3>
              </div>
              <p className="text-sm text-ink-3 leading-relaxed mb-6">
                {confirmModal.message}
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setConfirmModal(null)}
                  variant="outline"
                  className="flex-1 border-line bg-transparent text-ink-2 hover:bg-fill-soft rounded-xl h-11 text-sm font-medium"
                >
                  돌아가기
                </Button>
                <Button
                  onClick={confirmModal.onConfirm}
                  className="flex-1 bg-brand hover:bg-brand-hover text-white rounded-xl h-11 text-sm font-medium"
                >
                  그래도 진행하기
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════ PREVIOUS RESUME LOADED TOAST ════════ */}
      <AnimatePresence>
        {resumeLoaded && (
          <motion.div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="px-5 py-3 rounded-xl border border-line bg-surface shadow-[0_12px_32px_rgba(25,31,40,0.12)] text-sm font-medium text-brand">
              이전 지원서를 불러왔어요.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
