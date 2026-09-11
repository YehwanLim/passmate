import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

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
import { ReportClosing } from "@/components/report/sections/ReportClosing";
import { UI_LABELS } from "@/constants/labels";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalysisReport } from "@/hooks/useAnalysisReport";
import { useFeedbackRewardAvailable } from "@/hooks/useFeedbackRewardAvailable";
import { useScrollSpy } from "@/hooks/useScrollSpy";
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
import { REPORT_NAV_SECTIONS } from "./reportNavigation";

function getFallbackDisplayName(user: { name?: string | null; email?: string | null } | null) {
  const authName = user?.name?.trim();
  if (authName) return authName;

  const emailName = user?.email?.split("@")[0]?.trim();
  if (emailName) return emailName;

  return "지원자";
}

// ReportContent가 역참조하는 최상위 필드를 렌더 전에 확인한다.
// 과거 스키마·불완전 생성 리포트가 TypeError(화이트스크린)로 이어지는 것을 막는다.
function isRenderableReport(payload: unknown): payload is ReportData {
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
  displayName,
}: LoadedReport & { displayName: string }) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const feedbackRewardAvailable = useFeedbackRewardAvailable();
  const activeSection = useScrollSpy(REPORT_NAV_SECTIONS);
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

  const isLockedFromSection = (sectionIndex: number) =>
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
      <MiniNavigator sections={REPORT_NAV_SECTIONS} activeSection={activeSection} />

      <ReportTopNav
        className="print:hidden"
        sections={REPORT_NAV_SECTIONS}
        activeSection={activeSection}
        backLabel={UI_LABELS.BACK}
        actions={
          <button className={REPORT_NAV_ACTION_CLASS} onClick={() => navigate("/my")}>
            내 지원서
          </button>
        }
      />

      <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10 pt-4">
        <FeedbackRewardBanner
          analysisId={activeAnalysisId}
          rewardAvailable={feedbackRewardAvailable}
        />

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
          <CoreDiagnosisSection
            targetCompany={targetCompany}
            strengthEntries={strengthEntries}
            gapEntries={gapEntries}
            strengthHighlights={strengthHighlights}
            gapHighlights={gapHighlights}
            positioning={reportData.positioning}
          />
        </ReportAccessGate>
      </article>

      <ReportAccessGate isLocked={isLockedFromSection(3)} onLogin={handleLoginToUnlock} showOverlay={false}>
        <LineAnalysisSection
          questionTabs={reportData.questionTabs}
          targetCompany={targetCompany}
          displayName={displayName}
          isPrinting={isPrinting}
        />
      </ReportAccessGate>

      <ReportAccessGate isLocked={isLockedFromSection(4)} onLogin={handleLoginToUnlock} showOverlay={false}>
        <article className="max-w-4xl mx-auto px-6 md:px-8 pb-10">
          <InterviewDrillSection items={reportData.interviewQA} isPrinting={isPrinting} />
          <ActionPlanSection tasks={reportData.actionPlan} />
          <MentorCommentSection blocks={mentorCommentBlocks} />

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
        </article>
      </ReportAccessGate>
    </main>
  );
}

export default function PassMateReport() {
  return (
    <ReportAuthGate loginRedirect="/report-new" message="로그인 후 분석 리포트를 확인할 수 있어요.">
      <AuthenticatedReport />
    </ReportAuthGate>
  );
}
