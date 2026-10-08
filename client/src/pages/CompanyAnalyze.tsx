import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

import CompanyCombobox from "@/components/analyze/CompanyCombobox";
import JobRoleCombobox from "@/components/analyze/JobRoleCombobox";
import ResumeLinkSelect from "@/components/analyze/ResumeLinkSelect";
import {
  ANALYZE_BIG_SUBMIT_BUTTON_CLASS,
  AnalyzeBottomBar,
  AnalyzeErrorModal,
} from "@/components/analyze/AnalyzeShell";
import SiteHeader from "@/components/SiteHeader";
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
    return <main className="min-h-screen bg-stage" aria-busy="true" />;
  }

  const headingText = [company.trim(), jobKeyword.trim()].filter(Boolean).join(" ");
  const sideLabel = "block text-[12.5px] font-semibold text-ink-4 mb-1.5";

  return (
    <div className="min-h-screen bg-stage pb-36">
      <SiteHeader variant="light" />

      {/* 위 막대: 자소서 분석·지원서 작성 화면과 같은 자리. 오른쪽에 남은 기업 분석 이용권. */}
      <div className="sticky top-14 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="container flex h-14 max-w-6xl items-center justify-between gap-3">
          <h1 className="truncate text-[16px] font-bold tracking-[-0.02em] text-ink">기업 분석</h1>
          {summary && (
            <p className="shrink-0 text-[13px] text-ink-3">
              기업 분석 이용권 <span className="font-bold tabular-nums text-ink">{summary.companyRemaining}회</span>
            </p>
          )}
        </div>
      </div>

      <div className="container max-w-6xl pt-6">
        {summary && (!summary.companyAnalysisEnabled || summary.companyRemaining === 0) && (
          <p className="mb-4 rounded-2xl bg-blank-soft px-4 py-3 text-[13.5px] font-semibold text-blank">
            {!summary.companyAnalysisEnabled ? "준비 중인 기능이에요. 관리자 확인 후 열립니다." : "보유한 기업 분석 이용권이 없어요."}
          </p>
        )}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* 왼쪽: 원고지 자리에 채용공고 — 문항이 없어 번호 탭은 없다 */}
          <section className="flex min-h-[520px] min-w-0 flex-col rounded-[18px] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="border-b border-dashed border-line px-5 py-4 sm:px-7">
              <p className="truncate text-[15px] font-bold text-brand-ink">{headingText || "기업 분석 리포트"}</p>
              <p className="mt-1 text-[13px] leading-[1.6] text-ink-4 break-keep">
                회사와 직무를 고르면, 돈 버는 구조부터 맡고 싶은 사업 후보까지 지원자의 시선으로 정리해 드려요.
              </p>
            </div>
            <div className="px-5 pt-5 sm:px-7">
              <h2 className="text-[16px] font-semibold text-ink">채용공고 붙여넣기 <span className="text-[13px] font-medium text-ink-5">선택</span></h2>
            </div>
            <textarea
              value={postingText}
              onChange={event => setPostingText(event.target.value.slice(0, MAX_POSTING_CHARS))}
              placeholder="수행직무·자격요건을 붙여 넣으면 '이 직무의 자리' 섹션이 채용공고 문장을 해석해 드려요."
              aria-label="채용공고 붙여넣기"
              className="min-h-[340px] w-full flex-1 resize-y border-0 bg-transparent px-5 py-4 text-[15px] leading-[1.8] text-ink placeholder:text-ink-5 focus:outline-none sm:px-7"
            />
            <div className="border-t border-line-soft px-5 py-3.5 sm:px-7">
              <p className="text-[20px] font-extrabold tabular-nums text-ink">
                {postingText.length.toLocaleString()}
                <span className="ml-1 text-[15px] font-semibold text-ink-4">/ {MAX_POSTING_CHARS.toLocaleString()}</span>
              </p>
            </div>
          </section>

          {/* 오른쪽: 지원 정보 · 내 자소서 분석과 연결 (넓은 화면에서는 따라 내려온다) */}
          <aside className="space-y-4 lg:sticky lg:top-32">
            <section className="space-y-3 rounded-[18px] bg-surface p-5">
              <h2 className="text-[15px] font-bold text-ink">지원 정보</h2>
              <div>
                <label className={sideLabel}>회사 *</label>
                <CompanyCombobox compact ariaLabel="회사" value={company} onChange={setCompany} placeholder="예: CJ제일제당" />
              </div>
              <div>
                <label className={sideLabel}>직무 *</label>
                <JobRoleCombobox compact ariaLabel="직무" value={jobKeyword} onChange={setJobKeyword} placeholder="예: 마케팅" />
              </div>
            </section>

            {previousResumes.length > 0 && (
              <section className="space-y-2.5 rounded-[18px] bg-surface p-5">
                <h2 className="text-[15px] font-bold text-ink">내 자소서 분석과 연결</h2>
                <ResumeLinkSelect resumes={previousResumes} value={resumeAnalysisId} onChange={setResumeAnalysisId} />
                <p className="text-xs text-ink-5">연결하면 리포트 안에서 자소서 분석으로 바로 이동할 수 있어요.</p>
              </section>
            )}
          </aside>
        </div>
      </div>

      {/* ════════ BOTTOM BAR ════════ */}
      <AnalyzeBottomBar wide>
        <div className="flex h-[84px] items-center justify-between gap-4">
          <p className="hidden text-xs text-ink-4 break-keep sm:block">검색과 정리에 1분 정도 걸려요. 실패하면 이용권은 차감되지 않아요.</p>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className={ANALYZE_BIG_SUBMIT_BUTTON_CLASS}
          >
            {isLoading ? (
              <span className="inline-flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" />접수 중...</span>
            ) : (
              <>기업 분석하기</>
            )}
          </button>
        </div>
      </AnalyzeBottomBar>

      <AnalyzeErrorModal error={errorModal} onClose={() => setErrorModal(null)} />
    </div>
  );
}
