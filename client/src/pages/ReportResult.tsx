import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLocation, useSearch } from "wouter";

import FeedbackRewardBanner from "@/components/FeedbackRewardBanner";
import FeedbackSection from "@/components/FeedbackSection";
import { MiniNavigator } from "@/components/report/MiniNavigator";
import { REPORT_NAV_ACTION_CLASS, ReportTopNav } from "@/components/report/ReportTopNav";
import { ReportAccessGate } from "@/components/report/ReportAccessGate";
import { ReportAuthGate } from "@/components/report/ReportAuthGate";
import { ActionPlanSection } from "@/components/report/sections/ActionPlanSection";
import { CompanyInsightSection } from "@/components/report/sections/CompanyInsightSection";
import { CoreDiagnosisSection } from "@/components/report/sections/CoreDiagnosisSection";
import { FirstImpressionSection } from "@/components/report/sections/FirstImpressionSection";
import { InterviewDrillSection } from "@/components/report/sections/InterviewDrillSection";
import { LineAnalysisSection } from "@/components/report/sections/LineAnalysisSection";
import { MentorCommentSection } from "@/components/report/sections/MentorCommentSection";
import { PostingFitSection } from "@/components/report/sections/PostingFitSection";
import { ReportClosing } from "@/components/report/sections/ReportClosing";
import { UI_LABELS } from "@/constants/labels";
import { RESUME_REPORT_SAMPLE } from "@/constants/resumeReportSample";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalysisReport } from "@/hooks/useAnalysisReport";
import { useFeedbackRewardAvailable } from "@/hooks/useFeedbackRewardAvailable";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import type { JobPostingRecord } from "@/types/jobPosting";
import type { ReportData } from "@/types/report";
import { isReportSectionLocked } from "@/utils/reportAccess";
import {
  buildEditorialKeywords,
  getHeroIdentity,
  getHeroSummary,
  limitSectionHighlights,
  normalizeDiagnosisEntries,
  resolveHiringMemoryItems,
  splitMentorComment,
  splitPersonaForHeroLines,
} from "./reportFirstImpression";
import { buildReportNavSections } from "./reportNavigation";
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
      <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-zinc-400">
        분석 리포트를 불러오는 중이에요.
      </main>
    );
  }

  if (error || !data || !data.activeAnalysisId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6 text-center text-sm text-red-400">
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
  // 공고 적합도가 있으면 목차에 한 칸 끼어들고 뒤 섹션 번호가 밀린다. 섹션 번호는 목차에서만 읽는다.
  const hasPostingFit = isPostingFitRenderable(reportData.postingFit);
  const navSections = useMemo(() => buildReportNavSections({ hasPostingFit }), [hasPostingFit]);
  const indexLabelOf = (id: string) => navSections.find((section) => section.id === id)?.indexLabel ?? "";
  const activeSection = useScrollSpy(navSections);
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

  // 예시 리포트는 전체를 보여 준다. 비로그인에게 03 이후를 잠그는 건 실제 리포트용 규칙이다.
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
  const editorialKeywords = useMemo(
    () => buildEditorialKeywords({
      hashtags: reportData.firstImpression.hashtags,
      talentKeywords: reportData.companyInsight.talentKeywords,
    }),
    [reportData.companyInsight.talentKeywords, reportData.firstImpression.hashtags],
  );
  const hiringMemoryItems = useMemo(
    () => resolveHiringMemoryItems({
      hiringMemory: reportData.firstImpression.hiringMemory,
      strengths: reportData.strengths,
      gaps: reportData.gaps,
    }),
    [reportData.firstImpression.hiringMemory, reportData.gaps, reportData.strengths],
  );
  const strengthEntries = useMemo(() => normalizeDiagnosisEntries(reportData.strengths), [reportData.strengths]);
  const gapEntries = useMemo(() => normalizeDiagnosisEntries(reportData.gaps), [reportData.gaps]);
  const strengthHighlights = useMemo(
    () => limitSectionHighlights(strengthEntries.map((entry) => entry.text)),
    [strengthEntries],
  );
  const gapHighlights = useMemo(
    () => limitSectionHighlights(gapEntries.map((entry) => entry.text)),
    [gapEntries],
  );
  const mentorCommentBlocks = useMemo(() => splitMentorComment(reportData.pmComment), [reportData.pmComment]);

  return (
    <main className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-indigo-500/20">
      <MiniNavigator sections={navSections} activeSection={activeSection} />

      <ReportTopNav
        className="print:hidden"
        sections={navSections}
        activeSection={activeSection}
        backLabel={UI_LABELS.BACK}
        actions={
          sample ? (
            <button className={REPORT_NAV_ACTION_CLASS} onClick={() => navigate("/analyze")}>
              내 자소서 분석하기
            </button>
          ) : (
            <button className={REPORT_NAV_ACTION_CLASS} onClick={() => navigate("/my")}>
              내 지원서
            </button>
          )
        }
      />

      <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10 pt-4">
        {sample ? (
          <div role="note" className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-zinc-300">
            <span className="font-semibold text-white">예시 리포트 · {targetCompany} {targetJobRole}</span>
            <span className="text-zinc-400 text-pretty">가상의 지원자 {displayName}님의 자소서를 읽은 결과예요. 내 자소서를 넣으면 같은 구성으로 새로 만들어져요.</span>
          </div>
        ) : (
          <FeedbackRewardBanner
            analysisId={activeAnalysisId}
            rewardAvailable={feedbackRewardAvailable}
          />
        )}

        <FirstImpressionSection
          displayName={displayName}
          targetCompany={targetCompany}
          heroPersona={heroPersona}
          heroPersonaLines={heroPersonaLines}
          heroSummary={heroSummary}
          editorialKeywords={editorialKeywords}
          hiringMemoryItems={hiringMemoryItems}
          profileNote={reportData.firstImpression.profileNote}
          mentorCommentBlocks={mentorCommentBlocks}
        />

        <CompanyInsightSection targetCompany={targetCompany} companyInsight={reportData.companyInsight} />

        <ReportAccessGate isLocked={isLockedFromSection(2)} onLogin={handleLoginToUnlock}>
          {hasPostingFit ? (
            <PostingFitSection
              postingFit={reportData.postingFit as NonNullable<ReportData["postingFit"]>}
              jobPosting={jobPosting}
              indexLabel={indexLabelOf("section-posting-fit")}
            />
          ) : null}
          <CoreDiagnosisSection
            targetCompany={targetCompany}
            strengthEntries={strengthEntries}
            gapEntries={gapEntries}
            strengthHighlights={strengthHighlights}
            gapHighlights={gapHighlights}
            positioning={reportData.positioning}
            indexLabel={indexLabelOf("section-core-diagnosis")}
          />
        </ReportAccessGate>
      </article>

      <ReportAccessGate isLocked={isLockedFromSection(3)} onLogin={handleLoginToUnlock} showOverlay={false}>
        <LineAnalysisSection
          questionTabs={reportData.questionTabs}
          targetCompany={targetCompany}
          displayName={displayName}
          isPrinting={isPrinting}
          indexLabel={indexLabelOf("section-line-analysis")}
        />
      </ReportAccessGate>

      <ReportAccessGate isLocked={isLockedFromSection(4)} onLogin={handleLoginToUnlock} showOverlay={false}>
        <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10">
          <InterviewDrillSection items={reportData.interviewQA} isPrinting={isPrinting} indexLabel={indexLabelOf("section-interview-drill")} />
          <ActionPlanSection tasks={reportData.actionPlan} indexLabel={indexLabelOf("section-action-plan")} />
          <MentorCommentSection blocks={mentorCommentBlocks} indexLabel={indexLabelOf("section-pm-comment")} />

          {sample ? (
            <section className="print:hidden mt-16 mb-10 rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-10 text-center md:px-10">
              <h3 className="text-xl font-medium text-white text-balance">내 자소서는 어떻게 읽힐까요?</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-400 text-pretty">
                지원할 회사와 직무, 자소서를 넣으면 이 구성 그대로 1분 안에 리포트를 드려요. 첫 분석은 무료예요.
              </p>
              <button
                onClick={() => navigate("/analyze")}
                className="mx-auto mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 font-medium text-zinc-900 transition-colors hover:bg-zinc-200 sm:w-auto"
              >
                <span>내 자소서 분석하기</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </section>
          ) : (
            <>
              <div className="print:hidden">
                <FeedbackSection
                  analysisId={activeAnalysisId}
                  rewardAvailable={feedbackRewardAvailable}
                />
              </div>

              <ReportClosing
                targetCompany={targetCompany}
                targetJobRole={targetJobRole}
                activeAnalysisId={activeAnalysisId}
                onPrint={() => setIsPrinting(true)}
              />
            </>
          )}
        </article>
      </ReportAccessGate>
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
