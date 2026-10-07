import { useMemo } from "react";

import { CompanyInsightSection } from "@/components/report/sections/CompanyInsightSection";
import { CoreDiagnosisSection } from "@/components/report/sections/CoreDiagnosisSection";
import { FirstImpressionSection } from "@/components/report/sections/FirstImpressionSection";
import { InterviewDrillSection } from "@/components/report/sections/InterviewDrillSection";
import { LineAnalysisSection } from "@/components/report/sections/LineAnalysisSection";
import { PostingFitSection } from "@/components/report/sections/PostingFitSection";
import { ReportBlock } from "@/components/report/sections/ReportBlock";
import { UI_LABELS } from "@/constants/labels";
import { RESUME_REPORT_SAMPLE } from "@/constants/resumeReportSample";
import {
  buildEditorialKeywords,
  getHeroIdentity,
  getHeroSummary,
  limitSectionHighlights,
  normalizeDiagnosisEntries,
  resolveHiringMemoryItems,
  splitPersonaForHeroLines,
} from "@/pages/reportFirstImpression";
import { buildReportNavSections } from "@/pages/reportNavigation";
import type { ReportData } from "@/types/report";

import type { PreviewSceneId } from "./reportShowcaseSampleData";

/**
 * 랜딩 쇼케이스의 한 장면 = 실제 예시 리포트(/report-new?sample=1)의 한 섹션.
 * 그림을 따로 그리지 않고 ReportResult 와 같은 섹션 컴포넌트·같은 예시 데이터를 렌더한다 —
 * 리포트 디자인이 바뀌면 랜딩 미리보기도 그대로 따라간다. 값 가공은 ReportResult 와 같은 함수를 쓴다.
 */
export default function LiveReportPreview({ sceneId }: { sceneId: PreviewSceneId }) {
  const { report, company, displayName, jobPosting } = RESUME_REPORT_SAMPLE;
  const navSections = useMemo(() => buildReportNavSections({ hasPostingFit: Boolean(report.postingFit) }), [report.postingFit]);
  const indexOf = (id: string) => navSections.find(section => section.id === id)?.indexLabel ?? "";

  switch (sceneId) {
    case "impression": {
      const heroPersona = getHeroIdentity(report.firstImpression.persona, report.firstImpression.hashtags);
      return (
        <FirstImpressionSection
          index={indexOf("section-first-impression")}
          displayName={displayName}
          heroPersona={heroPersona}
          heroPersonaLines={splitPersonaForHeroLines(heroPersona)}
          heroSummary={getHeroSummary(report.firstImpression.summaryOneLiner)}
          keywords={buildEditorialKeywords({
            hashtags: report.firstImpression.hashtags,
            talentKeywords: report.companyInsight.talentKeywords,
          })}
          hiringMemoryItems={resolveHiringMemoryItems({
            hiringMemory: report.firstImpression.hiringMemory,
            strengths: report.strengths,
            gaps: report.gaps,
          })}
          profileNote={report.firstImpression.profileNote}
        />
      );
    }
    case "criteria":
      return (
        <ReportBlock
          id="section-company-insight"
          index={indexOf("section-company-insight")}
          label={UI_LABELS.DETAILS_HIRING_CRITERIA}
          title={UI_LABELS.HIRING_CRITERIA(company)}
        >
          <CompanyInsightSection companyInsight={report.companyInsight} />
        </ReportBlock>
      );
    case "posting-fit":
      return report.postingFit ? (
        <ReportBlock
          id="section-posting-fit"
          index={indexOf("section-posting-fit")}
          label={UI_LABELS.DETAILS_POSTING_FIT}
          title={UI_LABELS.POSTING_FIT_TITLE}
        >
          <PostingFitSection postingFit={report.postingFit as NonNullable<ReportData["postingFit"]>} jobPosting={jobPosting} />
        </ReportBlock>
      ) : null;
    case "diagnosis": {
      const strengthEntries = normalizeDiagnosisEntries(report.strengths);
      const gapEntries = normalizeDiagnosisEntries(report.gaps);
      return (
        <ReportBlock
          id="section-core-diagnosis"
          index={indexOf("section-core-diagnosis")}
          label={UI_LABELS.REPORT_NAV_CORE_DIAGNOSIS}
          title={UI_LABELS.STRENGTHS_AND_GAPS(company)}
        >
          <CoreDiagnosisSection
            strengthEntries={strengthEntries}
            gapEntries={gapEntries}
            strengthHighlights={limitSectionHighlights(strengthEntries.map(entry => entry.text))}
            gapHighlights={limitSectionHighlights(gapEntries.map(entry => entry.text))}
            positioning={report.positioning}
          />
        </ReportBlock>
      );
    }
    case "line":
      return (
        <LineAnalysisSection
          index={indexOf("section-line-analysis")}
          questionTabs={report.questionTabs}
          targetCompany={company}
          displayName={displayName}
          isPrinting={false}
        />
      );
    case "interview":
      return (
        <ReportBlock
          id="section-interview-drill"
          index={indexOf("section-interview-drill")}
          label={UI_LABELS.DETAILS_INTERVIEW}
          count={report.interviewQA.length}
          title={UI_LABELS.INTERVIEW_DRILL_TITLE}
          description={UI_LABELS.INTERVIEW_DRILL_DESC}
        >
          <InterviewDrillSection items={report.interviewQA} isPrinting={false} />
        </ReportBlock>
      );
  }
}
