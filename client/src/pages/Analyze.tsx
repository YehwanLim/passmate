import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  ArrowRight,
  Plus,
  Loader2,
  BarChart3,
  Info,
  Building2,
  AlertTriangle,
  History,
  FileUp,
} from "lucide-react";
import CompanyCombobox from "@/components/analyze/CompanyCombobox";
import JobRoleCombobox from "@/components/analyze/JobRoleCombobox";
import {
  ANALYZE_CONTAINER_VARIANTS,
  ANALYZE_ITEM_VARIANTS,
  ANALYZE_SUBMIT_BUTTON_CLASS,
  AnalyzeBottomBar,
  AnalyzeErrorModal,
  type AnalyzeErrorView,
} from "@/components/analyze/AnalyzeShell";
import FormSection from "@/components/analyze/FormSection";
import SiteHeader from "@/components/SiteHeader";
import QuestionCard from "@/components/analyze/QuestionCard";
import PreviousResumePicker from "@/components/analyze/PreviousResumePicker";
import ImportPreviewDialog from "@/components/analyze/ImportPreviewDialog";
import AnalyzeLoadingOverlay from "@/components/analyze/AnalyzeLoadingOverlay";
import AnalyzeLoginModal from "@/components/analyze/AnalyzeLoginModal";
import JobPostingSection from "@/components/analyze/JobPostingSection";
import JobPostingStickyBar from "@/components/analyze/JobPostingStickyBar";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { sanitizeText } from "@/utils/sanitize";
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
import {
  extractTextFromFile,
  requestAiSplit,
  splitResumeText,
  ResumeImportError,
  type ResumeImportPair,
} from "@/lib/resumeFileImport";
import type { ProjectSummary } from "@/types/my";
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

/**
 * PassMate - 자소서 분석 페이지 (/analyze)
 *
 * - 지원 직무/키워드 (선택 입력)
 * - 다중 문항 입력 (최대 5개)
 * - 개별 글자 수 + 전체 글자 수 카운터
 * - Sticky 하단 바: 총 글자 수 + 결제 버튼
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
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<AnalyzeErrorView | null>(null);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  // 선택 입력. 서버가 정리한 공고 요약 레코드만 들고 있다가 제출 시 id 만 보낸다.
  const [jobPosting, setJobPosting] = useState<JobPostingRecord | null>(
    () => draft?.jobPosting ?? null
  );
  // 모달 안에서(또는 다른 탭에서) 로그인되면 닫는다. 제출은 사용자가 다시 누른다 — 클릭 없이 크레딧을 쓰지 않는다.
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

  // ── 글자 수 계산 ──
  const totalChars = useMemo(
    () => questions.reduce((sum, q) => sum + q.answer.length, 0),
    [questions]
  );
  const isOverLimit = totalChars > MAX_TOTAL_CHARS;
  const isBelowMinimum = totalChars < MIN_TOTAL_CHARS;
  const isAtMaxQuestions = questions.length >= MAX_QUESTIONS;
  const hasContent = questions.some(q => q.answer.trim().length > 0);
  // Hard Block: 200자 미만 OR 6000자 초과 → 버튼 완전 비활성화
  const canSubmit = hasContent && !isBelowMinimum && !isOverLimit && !isLoading;

  // ── 문항 CRUD (6000자 Hard Block 포함) ──
  const handleUpdateQuestion = useCallback(
    (id: string, field: "question" | "answer", value: string) => {
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
    []
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

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28">
      <SiteHeader />

      {/* ════════ MAIN FORM ════════ */}
      <motion.section
        className="py-12 md:py-20"
        variants={ANALYZE_CONTAINER_VARIANTS}
        initial="hidden"
        animate="visible"
      >
        <div className="container max-w-3xl mx-auto px-4">
          {/* ── Title ── */}
          <motion.div className="text-center mb-12" variants={ANALYZE_ITEM_VARIANTS}>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
              자소서 분석
            </h1>
            <p className="text-zinc-500 text-base md:text-lg leading-relaxed max-w-xl mx-auto break-keep">
              제출 버튼을 누르기 전에,
              <br className="hidden md:block" /> 채용 담당자의 눈으로 내
              자소서의 <span className="whitespace-nowrap">현재 위치</span>를
              파악해 보세요.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              {user?.id && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openPreviousResumePicker}
                  className="h-10 border-white/[0.1] bg-white/[0.02] px-4 text-sm font-medium text-zinc-300 hover:border-cyan-400/30 hover:bg-cyan-400/[0.06] hover:text-cyan-200"
                >
                  <History className="mr-2 h-4 w-4" />
                  이전 지원서 불러오기
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(fileImportStage)}
                onClick={() => fileInputRef.current?.click()}
                className="h-10 border-white/[0.1] bg-white/[0.02] px-4 text-sm font-medium text-zinc-300 hover:border-cyan-400/30 hover:bg-cyan-400/[0.06] hover:text-cyan-200 disabled:cursor-wait"
              >
                {fileImportStage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-cyan-400" />
                    {fileImportStage === "extracting"
                      ? "파일 읽는 중..."
                      : "문항 나누는 중..."}
                  </>
                ) : (
                  <>
                    <FileUp className="mr-2 h-4 w-4" />
                    자소서 파일 올리기
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={handleResumeFileSelected}
                aria-label="자소서 PDF 또는 Word 파일 선택"
              />
            </div>
            <p className="mt-2.5 text-xs text-zinc-600">
              PDF·Word(.docx) 파일만 올릴 수 있어요
            </p>
          </motion.div>

          {/* ── 목표 회사 및 직무 정보 ── */}
          <FormSection icon={Building2} accent title="목표 회사 및 직무 정보">
            {/* 지원 회사 */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2.5 uppercase tracking-wider">
                지원 회사
              </label>
              <CompanyCombobox value={company} onChange={setCompany} />
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
                  className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] text-zinc-500 transition-colors hover:text-sky-300"
                >
                  {company.trim()} 기업 분석 리포트 먼저 받기
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* 지원 직무 */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">
                지원 직무
              </label>
              <JobRoleCombobox value={jobRole} onChange={setJobRole} />
            </div>
          </FormSection>

          {/* ── 채용공고 (선택) ── */}
          <JobPostingSection
            value={jobPosting}
            onChange={setJobPosting}
            isAuthenticated={isAuthenticated}
            onRequireLogin={() => {
              trackLoginPrompt("job_posting");
              setLoginPromptOpen(true);
            }}
          />

          {/* ── 문항 리스트 ── */}
          <motion.div variants={ANALYZE_ITEM_VARIANTS}>
            {jobPosting && <JobPostingStickyBar record={jobPosting} />}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">
                자소서 문항
              </h2>
              <span className="text-xs text-zinc-600 tabular-nums">
                {questions.length} / {MAX_QUESTIONS}
              </span>
            </div>

            <div className="space-y-5">
              <AnimatePresence mode="popLayout">
                {questions.map((item, index) => (
                  <QuestionCard
                    key={item.id}
                    item={item}
                    index={index}
                    canDelete={questions.length > 1}
                    onUpdate={handleUpdateQuestion}
                    onDelete={handleDeleteQuestion}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ── 문항 추가 버튼 ── */}
          <motion.div variants={ANALYZE_ITEM_VARIANTS} className="mt-5">
            {isAtMaxQuestions ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      disabled
                      variant="outline"
                      className="w-full border-white/[0.08] bg-white/[0.02] text-zinc-600 rounded-xl h-12 text-sm font-medium cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      문항 추가하기
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-zinc-800 text-zinc-200 border-zinc-700"
                >
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    <span>최대 {MAX_QUESTIONS}개 문항까지 분석 가능합니다</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                onClick={handleAddQuestion}
                variant="outline"
                className="w-full border-white/[0.08] border-dashed bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.16] rounded-xl h-12 text-sm font-medium transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                문항 추가하기
              </Button>
            )}
          </motion.div>
        </div>
      </motion.section>

      {/* ════════ STICKY BOTTOM BAR ════════ */}
      <AnalyzeBottomBar>
        {/* 글자 수 경고 메시지 */}
        {isOverLimit && (
          <div className="flex items-center gap-2 pt-2.5 pb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400">
              {UI_LABELS.CHAR_OVER_LIMIT}
            </span>
          </div>
        )}
        {isBelowMinimum && hasContent && !isOverLimit && (
          <div className="flex items-center gap-2 pt-2.5 pb-1">
            <Info className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <span className="text-xs text-zinc-500">
              최소 {MIN_TOTAL_CHARS}자 이상 입력해 주세요
            </span>
          </div>
        )}

        <div className="h-[72px] flex items-center justify-between gap-4">
          {/* 총 글자 수 */}
          <div className="flex items-center gap-2.5 min-w-0">
            <BarChart3
              className={`w-4 h-4 flex-shrink-0 ${
                isOverLimit ? "text-red-400" : "text-zinc-500"
              }`}
            />
            <span
              className={`text-sm font-medium tabular-nums whitespace-nowrap ${
                isOverLimit ? "text-red-400" : "text-zinc-400"
              }`}
            >
              총 글자 수:{" "}
              <span
                className={`font-semibold ${
                  isOverLimit ? "text-red-400" : "text-white"
                }`}
              >
                {totalChars.toLocaleString()}
              </span>{" "}
              / {MAX_TOTAL_CHARS.toLocaleString()}자
            </span>
          </div>

          {/* 결제 + 분석 버튼 */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="lg"
            className={ANALYZE_SUBMIT_BUTTON_CLASS}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                분석 중...
              </>
            ) : (
              <>분석 시작</>
            )}
          </Button>
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
        onClose={() => setLoginPromptOpen(false)}
        onBeforeRedirect={() =>
          saveAnalyzeDraft({ company, jobRole, questions, jobPosting })
        }
      />

      {/* ════════ CONFIRM MODAL ════════ */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmModal(null)}
          >
            <motion.div
              className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  내용이 적어요
                </h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                {confirmModal.message}
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setConfirmModal(null)}
                  variant="outline"
                  className="flex-1 border-white/[0.1] bg-transparent text-zinc-300 hover:bg-white/[0.05] rounded-xl h-11 text-sm font-medium"
                >
                  돌아가기
                </Button>
                <Button
                  onClick={confirmModal.onConfirm}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-white rounded-xl h-11 text-sm font-medium"
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
            <div className="px-5 py-3 rounded-xl border border-cyan-500/20 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 text-sm font-medium text-cyan-400">
              이전 지원서를 불러왔어요.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
