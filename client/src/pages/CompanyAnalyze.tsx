import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Building2, FileText, Link2, Loader2 } from "lucide-react";

import AuthButton from "@/components/AuthButton";
import Logo from "@/components/Logo";
import CompanyCombobox from "@/components/analyze/CompanyCombobox";
import JobRoleCombobox from "@/components/analyze/JobRoleCombobox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getAuthorizationHeader } from "@/lib/apiAuth";
import { trackAnalysisFailed, trackAnalysisStart } from "@/lib/analytics";
import { analysisPendingPath, parseAnalysisReceipt } from "@/lib/analysisRequest";
import { fetchEntitlementSummary, type EntitlementSummary } from "@/lib/entitlements";
import { supabase } from "@/lib/supabase";
import type { ProjectSummary } from "@/types/my";
import { getCompanyAnalyzeError, type CompanyAnalyzeErrorView } from "./companyAnalyzeErrors";

// 서버 normalizeCompanyRequest 와 같은 상한.
const MAX_POSTING_CHARS = 4000;
const MAX_NAME_CHARS = 100;

function readQueryParam(name: string): string {
  if (typeof window === "undefined") return "";
  const value = new URLSearchParams(window.location.search).get(name);
  return typeof value === "string" ? value.slice(0, MAX_NAME_CHARS) : "";
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function CompanyAnalyze() {
  const [, navigate] = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useRequireAuth({ redirectPath: "/company-analysis" });

  const [company, setCompany] = useState(() => readQueryParam("company"));
  const [jobKeyword, setJobKeyword] = useState(() => readQueryParam("jobKeyword"));
  const [postingText, setPostingText] = useState("");
  const [resumeAnalysisId, setResumeAnalysisId] = useState(() => readQueryParam("resumeAnalysisId"));
  const [previousResumes, setPreviousResumes] = useState<ProjectSummary[]>([]);
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<CompanyAnalyzeErrorView | null>(null);
  // 같은 입력 재시도는 같은 키, 입력이 바뀌면 새 키(자소서 분석과 동일 규칙).
  const requestRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const next = await fetchEntitlementSummary(token);
          if (!cancelled) setSummary(next);
        }
      } catch {
        // 잔여 표시는 편의 정보다. 실패해도 폼은 쓸 수 있고 서버가 최종 판단한다.
      }
      try {
        const response = await fetch("/api/projects", { headers: await getAuthorizationHeader() });
        if (!response.ok) return;
        const projects: ProjectSummary[] = await response.json();
        if (!cancelled) {
          setPreviousResumes(projects.filter(project => project.kind !== "COMPANY" && project.latest_analysis_id));
        }
      } catch {
        // 연결 목록은 선택 사항이다.
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated]);

  const canSubmit = company.trim().length > 0 && jobKeyword.trim().length > 0
    && postingText.length <= MAX_POSTING_CHARS && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsLoading(true);

    const payload: Record<string, string> = {
      company: company.trim().slice(0, MAX_NAME_CHARS),
      jobKeyword: jobKeyword.trim().slice(0, MAX_NAME_CHARS),
    };
    if (postingText.trim()) payload.postingText = postingText.trim();
    if (resumeAnalysisId) payload.resumeAnalysisId = resumeAnalysisId;

    const fingerprint = JSON.stringify(payload);
    const previous = requestRef.current;
    const idempotencyKey = previous?.fingerprint === fingerprint ? previous.idempotencyKey : crypto.randomUUID();
    requestRef.current = { fingerprint, idempotencyKey };
    trackAnalysisStart("company_report", postingText.length);

    try {
      const response = await fetch("/api/analyze/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthorizationHeader()),
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.status !== 202 && response.status !== 200) {
        let errorData: unknown;
        try { errorData = await response.json(); } catch { /* 본문 없음 */ }
        const view = getCompanyAnalyzeError(errorData, response.status);
        trackAnalysisFailed("company_report", view.trackingType);
        setErrorModal(view);
        return;
      }

      let receipt;
      try {
        receipt = parseAnalysisReceipt(await response.json());
      } catch {
        trackAnalysisFailed("company_report", "parse_error");
        setErrorModal({ title: "접수 확인 실패", message: "접수 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.", trackingType: "parse_error" });
        return;
      }
      requestRef.current = null;
      navigate(analysisPendingPath(receipt.analysisRequestId));
    } catch {
      trackAnalysisFailed("company_report", "server_error");
      setErrorModal({ title: "연결 불안정", message: "네트워크가 불안정해요. 잠시 후 다시 시도해 주세요.", trackingType: "server_error" });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return <main className="min-h-screen bg-[#0A0A0A]" aria-busy="true" />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28">
      {/* ════════ GNB ════════ */}
      <motion.nav
        className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-lg border-b border-white/5"
        initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}
      >
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-2 hover:bg-white/10 rounded-lg transition-colors" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center cursor-pointer" onClick={() => navigate("/")}>
              <Logo className="h-6 w-auto" />
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
      <motion.section className="py-12 md:py-20" variants={containerVariants} initial="hidden" animate="visible">
        <div className="container max-w-3xl mx-auto px-4">
          <motion.div className="text-center mb-12" variants={itemVariants}>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">기업 분석 리포트</h1>
            <p className="text-zinc-500 text-base md:text-lg leading-relaxed max-w-xl mx-auto break-keep">
              회사와 직무를 고르면, 돈 버는 구조부터 맡고 싶은 사업 후보까지 지원자의 시선으로 정리해 드려요.
            </p>
          </motion.div>

          {summary && (
            <motion.div variants={itemVariants} className="mb-6 flex flex-wrap items-center justify-center gap-2 text-[13px]">
              <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-zinc-300">
                기업 분석 이용권 {summary.companyRemaining}회
              </span>
              {!summary.companyAnalysisEnabled && (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-amber-200">
                  준비 중인 기능이에요. 관리자 확인 후 열립니다.
                </span>
              )}
              {summary.companyAnalysisEnabled && summary.companyRemaining === 0 && (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-amber-200">
                  보유한 기업 분석 이용권이 없어요.
                </span>
              )}
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-7">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-400/20 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <h2 className="text-base font-semibold text-white">회사와 직무</h2>
              <span className="text-[11px] text-cyan-300 bg-cyan-400/[0.08] px-2 py-0.5 rounded-full">필수</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2.5 uppercase tracking-wider">회사</label>
              <CompanyCombobox value={company} onChange={setCompany} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">직무</label>
              <JobRoleCombobox value={jobKeyword} onChange={setJobKeyword} />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-7">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-zinc-300" />
              </div>
              <h2 className="text-base font-semibold text-white">채용공고 붙여넣기</h2>
              <span className="text-[11px] text-zinc-600 bg-white/[0.06] px-2 py-0.5 rounded-full">선택</span>
            </div>
            <div>
              <Textarea
                value={postingText}
                onChange={event => setPostingText(event.target.value.slice(0, MAX_POSTING_CHARS))}
                placeholder="수행직무·자격요건을 붙여 넣으면 '이 직무의 자리' 섹션이 채용공고 문장을 해석해 드려요."
                className="min-h-[160px] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-600 rounded-xl text-[15px] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-2 text-right text-xs text-zinc-600 tabular-nums">{postingText.length.toLocaleString()} / {MAX_POSTING_CHARS.toLocaleString()}</p>
            </div>
          </motion.div>

          {previousResumes.length > 0 && (
            <motion.div variants={itemVariants} className="mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Link2 className="w-3.5 h-3.5 text-zinc-300" />
                </div>
                <h2 className="text-base font-semibold text-white">내 자소서 분석과 연결</h2>
                <span className="text-[11px] text-zinc-600 bg-white/[0.06] px-2 py-0.5 rounded-full">선택</span>
              </div>
              <select
                value={resumeAnalysisId}
                onChange={event => setResumeAnalysisId(event.target.value)}
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-[15px] text-white focus:border-blue-500/40 focus:outline-none"
                aria-label="연결할 자소서 분석"
              >
                <option value="" className="bg-[#141414]">연결하지 않기</option>
                {previousResumes.map(project => (
                  <option key={project.id} value={project.latest_analysis_id ?? ""} className="bg-[#141414]">
                    {(project.company_name || project.title) + (project.job_role ? ` · ${project.job_role}` : "")}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-600">연결하면 리포트 안에서 자소서 분석으로 바로 이동할 수 있어요.</p>
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* ════════ BOTTOM BAR ════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/90 backdrop-blur-xl">
        <div className="container max-w-3xl mx-auto px-4 flex flex-col">
          <div className="h-[72px] flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-500 break-keep">검색과 정리에 1분 정도 걸려요. 실패하면 이용권은 차감되지 않아요.</p>
            <Button
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-white px-6 py-3 text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-cyan-500/25 transition-all disabled:opacity-40 disabled:shadow-none whitespace-nowrap flex-shrink-0"
            >
              {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />접수 중...</>) : (<>기업 분석 시작</>)}
            </Button>
          </div>
        </div>
      </div>

      {/* ════════ ERROR MODAL ════════ */}
      <AnimatePresence>
        {errorModal && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setErrorModal(null)}
          >
            <motion.div
              className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{errorModal.title}</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">{errorModal.message}</p>
              {errorModal.actionHref && errorModal.actionLabel && (
                <Button
                  onClick={() => { const href = errorModal.actionHref; setErrorModal(null); if (href) navigate(href); }}
                  className="w-full mb-2 bg-white hover:bg-zinc-200 text-black rounded-xl h-11 text-sm font-semibold transition-colors"
                >
                  {errorModal.actionLabel}
                </Button>
              )}
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
    </div>
  );
}
