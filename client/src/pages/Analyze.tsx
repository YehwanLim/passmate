import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  BarChart3,
  CreditCard,
  Info,
  Search,
  Building2,
  FileSearch,
  FileText,
  X,
  AlertTriangle,
  History,
  CalendarDays,
  BriefcaseBusiness,
} from "lucide-react";
import Logo from "@/components/Logo";
import AuthButton from "@/components/AuthButton";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { sanitizeText } from "@/utils/sanitize";
import { checkDuplicateQuestions } from "@/utils/textSimilarity";
import { saveAnalysisToStorage, clearAnalysisResult } from "@/utils/storage";
import { UI_LABELS } from "@/constants/labels";
import { COMPANY_PRESETS, normalizeCompanyName } from "@/constants/companies";
import {
  trackResumeUpload,
  trackAnalysisStart,
  trackAnalysisComplete,
  trackAnalysisFailed,
} from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";
import type { ProjectSummary } from "@/types/my";


/**
 * PassMate - 자소서 분석 페이지 (/analyze)
 *
 * - 지원 직무/키워드 (선택 입력)
 * - 다중 문항 입력 (최대 5개)
 * - 개별 글자 수 + 전체 글자 수 카운터
 * - Sticky 하단 바: 총 글자 수 + 결제 버튼
 */

const MAX_QUESTIONS = 5;
const MAX_TOTAL_CHARS = 6000;
const MIN_TOTAL_CHARS = 200;
const WARN_TOTAL_CHARS = 1000;

export function getAnalyzeErrorMessage(errorData: unknown): string {
  if (!errorData || typeof errorData !== "object") {
    return UI_LABELS.ANALYSIS_FAILED;
  }

  const { message, error } = errorData as {
    message?: unknown;
    error?: unknown;
  };

  const rawMessage = [message, error]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  if (/Google API Error 503|UNAVAILABLE|high demand|과부하/i.test(rawMessage)) {
    return UI_LABELS.MODEL_OVERLOADED_ERROR;
  }

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return UI_LABELS.ANALYSIS_FAILED;
}

const LOADING_STEPS = {
  1: {
    icon: FileSearch,
    title: "자소서를 한 줄씩 읽고 있어요",
    label: UI_LABELS.LOADING_STEP_1,
    accent: "text-sky-400",
  },
  2: {
    icon: BarChart3,
    title: "합격 신호를 찾는 중이에요",
    label: UI_LABELS.LOADING_STEP_2,
    accent: "text-cyan-400",
  },
  3: {
    icon: FileText,
    title: "인사이트 리포트를 정리하고 있어요",
    label: UI_LABELS.LOADING_STEP_3,
    accent: "text-emerald-400",
  },
} as const;

export const JOB_ROLE_CATEGORIES = [
  {
    name: "기획·PM",
    roles: ["서비스 기획", "제품/상품 기획", "사업 기획", "UX 기획", "프로젝트 매니저"],
  },
  {
    name: "마케팅·브랜딩",
    roles: ["브랜드 마케팅", "디지털 마케팅", "퍼포먼스 마케팅", "콘텐츠 마케팅", "CRM 마케팅"],
  },
  {
    name: "경영·사업",
    roles: ["경영전략", "사업전략", "신사업", "사업개발", "해외사업"],
  },
  {
    name: "재무·회계",
    roles: ["재무", "회계", "세무", "IR", "자금", "FP&A"],
  },
  {
    name: "구매·SCM",
    roles: ["구매", "전략구매", "SCM", "물류", "생산관리"],
  },
  {
    name: "인사·총무",
    roles: ["인사(HR)", "채용", "조직문화", "교육", "총무"],
  },
  {
    name: "영업·고객",
    roles: ["국내영업", "해외영업", "B2B 영업", "고객관리", "고객지원(CS)"],
  },
  {
    name: "데이터·IT",
    roles: ["데이터 분석", "데이터 사이언스", "프론트엔드 개발", "백엔드 개발", "AI/ML 엔지니어"],
  },
  {
    name: "디자인·콘텐츠",
    roles: ["UX/UI 디자인", "프로덕트 디자인", "그래픽 디자인", "콘텐츠 기획", "영상 콘텐츠"],
  },
] as const;

const PRESET_JOB_ROLES = JOB_ROLE_CATEGORIES.flatMap((category) => category.roles);

export function isPresetJobRole(jobRole: string) {
  return PRESET_JOB_ROLES.some((role) => role === jobRole);
}

interface QuestionItem {
  id: string;
  question: string;
  answer: string;
}

interface SavedAnalysisDetail {
  question_text: string;
  input_text: string;
  company_name: string | null;
  job_role: string | null;
}

function createEmptyQuestion(): QuestionItem {
  return {
    id: crypto.randomUUID(),
    question: "",
    answer: "",
  };
}

function splitSavedQuestionSections(text: string): Map<number, string> {
  const marker = /(?:^|\n{2,})\[문항\s*(\d+)\]\s*/g;
  const matches = Array.from(text.matchAll(marker));

  return new Map(
    matches.map((match, index) => [
      Number(match[1]),
      text
        .slice(
          (match.index ?? 0) + match[0].length,
          matches[index + 1]?.index ?? text.length
        )
        .trim(),
    ])
  );
}

export function parseSavedQuestions(questionText: string, inputText: string) {
  const savedQuestions = splitSavedQuestionSections(questionText);
  const savedAnswers = splitSavedQuestionSections(inputText);
  const indexes = Array.from(
    new Set([...Array.from(savedQuestions.keys()), ...Array.from(savedAnswers.keys())])
  ).sort((a, b) => a - b);

  if (indexes.length === 0) {
    const question = questionText.trim();
    const answer = inputText.trim();
    return question || answer ? [{ question: question || "문항 1", answer }] : [];
  }

  return indexes.map((index) => ({
    question: savedQuestions.get(index) || `문항 ${index}`,
    answer: savedAnswers.get(index) || "",
  }));
}

function formatSavedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "작성일 미상";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/* ──────────────────────────────────────────
   지원 회사 콤보박스 (Search & Input)
────────────────────────────────────────── */
function CompanyCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 입력값으로 필터링된 목록
  const filtered = useMemo(() => {
    if (!value.trim()) return COMPANY_PRESETS;
    const normalizedQuery = normalizeCompanyName(value);
    return COMPANY_PRESETS.filter((c) =>
      normalizeCompanyName(c).includes(normalizedQuery)
    );
  }, [value]);

  const showDropdown = isFocused && (filtered.length > 0 || value.trim() !== "");

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="회사명을 검색하거나 직접 입력하세요"
          className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-600 rounded-xl h-12 pl-11 pr-10 text-[15px] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/10 transition-colors"
            aria-label="입력 초기화"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 자동완성 드롭다운 */}
      <AnimatePresence>
        {showDropdown && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="absolute z-30 mt-2 w-full max-h-60 overflow-y-auto rounded-xl border border-white/[0.1] bg-[#141414] backdrop-blur-xl shadow-2xl shadow-black/40 py-1.5"
          >
            {filtered.length > 0 ? (
              filtered.map((company) => (
                <li key={company}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(company);
                      setIsFocused(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                      value === company
                        ? "text-cyan-400 bg-cyan-400/[0.08]"
                        : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    {company}
                  </button>
                </li>
              ))
            ) : (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setIsFocused(false)}
                  className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 text-cyan-400 hover:bg-white/[0.06]"
                >
                  <Plus className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span className="font-medium">"{value}"</span> 직접 입력하기
                </button>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────
   직무 선택 (Badge Selector + 직접 입력)
────────────────────────────────────────── */
function JobRoleSelector({
  selected,
  onSelect,
  customValue,
  onCustomChange,
}: {
  selected: string | null;
  onSelect: (role: string | null) => void;
  customValue: string;
  onCustomChange: (v: string) => void;
}) {
  const isCustomActive = selected === "__custom__";

  return (
    <div className="space-y-5">
      <Accordion type="multiple" className="space-y-2">
        {JOB_ROLE_CATEGORIES.map((category) => (
          <AccordionItem
            key={category.name}
            value={category.name}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4"
          >
            <AccordionTrigger className="py-3 text-zinc-300 hover:no-underline">
              {category.name}
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {category.roles.map((role) => {
                  const isActive = selected === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => onSelect(isActive ? null : role)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                        isActive
                          ? "bg-gradient-to-r from-blue-500/20 to-cyan-400/20 border-blue-400/40 text-cyan-300 shadow-sm shadow-blue-500/10"
                          : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-zinc-200"
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* 직접 입력 태그 */}
      {isCustomActive ? (
        <div className="relative flex items-center">
          <input
            autoFocus
            value={customValue}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="직접 입력"
            className="w-32 sm:w-40 px-4 py-2 rounded-full text-sm font-medium border border-blue-400/40 bg-gradient-to-r from-blue-500/10 to-cyan-400/10 text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
          <button
            onClick={() => {
              onSelect(null);
              onCustomChange("");
            }}
            className="absolute right-2 p-0.5 rounded-full text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label="직접 입력 취소"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelect("__custom__")}
          className="px-4 py-2 rounded-full text-sm font-medium border border-dashed border-white/[0.12] bg-transparent text-zinc-500 hover:border-white/[0.22] hover:text-zinc-300 transition-all"
        >
          + 직접 입력
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────
   개별 문항 카드 컴포넌트
────────────────────────────────────────── */
function QuestionCard({
  item,
  index,
  canDelete,
  onUpdate,
  onDelete,
}: {
  item: QuestionItem;
  index: number;
  canDelete: boolean;
  onUpdate: (id: string, field: "question" | "answer", value: string) => void;
  onDelete: (id: string) => void;
}) {
  const charCount = item.answer.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
    >
      {/* Header: 문항 번호 + 삭제 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-400/20 text-xs font-bold text-cyan-400 tabular-nums">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-zinc-400">
            문항 {index + 1}
          </span>
        </div>

        {canDelete && (
          <button
            onClick={() => onDelete(item.id)}
            className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label={`문항 ${index + 1} 삭제`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 질문 입력 */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
          질문
        </label>
        <Input
          value={item.question}
          onChange={(e) => onUpdate(item.id, "question", e.target.value)}
          placeholder="예) 지원 동기를 작성해 주세요."
          className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-600 rounded-xl h-12 px-4 text-[15px] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
      </div>

      {/* 답변 입력 */}
      <div className="relative">
        <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
          답변
        </label>
        <Textarea
          value={item.answer}
          onChange={(e) => onUpdate(item.id, "answer", e.target.value)}
          placeholder="여기에 답변을 작성해 주세요."
          rows={8}
          className="w-full border-white/[0.08] bg-white/[0.04] text-white rounded-xl p-4 text-[15px] leading-relaxed resize-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-zinc-600"
        />
        {/* 개별 글자 수 */}
        <div className="absolute bottom-3 right-4 text-xs text-zinc-600 tabular-nums pointer-events-none">
          {charCount.toLocaleString()}자
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────
   메인 Analyze 페이지
────────────────────────────────────────── */
export default function Analyze() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [company, setCompany] = useState("");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [customJob, setCustomJob] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([
    createEmptyQuestion(),
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [isResumePickerOpen, setIsResumePickerOpen] = useState(false);
  const [previousResumes, setPreviousResumes] = useState<ProjectSummary[]>([]);
  const [isPreviousResumesLoading, setIsPreviousResumesLoading] = useState(false);
  const [previousResumeError, setPreviousResumeError] = useState<string | null>(null);
  const [isApplyingPreviousResume, setIsApplyingPreviousResume] = useState<string | null>(null);
  const [resumeLoaded, setResumeLoaded] = useState(false);

  // ── Status Step 로딩 타이머 ──
  useEffect(() => {
    if (!isLoading) { setLoadingStep(0); return; }
    setLoadingStep(1);
    const t1 = setTimeout(() => setLoadingStep(2), 7000);
    const t2 = setTimeout(() => setLoadingStep(3), 30000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isLoading]);

  // ── 글자 수 계산 ──
  const totalChars = useMemo(
    () => questions.reduce((sum, q) => sum + q.answer.length, 0),
    [questions]
  );
  const currentLoadingStep =
    LOADING_STEPS[(loadingStep || 1) as keyof typeof LOADING_STEPS];
  const LoadingIcon = currentLoadingStep.icon;
  const isOverLimit = totalChars > MAX_TOTAL_CHARS;
  const isBelowMinimum = totalChars < MIN_TOTAL_CHARS;
  const isAtMaxQuestions = questions.length >= MAX_QUESTIONS;
  const hasContent = questions.some((q) => q.answer.trim().length > 0);
  // Hard Block: 200자 미만 OR 6000자 초과 → 버튼 완전 비활성화
  const canSubmit = hasContent && !isBelowMinimum && !isOverLimit && !isLoading;

  // ── 문항 CRUD (6000자 Hard Block 포함) ──
  const handleUpdateQuestion = useCallback(
    (id: string, field: "question" | "answer", value: string) => {
      setQuestions((prev) => {
        if (field === "answer") {
          const otherChars = prev
            .filter((q) => q.id !== id)
            .reduce((sum, q) => sum + q.answer.length, 0);
          if (otherChars + value.length > MAX_TOTAL_CHARS) {
            const allowed = MAX_TOTAL_CHARS - otherChars;
            value = value.slice(0, Math.max(0, allowed));
          }
        }
        return prev.map((q) => (q.id === id ? { ...q, [field]: value } : q));
      });
    },
    []
  );

  const handleDeleteQuestion = useCallback(
    (id: string) => {
      if (questions.length <= 1) return;
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    },
    [questions.length]
  );

  const handleAddQuestion = useCallback(() => {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((prev) => [...prev, createEmptyQuestion()]);
  }, [questions.length]);

  const openPreviousResumePicker = async () => {
    if (!user?.id) return;

    setIsResumePickerOpen(true);
    setIsPreviousResumesLoading(true);
    setPreviousResumeError(null);

    try {
      const response = await fetch(`/api/projects?userId=${encodeURIComponent(user.id)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const projects: ProjectSummary[] = await response.json();
      setPreviousResumes(projects.filter((project) => project.latest_analysis_id));
    } catch (error) {
      console.error("[Analyze] 이전 지원서 목록 조회 실패:", error);
      setPreviousResumeError("저장된 지원서를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsPreviousResumesLoading(false);
    }
  };

  const applyPreviousResume = async (analysisId: string) => {
    setIsApplyingPreviousResume(analysisId);
    setPreviousResumeError(null);

    try {
      const response = await fetch(`/api/analysis/${encodeURIComponent(analysisId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const analysis: SavedAnalysisDetail = await response.json();
      const restoredQuestions = parseSavedQuestions(analysis.question_text, analysis.input_text)
        .slice(0, MAX_QUESTIONS)
        .map((question) => ({ ...question, id: crypto.randomUUID() }));

      if (restoredQuestions.length === 0) {
        throw new Error("저장된 문항을 찾을 수 없습니다.");
      }

      const savedJob = analysis.job_role?.trim() || "";
      const isSavedPresetJob = isPresetJobRole(savedJob);
      setCompany(analysis.company_name?.trim() || "");
      setQuestions(restoredQuestions);
      setSelectedJob(isSavedPresetJob ? savedJob : savedJob ? "__custom__" : null);
      setCustomJob(isSavedPresetJob ? "" : savedJob);
      setIsResumePickerOpen(false);
      setResumeLoaded(true);
      setTimeout(() => setResumeLoaded(false), 4000);
    } catch (error) {
      console.error("[Analyze] 이전 지원서 불러오기 실패:", error);
      setPreviousResumeError("지원서 내용을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsApplyingPreviousResume(null);
    }
  };

  // ── 분석 제출 (모든 예외 처리 포함) ──
  const executeSubmit = async () => {
    setIsLoading(true);
    // GA4: 분석 시작 시간 기록
    const analysisStartTime = performance.now();

    const jobLabel =
      selectedJob === "__custom__" ? customJob.trim() : selectedJob ?? "";

    // XSS Sanitize + 구조화
    const structuredQuestions = questions.map((q, i) => ({
      question: sanitizeText(q.question.trim()) || `문항 ${i + 1}`,
      answer: sanitizeText(q.answer),
    }));

    // GA4: 자소서 입력 완료 + 분석 시작 이벤트
    trackResumeUpload("text", totalChars);
    trackAnalysisStart("cover_letter", totalChars);

    // 타임아웃 설정 (120초 - AI 분석이 길어질 수 있으므로 여유롭게 설정)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          questions: structuredQuestions,
          company: sanitizeText(company.trim()) || undefined,
          jobKeyword: sanitizeText(jobLabel) || undefined,
        }),
      });

      clearTimeout(timeoutId);

      // Rate Limit (429)
      if (response.status === 429) {
        trackAnalysisFailed("cover_letter", "rate_limit");
        setErrorModal({ title: "요청 제한", message: UI_LABELS.RATE_LIMIT_ERROR });
        return;
      }

      // 문맥 이탈 / 서버 에러
      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch { /* ignore */ }
        if (errorData?.error === "CONTEXT_IRRELEVANT") {
          trackAnalysisFailed("cover_letter", "context_irrelevant");
          setErrorModal({ title: "내용 확인 필요", message: UI_LABELS.CONTEXT_IRRELEVANT });
          return;
        }
        throw new Error(getAnalyzeErrorMessage(errorData));
      }

      // JSON 파싱 에러 방지
      let data;
      try {
        data = await response.json();
      } catch {
        trackAnalysisFailed("cover_letter", "parse_error");
        setErrorModal({ title: "파싱 오류", message: UI_LABELS.JSON_PARSE_ERROR });
        return;
      }

      // 유효성 검사: 정상적인 리포트 구조인지 확인
      if (!data || !Array.isArray(data.questionTabs) || data.questionTabs.length === 0) {
        console.error("❌ API 응답이 올바른 리포트 구조가 아닙니다:", data);
        trackAnalysisFailed("cover_letter", "invalid_response");
        setErrorModal({ title: "분석 오류", message: UI_LABELS.JSON_PARSE_ERROR });
        return;
      }

      // 방어: fallback(더미) 데이터가 정상 응답으로 넘어온 경우 감지
      const isFallback = data.questionTabs.every(
        (tab: any) =>
          (!tab.feedbackCards || tab.feedbackCards.length === 0) &&
          (tab.overview?.includes("서비스 연결 실패") || tab.overview?.includes("연결할 수 없습니다"))
      );
      if (isFallback) {
        console.error("❌ Fallback(더미) 데이터 감지 — AI 분석이 실패한 것으로 판단");
        trackAnalysisFailed("cover_letter", "fallback_detected");
        setErrorModal({
          title: "분석 실패",
          message: "AI 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해 주세요."
        });
        return;
      }

      let savedProjectId: string | undefined;
      let savedAnalysisId: string | undefined;

      if (user?.id && user.email) {
        try {
          const saveResponse = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user,
              result: data,
              analysisMeta: data.analysisMeta,
              questions: structuredQuestions,
              company: company.trim(),
              jobKeyword: jobLabel,
            }),
          });

          let savePayload: any = null;
          try {
            savePayload = await saveResponse.json();
          } catch {
            /* ignore */
          }

          if (!saveResponse.ok) {
            throw new Error(savePayload?.message || savePayload?.error || "분석 결과 저장 실패");
          }

          savedProjectId = savePayload?.project_id;
          savedAnalysisId = savePayload?.analysis_id;
        } catch (saveError) {
          console.warn("[Analyze] DB 저장 실패 — 로컬 결과는 유지합니다:", saveError);
        }
      }

      // 분석 결과 저장 (localStorage + sessionStorage 통합)
      saveAnalysisToStorage({
        result: data,
        questions: structuredQuestions,
        company: company.trim(),
        jobKeyword: jobLabel,
        projectId: savedProjectId,
        analysisId: savedAnalysisId,
      });

      // GA4: 분석 성공 이벤트
      trackAnalysisComplete("cover_letter", Math.round(performance.now() - analysisStartTime));

      navigate("/report-new");
    } catch (error: any) {
      console.error(error);
      clearAnalysisResult();

      if (error.name === "AbortError") {
        trackAnalysisFailed("cover_letter", "timeout");
        setErrorModal({ title: "연결 불안정", message: UI_LABELS.NETWORK_ERROR });
      } else {
        trackAnalysisFailed("cover_letter", "server_error");
        setErrorModal({
          title: "분석 실패",
          message: error?.message || UI_LABELS.ANALYSIS_FAILED,
        });
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;

    // 도배 방지: 유사도 체크 (문항 2개 이상일 때만)
    if (questions.filter((q) => q.answer.trim()).length >= 2) {
      const duplicate = checkDuplicateQuestions(questions.map((q) => q.answer));
      if (duplicate) {
        setErrorModal({ title: "중복 감지", message: UI_LABELS.DUPLICATE_DETECTED });
        return;
      }
    }

    // 200~1000자 구간: confirm 모달
    if (totalChars >= MIN_TOTAL_CHARS && totalChars < WARN_TOTAL_CHARS) {
      setConfirmModal({
        message: UI_LABELS.CHAR_MINIMUM_WARNING,
        onConfirm: () => { setConfirmModal(null); executeSubmit(); },
      });
      return;
    }

    executeSubmit();
  };

  // ── Framer Motion Variants ──
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28">
      {/* ════════ GNB ════════ */}
      <motion.nav
        className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-lg border-b border-white/5"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div
              className="flex items-center cursor-pointer"
              onClick={() => navigate("/")}
            >
              <Logo className="w-6 h-6" textClassName="text-lg md:text-xl text-white" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200"
              onClick={() => navigate("/my")}
            >
              내 지원서
            </button>
            <AuthButton />
          </div>
        </div>
      </motion.nav>

      {/* ════════ MAIN FORM ════════ */}
      <motion.section
        className="py-12 md:py-20"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="container max-w-3xl mx-auto px-4">
          {/* ── Title ── */}
          <motion.div className="text-center mb-12" variants={itemVariants}>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
              자소서 분석
            </h1>
            <p className="text-zinc-500 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
              문항별 자기소개서를 입력하면, AI가 항목별로 분석해 드립니다.
            </p>
            {user?.id && (
              <Button
                type="button"
                variant="outline"
                onClick={openPreviousResumePicker}
                className="mt-6 h-10 border-white/[0.1] bg-white/[0.02] px-4 text-sm font-medium text-zinc-300 hover:border-cyan-400/30 hover:bg-cyan-400/[0.06] hover:text-cyan-200"
              >
                <History className="mr-2 h-4 w-4" />
                이전 지원서 불러오기
              </Button>
            )}
          </motion.div>

          {/* ── 목표 회사 및 직무 정보 ── */}
          <motion.div
            variants={itemVariants}
            className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-7"
          >
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-400/20 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <h2 className="text-base font-semibold text-white">
                목표 회사 및 직무 정보
              </h2>
              <span className="text-[11px] text-zinc-600 bg-white/[0.06] px-2 py-0.5 rounded-full">
                선택
              </span>
            </div>

            {/* 지원 회사 */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2.5 uppercase tracking-wider">
                지원 회사
              </label>
              <CompanyCombobox value={company} onChange={setCompany} />
            </div>

            {/* 지원 직무 */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">
                지원 직무
              </label>
              <JobRoleSelector
                selected={selectedJob}
                onSelect={setSelectedJob}
                customValue={customJob}
                onCustomChange={setCustomJob}
              />
            </div>
          </motion.div>

          {/* ── 문항 리스트 ── */}
          <motion.div variants={itemVariants}>
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
          <motion.div variants={itemVariants} className="mt-5">
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
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/90 backdrop-blur-xl">
        <div className="container max-w-3xl mx-auto px-4 flex flex-col">
          {/* 글자 수 경고 메시지 */}
          {isOverLimit && (
            <div className="flex items-center gap-2 pt-2.5 pb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="text-xs text-red-400">{UI_LABELS.CHAR_OVER_LIMIT}</span>
            </div>
          )}
          {isBelowMinimum && hasContent && !isOverLimit && (
            <div className="flex items-center gap-2 pt-2.5 pb-1">
              <Info className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
              <span className="text-xs text-zinc-500">최소 {MIN_TOTAL_CHARS}자 이상 입력해 주세요</span>
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
              className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-white px-6 py-3 text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-cyan-500/25 transition-all disabled:opacity-40 disabled:shadow-none whitespace-nowrap flex-shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  분석 시작
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ════════ LOADING OVERLAY — Status Step UX ════════ */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="fixed inset-0 z-[100] bg-[#0A0A0A] flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Pulsing gradient ring */}
            <div className="relative mb-10">
              <svg
                className="w-24 h-24 animate-spin"
                style={{ animationDuration: "3s" }}
                viewBox="0 0 100 100"
              >
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#loadGrad)" strokeWidth="4" strokeLinecap="round" strokeDasharray="80 200" />
                <defs>
                  <linearGradient id="loadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#22D3EE" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={loadingStep}
                    initial={{ opacity: 0, scale: 0.75, rotate: -8 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.75, rotate: 8 }}
                    transition={{ duration: 0.35 }}
                  >
                    <LoadingIcon
                      className={`w-8 h-8 ${currentLoadingStep.accent} animate-pulse`}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <motion.p
              key={`loading-title-${loadingStep}`}
              className="text-xl font-semibold text-white mb-6 tracking-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {currentLoadingStep.title}
            </motion.p>

            {/* 3단계 도트 인디케이터 */}
            <div className="flex items-center gap-3 mb-4">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                    loadingStep >= step
                      ? "bg-cyan-400 scale-110 shadow-sm shadow-cyan-400/40"
                      : "bg-zinc-700"
                  }`}
                />
              ))}
            </div>

            {/* 상태 텍스트 (fade 전환) */}
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="text-sm text-zinc-500 mb-10"
              >
                {currentLoadingStep.label}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════ PREVIOUS RESUME PICKER ════════ */}
      <AnimatePresence>
        {isResumePickerOpen && (
          <motion.div
            className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsResumePickerOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="previous-resume-title"
              className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.1] bg-[#141414] shadow-2xl"
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-5">
                <div>
                  <p className="mb-1 text-xs font-medium tracking-wide text-cyan-300">저장된 지원서</p>
                  <h2 id="previous-resume-title" className="text-lg font-semibold text-white">
                    이전 지원서 불러오기
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResumePickerOpen(false)}
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-white"
                  aria-label="이전 지원서 목록 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[min(60vh,520px)] overflow-y-auto p-4">
                {isPreviousResumesLoading ? (
                  <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                    저장된 지원서를 불러오는 중이에요
                  </div>
                ) : previousResumeError ? (
                  <div className="px-3 py-8 text-center text-sm leading-relaxed text-zinc-400">
                    {previousResumeError}
                  </div>
                ) : previousResumes.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm leading-relaxed text-zinc-500">
                    아직 불러올 이전 지원서가 없어요.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {previousResumes.map((project) => {
                      const analysisId = project.latest_analysis_id!;
                      const isApplying = isApplyingPreviousResume === analysisId;

                      return (
                        <button
                          key={project.id}
                          type="button"
                          disabled={Boolean(isApplyingPreviousResume)}
                          onClick={() => applyPreviousResume(analysisId)}
                          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-left transition-colors hover:border-cyan-400/25 hover:bg-cyan-400/[0.05] disabled:cursor-wait disabled:opacity-60"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-100">
                                {project.title}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-500">
                                <span className="inline-flex items-center gap-1.5">
                                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                                  {project.job_role || "직무 미지정"}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {formatSavedDate(project.created_at)}
                                </span>
                              </div>
                            </div>
                            {isApplying ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-400" />
                            ) : (
                              <span className="shrink-0 text-xs font-medium text-cyan-300">불러오기</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════ ERROR MODAL ════════ */}
      <AnimatePresence>
        {errorModal && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setErrorModal(null)}
          >
            <motion.div
              className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{errorModal.title}</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">{errorModal.message}</p>
              <Button
                onClick={() => setErrorModal(null)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-11 text-sm font-medium transition-colors"
              >
                확인
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">내용이 적어요</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">{confirmModal.message}</p>
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

