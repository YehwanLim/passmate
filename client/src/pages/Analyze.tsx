import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  BarChart3,
  CreditCard,
  Info,
  Search,
  Building2,
  X,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

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

/* ── 더미 데이터 ── */
const COMPANY_PRESETS = [
  "삼성전자",
  "SK하이닉스",
  "LG전자",
  "현대자동차",
  "카카오",
  "네이버",
  "배달의민족(우아한형제들)",
  "토스(비바리퍼블리카)",
  "쿠팡",
  "라인플러스",
];

const JOB_ROLE_PRESETS = [
  "서비스 PM",
  "프론트엔드 개발",
  "백엔드 개발",
  "데이터 분석",
  "마케팅",
  "UX/UI 디자인",
  "인사(HR)",
  "영업/세일즈",
];

interface QuestionItem {
  id: string;
  question: string;
  answer: string;
}

function createEmptyQuestion(): QuestionItem {
  return {
    id: crypto.randomUUID(),
    question: "",
    answer: "",
  };
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
    return COMPANY_PRESETS.filter((c) =>
      c.toLowerCase().includes(value.toLowerCase())
    );
  }, [value]);

  const showDropdown = isFocused && filtered.length > 0;

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
            className="absolute z-30 mt-2 w-full max-h-52 overflow-y-auto rounded-xl border border-white/[0.1] bg-[#141414] backdrop-blur-xl shadow-2xl shadow-black/40 py-1.5"
          >
            {filtered.map((company) => (
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
            ))}
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
    <div className="flex flex-wrap items-center gap-2">
      {JOB_ROLE_PRESETS.map((role) => {
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
  const [company, setCompany] = useState("");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [customJob, setCustomJob] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([
    createEmptyQuestion(),
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // ── 글자 수 계산 ──
  const totalChars = useMemo(
    () => questions.reduce((sum, q) => sum + q.answer.length, 0),
    [questions]
  );
  const isOverLimit = totalChars > MAX_TOTAL_CHARS;
  const isAtMaxQuestions = questions.length >= MAX_QUESTIONS;
  const hasContent = questions.some((q) => q.answer.trim().length > 0);
  const canSubmit = hasContent && !isOverLimit && !isLoading;

  // ── 문항 CRUD ──
  const handleUpdateQuestion = useCallback(
    (id: string, field: "question" | "answer", value: string) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
      );
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

  // ── 분석 제출 ──
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsLoading(true);

    const jobLabel =
      selectedJob === "__custom__" ? customJob.trim() : selectedJob ?? "";

    // 원본 questions 배열 구조화
    const structuredQuestions = questions.map((q, i) => ({
      question: q.question.trim() || `문항 ${i + 1}`,
      answer: q.answer,
    }));

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: structuredQuestions,
          company: company.trim() || undefined,
          jobKeyword: jobLabel || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("분석 중 오류가 발생했습니다.");
      }

      const data = await response.json();
      
      // 🛡️ 유효성 검사: 정상적인 리포트 구조인지 확인
      if (!data || !Array.isArray(data.questionTabs) || data.questionTabs.length === 0) {
        console.error("❌ API 응답이 올바른 리포트 구조가 아닙니다:", data);
        throw new Error("서버에서 올바른 분석 결과를 받지 못했습니다.");
      }

      // 분석 결과 저장
      sessionStorage.setItem("passmate_analysis_result", JSON.stringify(data));
      // 원본 질문/답변도 저장 (Report에서 prompt, fullAnswer 폴백용)
      sessionStorage.setItem("passmate_raw_questions", JSON.stringify(structuredQuestions));
      // 회사명/직무명 저장 (Report 헤더에서 동적 사용)
      sessionStorage.setItem("passmate_company", company.trim() || "");
      sessionStorage.setItem("passmate_job", jobLabel || "");
      
      navigate("/report-new");
    } catch (error) {
      console.error(error);
      // 실패 시 sessionStorage 정리 → Report는 항상 깨끗한 더미 데이터 표시
      sessionStorage.removeItem("passmate_analysis_result");
      sessionStorage.removeItem("passmate_raw_questions");
      alert("분석에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
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
      transition: { duration: 0.5, ease: "easeOut" },
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
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">PassMate</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white font-medium"
          >
            로그인
          </Button>
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
        <div className="container max-w-3xl mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
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
            {isOverLimit && (
              <span className="text-[11px] text-red-400/80 hidden sm:inline">
                · 글자 수를 줄여주세요
              </span>
            )}
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
                <CreditCard className="w-4 h-4 mr-2" />
                10,000원 결제하고 분석 시작하기
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ════════ LOADING OVERLAY ════════ */}
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
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="4"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#loadGrad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="80 200"
                />
                <defs>
                  <linearGradient
                    id="loadGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#22D3EE" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
              </div>
            </div>

            <motion.p
              className="text-xl font-semibold text-white mb-3 tracking-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              인사이트 리포트를 생성하고 있습니다
            </motion.p>
            <motion.p
              className="text-sm text-zinc-500 mb-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              현직 PM의 합격 로직으로 분석 중...
            </motion.p>

            {/* Progress bar */}
            <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "90%" }}
                transition={{ duration: 2.8, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
