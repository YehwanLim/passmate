import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Building2, FileText, Link2, Loader2 } from "lucide-react";

import CompanyCombobox from "@/components/analyze/CompanyCombobox";
import JobRoleCombobox from "@/components/analyze/JobRoleCombobox";
import {
  ANALYZE_CONTAINER_VARIANTS,
  ANALYZE_ITEM_VARIANTS,
  ANALYZE_SUBMIT_BUTTON_CLASS,
  AnalyzeBottomBar,
  AnalyzeErrorModal,
  AnalyzeNav,
} from "@/components/analyze/AnalyzeShell";
import FormSection from "@/components/analyze/FormSection";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getAuthorizationHeader } from "@/lib/apiAuth";
import { trackAnalysisFailed, trackAnalysisStart } from "@/lib/analytics";
import { analysisPendingPath } from "@/lib/analysisRequest";
import { resolveIdempotencyKey, submitAnalysisRequest, type IdempotentRequest } from "@/lib/analysisSubmit";
import { fetchEntitlementSummary, type EntitlementSummary } from "@/lib/entitlements";
import { readQueryParam } from "@/lib/readQueryParam";
import { supabase } from "@/lib/supabase";
import type { ProjectSummary } from "@/types/my";
import { getCompanyAnalyzeError, type CompanyAnalyzeErrorView } from "./companyAnalyzeErrors";

// 서버 normalizeCompanyRequest 와 같은 상한.
const MAX_POSTING_CHARS = 4000;
const MAX_NAME_CHARS = 100;

export default function CompanyAnalyze() {
  const [, navigate] = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useRequireAuth({ redirectPath: "/company-analysis" });

  const [company, setCompany] = useState(() => readQueryParam("company", MAX_NAME_CHARS));
  const [jobKeyword, setJobKeyword] = useState(() => readQueryParam("jobKeyword", MAX_NAME_CHARS));
  const [postingText, setPostingText] = useState("");
  const [resumeAnalysisId, setResumeAnalysisId] = useState(() => readQueryParam("resumeAnalysisId", MAX_NAME_CHARS));
  const [previousResumes, setPreviousResumes] = useState<ProjectSummary[]>([]);
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<CompanyAnalyzeErrorView | null>(null);
  // 같은 입력 재시도는 같은 키, 입력이 바뀌면 새 키(자소서 분석과 동일 규칙).
  const requestRef = useRef<IdempotentRequest | null>(null);

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
        if (!response.ok) {
          if (!cancelled) setResumeAnalysisId("");
          return;
        }
        const projects: ProjectSummary[] = await response.json();
        if (!cancelled) {
          const nextResumes = projects.filter(project => project.kind !== "COMPANY" && project.latest_analysis_id);
          setPreviousResumes(nextResumes);
          // 쿼리로 들어온 연결 대상은 내 목록에 있을 때만 유지한다 — 남의 id·삭제된 분석은 "연결하지 않기"로.
          setResumeAnalysisId(current => nextResumes.some(project => project.latest_analysis_id === current) ? current : "");
        }
      } catch {
        // 연결 목록은 선택 사항이다. 목록을 모르면 연결도 하지 않는다.
        if (!cancelled) setResumeAnalysisId("");
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

    const request = resolveIdempotencyKey(requestRef.current, JSON.stringify(payload));
    requestRef.current = request;
    trackAnalysisStart("company_report", postingText.length);

    try {
      const result = await submitAnalysisRequest("/api/analyze/company", payload, request.idempotencyKey);

      if (result.kind === "rejected") {
        const view = getCompanyAnalyzeError(result.errorData, result.status);
        trackAnalysisFailed("company_report", view.trackingType);
        setErrorModal(view);
        return;
      }
      if (result.kind === "parse_error") {
        trackAnalysisFailed("company_report", "parse_error");
        setErrorModal({ title: "접수 확인 실패", message: "접수 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.", trackingType: "parse_error" });
        return;
      }
      if (result.kind === "auth_required") {
        // 이 페이지는 로그인 가드가 있어 보통 오지 않는다. 세션이 도중에 끊긴 경우의 안전망.
        trackAnalysisFailed("company_report", "auth_required");
        setErrorModal({ title: "로그인 필요", message: "로그인 후 분석을 시작할 수 있어요.", trackingType: "auth_required" });
        return;
      }
      if (result.kind === "network_error") {
        trackAnalysisFailed("company_report", "server_error");
        setErrorModal({ title: "연결 불안정", message: "네트워크가 불안정해요. 잠시 후 다시 시도해 주세요.", trackingType: "server_error" });
        return;
      }
      requestRef.current = null;
      navigate(analysisPendingPath(result.receipt.analysisRequestId));
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return <main className="min-h-screen bg-[#0A0A0A]" aria-busy="true" />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28">
      <AnalyzeNav />

      {/* ════════ MAIN FORM ════════ */}
      <motion.section className="py-12 md:py-20" variants={ANALYZE_CONTAINER_VARIANTS} initial="hidden" animate="visible">
        <div className="container max-w-3xl mx-auto px-4">
          <motion.div className="text-center mb-12" variants={ANALYZE_ITEM_VARIANTS}>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">기업 분석 리포트</h1>
            <p className="text-zinc-500 text-base md:text-lg leading-relaxed max-w-xl mx-auto break-keep">
              회사와 직무를 고르면, 돈 버는 구조부터 맡고 싶은 사업 후보까지 지원자의 시선으로 정리해 드려요.
            </p>
          </motion.div>

          {summary && (
            <motion.div variants={ANALYZE_ITEM_VARIANTS} className="mb-6 flex flex-wrap items-center justify-center gap-2 text-[13px]">
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

          <FormSection icon={Building2} accent required title="회사와 직무">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2.5 uppercase tracking-wider">회사</label>
              <CompanyCombobox value={company} onChange={setCompany} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wider">직무</label>
              <JobRoleCombobox value={jobKeyword} onChange={setJobKeyword} />
            </div>
          </FormSection>

          <FormSection icon={FileText} title="채용공고 붙여넣기">
            <div>
              <Textarea
                value={postingText}
                onChange={event => setPostingText(event.target.value.slice(0, MAX_POSTING_CHARS))}
                placeholder="수행직무·자격요건을 붙여 넣으면 '이 직무의 자리' 섹션이 채용공고 문장을 해석해 드려요."
                className="min-h-[160px] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-600 rounded-xl text-[15px] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-2 text-right text-xs text-zinc-600 tabular-nums">{postingText.length.toLocaleString()} / {MAX_POSTING_CHARS.toLocaleString()}</p>
            </div>
          </FormSection>

          {previousResumes.length > 0 && (
            <FormSection icon={Link2} title="내 자소서 분석과 연결" className="space-y-5">
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
            </FormSection>
          )}
        </div>
      </motion.section>

      {/* ════════ BOTTOM BAR ════════ */}
      <AnalyzeBottomBar>
        <div className="h-[72px] flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-500 break-keep">검색과 정리에 1분 정도 걸려요. 실패하면 이용권은 차감되지 않아요.</p>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            size="lg"
            className={ANALYZE_SUBMIT_BUTTON_CLASS}
          >
            {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />접수 중...</>) : (<>기업 분석 시작</>)}
          </Button>
        </div>
      </AnalyzeBottomBar>

      <AnalyzeErrorModal error={errorModal} onClose={() => setErrorModal(null)} />
    </div>
  );
}
