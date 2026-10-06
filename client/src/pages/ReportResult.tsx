import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLocation, useSearch } from "wouter";

import FeedbackRewardBanner from "@/components/FeedbackRewardBanner";
import FeedbackSection from "@/components/FeedbackSection";
import SiteHeader from "@/components/SiteHeader";
import { ReportAccessGate } from "@/components/report/ReportAccessGate";
import { ReportAuthGate } from "@/components/report/ReportAuthGate";
import { ActionPlanSection } from "@/components/report/sections/ActionPlanSection";
import { CompanyInsightSection } from "@/components/report/sections/CompanyInsightSection";
import { InterviewDrillSection } from "@/components/report/sections/InterviewDrillSection";
import { LineAnalysisSection } from "@/components/report/sections/LineAnalysisSection";
import { MentorCommentSection } from "@/components/report/sections/MentorCommentSection";
import { PostingFitSection } from "@/components/report/sections/PostingFitSection";
import { ReportClosing } from "@/components/report/sections/ReportClosing";
import { ReportDetailsSection, type ReportDetailItem } from "@/components/report/sections/ReportDetailsSection";
import { ReportSummarySection } from "@/components/report/sections/ReportSummarySection";
import { UI_LABELS } from "@/constants/labels";
import { RESUME_REPORT_SAMPLE } from "@/constants/resumeReportSample";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalysisReport } from "@/hooks/useAnalysisReport";
import { useFeedbackRewardAvailable } from "@/hooks/useFeedbackRewardAvailable";
import type { JobPostingRecord } from "@/types/jobPosting";
import type { ReportData } from "@/types/report";
import { isReportSectionLocked } from "@/utils/reportAccess";
import {
  getHeroIdentity,
  getHeroSummary,
  normalizeDiagnosisEntries,
  splitMentorComment,
  splitPersonaForHeroLines,
} from "./reportFirstImpression";
import { isPostingFitRenderable } from "./reportPostingFit";

function getFallbackDisplayName(user: { name?: string | null; email?: string | null } | null) {
  const authName = user?.name?.trim();
  if (authName) return authName;

  const emailName = user?.email?.split("@")[0]?.trim();
  if (emailName) return emailName;

  return "지원자";
}

// ReportContent가 역참조하는 최상위 필드를 렌더 전에 확인한다.
// 과거 스키마·불완전 생성 리포트가 TypeError(화이트스크린)로 이어지는 것을 막는다.
export function isRenderableReport(payload: unknown): payload is ReportData {
  if (!payload || typeof payload !== "object") return false;
  const report = payload as Record<string, unknown>;
  const companyInsight = report.companyInsight as Record<string, unknown> | null | undefined;
  return (
    Array.isArray(report.questionTabs) &&
    Array.isArray(report.actionPlan) &&
    Array.isArray(report.strengths) &&
    Array.isArray(report.gaps) &&
    !!report.firstImpression &&
    typeof report.firstImpression === "object" &&
    !!companyInsight &&
    typeof companyInsight === "object" &&
    Array.isArray(companyInsight.talentKeywords)
  );
}

interface LoadedReport {
  reportData: ReportData;
  activeAnalysisId: string;
  targetCompany: string;
  targetJobRole: string;
  /** 채용공고를 붙여 분석한 리포트에만 있다. 공고 적합도 섹션의 부제(회사 · 직무 · 출처)에 쓴다. */
  jobPosting?: JobPostingRecord | null;
  /** 로그인 없이 보는 공개 예시(/report-new?sample=1). 잠금·피드백·업셀 대신 분석 시작 CTA를 둔다. */
  sample?: boolean;
}

const MISSING_MESSAGE = "분석 리포트를 찾을 수 없습니다.";
const FAILED_MESSAGE = "분석 리포트를 불러오지 못했습니다.";

function AuthenticatedReport() {
  const { user } = useAuth();
  const requestedAnalysisId = new URLSearchParams(window.location.search).get("analysisId");
  const { data, isLoading, error } = useAnalysisReport<LoadedReport>(requestedAnalysisId, {
    missingMessage: MISSING_MESSAGE,
    failedMessage: FAILED_MESSAGE,
    parse: (payload) => {
      if (!isRenderableReport(payload?.ai_response_json)) {
        throw new Error("저장된 분석 리포트 형식이 올바르지 않습니다.");
      }
      return {
        reportData: payload.ai_response_json as ReportData,
        activeAnalysisId: payload.id ?? requestedAnalysisId ?? "",
        targetCompany: payload.company_name ?? "",
        targetJobRole: payload.job_role ?? "",
        jobPosting: payload.job_posting
          ? { id: payload.job_posting.id, sourceUrl: payload.job_posting.source_url, summary: payload.job_posting.summary }
          : null,
      };
    },
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stage px-6 text-center text-sm text-ink-4">
        분석 리포트를 불러오는 중이에요.
      </main>
    );
  }

  if (error || !data || !data.activeAnalysisId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stage px-6 text-center text-sm text-danger">
        {error ?? FAILED_MESSAGE}
      </main>
    );
  }

  return <ReportContent {...data} displayName={getFallbackDisplayName(user)} />;
}

function ReportContent({
  reportData,
  activeAnalysisId,
  targetCompany,
  targetJobRole,
  jobPosting = null,
  displayName,
  sample = false,
}: LoadedReport & { displayName: string }) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const feedbackRewardAvailable = useFeedbackRewardAvailable();
  const hasPostingFit = isPostingFitRenderable(reportData.postingFit);
  const [isPrinting, setIsPrinting] = useState(false);

  // 접힌 항목을 모두 펼쳐 렌더한 다음 프레임에 브라우저 인쇄(→ PDF 저장)를 연다.
  useEffect(() => {
    if (!isPrinting) return;
    const raf = requestAnimationFrame(() => {
      window.print();
      setIsPrinting(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [isPrinting]);

  // 예시 리포트는 전체를 보여 준다. 비로그인에게 요약 아래를 잠그는 건 실제 리포트용 규칙이다
  // (잠글지는 로그인 여부로만 정해진다 — utils/reportAccess). 첫 잠금 칸에만 로그인 안내를 띄운다.
  const isLockedFromSection = (sectionIndex: number) =>
    !sample &&
    isReportSectionLocked({
      sectionIndex,
      isAuthenticated,
    });

  const handleLoginToUnlock = useCallback(() => {
    navigate(`/login?redirect=${encodeURIComponent("/report-new")}`);
  }, [navigate]);

  const heroPersona = useMemo(
    () => getHeroIdentity(reportData.firstImpression.persona, reportData.firstImpression.hashtags),
    [reportData.firstImpression.hashtags, reportData.firstImpression.persona],
  );
  const heroPersonaLines = useMemo(() => splitPersonaForHeroLines(heroPersona), [heroPersona]);
  const heroSummary = useMemo(
    () => getHeroSummary(reportData.firstImpression.summaryOneLiner),
    [reportData.firstImpression.summaryOneLiner],
  );
  const strengthEntries = useMemo(() => normalizeDiagnosisEntries(reportData.strengths), [reportData.strengths]);
  const gapEntries = useMemo(() => normalizeDiagnosisEntries(reportData.gaps), [reportData.gaps]);
  const mentorCommentBlocks = useMemo(() => splitMentorComment(reportData.pmComment), [reportData.pmComment]);

  const detailItems: ReportDetailItem[] = [
    {
      key: "interview",
      title: UI_LABELS.DETAILS_INTERVIEW,
      count: reportData.interviewQA.length,
      preview: UI_LABELS.INTERVIEW_DRILL_TITLE,
      content: <InterviewDrillSection items={reportData.interviewQA} isPrinting={isPrinting} />,
    },
    ...(hasPostingFit
      ? [{
          key: "posting-fit",
          title: UI_LABELS.DETAILS_POSTING_FIT,
          preview: UI_LABELS.POSTING_FIT_TITLE,
          content: (
            <PostingFitSection
              postingFit={reportData.postingFit as NonNullable<ReportData["postingFit"]>}
              jobPosting={jobPosting}
            />
          ),
        }]
      : []),
    {
      key: "hiring-criteria",
      title: UI_LABELS.DETAILS_HIRING_CRITERIA,
      preview: UI_LABELS.HIRING_CRITERIA(targetCompany),
      content: <CompanyInsightSection companyInsight={reportData.companyInsight} />,
    },
    {
      key: "action-plan",
      title: UI_LABELS.DETAILS_ACTION_PLAN,
      count: reportData.actionPlan.length,
      preview: UI_LABELS.ACTION_PLAN_TITLE,
      content: <ActionPlanSection tasks={reportData.actionPlan} />,
    },
    ...(mentorCommentBlocks.length > 0
      ? [{
          key: "pm-comment",
          title: UI_LABELS.DETAILS_PM_COMMENT,
          preview: UI_LABELS.PM_VERDICT_TITLE,
          content: <MentorCommentSection blocks={mentorCommentBlocks} />,
        }]
      : []),
  ];

  const questionCount = reportData.questionTabs.length;
  const reportMeta = [
    `${displayName}님`,
    questionCount > 0 ? `문항 ${questionCount}개` : null,
    hasPostingFit ? "채용공고 포함" : null,
  ].filter(Boolean).join(" · ");
  const actionButtonClass = "inline-flex h-11 items-center justify-center rounded-xl px-[18px] text-[15px] font-semibold transition-colors";

  return (
    <main className="min-h-screen bg-stage font-sans text-ink">
      <div className="print:hidden">
        <SiteHeader variant="light" />
      </div>

      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 pb-24 pt-10 sm:px-6 lg:px-0">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink-4">{UI_LABELS.REPORT_EYEBROW}</p>
            <p className="mt-1.5 text-[26px] font-bold leading-[1.3] tracking-[-0.02em] text-ink sm:text-[28px]">
              {[targetCompany, targetJobRole].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1.5 text-[14px] text-ink-4">{reportMeta}</p>
          </div>
          <div className="flex shrink-0 gap-2 print:hidden">
            {sample ? (
              <button className={`${actionButtonClass} bg-brand text-white hover:bg-brand-hover`} onClick={() => navigate("/analyze")}>
                내 자소서 분석하기
              </button>
            ) : (
              <>
                <button className={`${actionButtonClass} bg-fill text-ink-2 hover:bg-line`} onClick={() => navigate("/my")}>
                  내 지원서
                </button>
                <button className={`${actionButtonClass} border border-line bg-surface text-ink-2 hover:bg-fill-soft`} onClick={() => setIsPrinting(true)}>
                  {UI_LABELS.SAVE_REPORT}
                </button>
              </>
            )}
          </div>
        </header>

        {sample ? (
          <div role="note" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl bg-surface px-5 py-3.5 text-[14px] print:hidden">
            <span className="font-bold text-ink">예시 리포트 · {targetCompany} {targetJobRole}</span>
            <span className="text-ink-3 text-pretty">가상의 지원자 {displayName}님의 자소서를 읽은 결과예요. 내 자소서를 넣으면 같은 구성으로 새로 만들어져요.</span>
          </div>
        ) : (
          <FeedbackRewardBanner
            analysisId={activeAnalysisId}
            rewardAvailable={feedbackRewardAvailable}
          />
        )}

        <ReportSummarySection
          heroPersonaLines={heroPersonaLines}
          heroSummary={heroSummary}
          strengthEntries={strengthEntries}
          gapEntries={gapEntries}
          positioning={reportData.positioning}
        />

        <ReportAccessGate isLocked={isLockedFromSection(2)} onLogin={handleLoginToUnlock}>
          <LineAnalysisSection
            questionTabs={reportData.questionTabs}
            targetCompany={targetCompany}
            displayName={displayName}
            isPrinting={isPrinting}
          />
        </ReportAccessGate>

        <ReportAccessGate isLocked={isLockedFromSection(3)} onLogin={handleLoginToUnlock} showOverlay={false}>
          <ReportDetailsSection items={detailItems} isPrinting={isPrinting} />

          {sample ? (
            <section className="rounded-3xl bg-surface px-6 py-10 text-center print:hidden md:px-10">
              <h3 className="text-[20px] font-bold text-ink text-balance">내 자소서는 어떻게 읽힐까요?</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-3 text-pretty">
                지원할 회사와 직무, 자소서를 넣으면 이 구성 그대로 1분 안에 리포트를 드려요. 첫 분석은 무료예요.
              </p>
              <button
                onClick={() => navigate("/analyze")}
                className="mx-auto mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-bold text-white transition-colors hover:bg-brand-hover sm:w-auto"
              >
                <span>내 자소서 분석하기</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </section>
          ) : (
            <>
              <FeedbackSection
                analysisId={activeAnalysisId}
                rewardAvailable={feedbackRewardAvailable}
              />

              <ReportClosing
                targetCompany={targetCompany}
                targetJobRole={targetJobRole}
                activeAnalysisId={activeAnalysisId}
                onPrint={() => setIsPrinting(true)}
              />
            </>
          )}
        </ReportAccessGate>
      </div>
    </main>
  );
}

export default function PassMateReport() {
  // 공개 예시는 로그인·조회 없이 굳힌 상수를 그대로 렌더한다(CompanyReport 의 ?sample=1 과 같은 방식).
  // window 대신 wouter 의 search 를 읽어야 빌드 시점 프리렌더(entry-server.tsx)에서도 같은 분기를 탄다.
  const isSample = new URLSearchParams(useSearch()).get("sample") === "1";
  if (isSample) {
    return (
      <ReportContent
        reportData={RESUME_REPORT_SAMPLE.report}
        activeAnalysisId="sample"
        targetCompany={RESUME_REPORT_SAMPLE.company}
        targetJobRole={RESUME_REPORT_SAMPLE.jobRole}
        jobPosting={RESUME_REPORT_SAMPLE.jobPosting}
        displayName={RESUME_REPORT_SAMPLE.displayName}
        sample
      />
    );
  }

  return (
    <ReportAuthGate loginRedirect="/report-new" message="로그인 후 분석 리포트를 확인할 수 있어요.">
      <AuthenticatedReport />
    </ReportAuthGate>
  );
}
