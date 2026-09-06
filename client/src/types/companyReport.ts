// =============================================================================
// 기업 분석 리포트 — 타입 정의와 렌더 가능 검증
// 서버 shared/prompts/companyReportPrompt.js 의 JSON 스키마와 1:1. sources/reportMeta 는 서버가 붙인다.
// =============================================================================

export interface CompanyBrief {
  oneLiner: string;
  keywords: string[];
  asOf: string;
  positionInIndustry: string;
}

export interface CompanySegment {
  name: string;
  whatItDoes: string;
  weight: string;
  phase: string;
  sourceIds?: number[];
}

export interface CompanyBusinessMap {
  summary: string;
  segments: CompanySegment[];
  customersAndCompetitors: string;
}

export interface CompanyFocusItem {
  name: string;
  whatChanged: string;
  evidence: string;
  whyNow: string;
  relevanceToRole: string;
  sourceIds?: number[];
}

export interface CompanyFocusBusinesses {
  statedDirection: string;
  items: CompanyFocusItem[];
  translatedTalentKeywords: Array<{ stated: string; meaning: string }>;
}

export interface CompanyKeyFigure {
  label: string;
  value: string;
  period: string;
  sourceIds?: number[];
}

export interface CompanyFinancialSnapshot {
  listed: boolean;
  market: string | null;
  revenueTrend: string;
  profitTrend: string;
  keyFigures: CompanyKeyFigure[];
  marketView: string;
  recentDisclosures: Array<{ title: string; when: string; sourceIds?: number[] }>;
  fundingNote: string;
  forApplicant: string;
}

export interface CompanyIssue {
  title: string;
  when: string;
  fact: string;
  whyItMatters: string;
  forApplicant: string;
  sourceIds?: number[];
}

export interface CompanyRoleNews {
  title: string;
  when: string;
  fact: string;
  whyForRole: string;
  sourceIds?: number[];
}

export interface CompanyRoleInContext {
  whereItSits: string;
  problemsItSolves: string[];
  whyHiringNow: string;
  recentNewsForRole: CompanyRoleNews[];
  postingReading: string;
}

export interface CompanyHeadlineText {
  headline: string;
  text: string;
  sourceIds?: number[];
}

export interface CompanyBusinessCandidate {
  name: string;
  whyForThisRole: string;
  angle: string;
  experienceToPrepare: string;
  seedSentence: string;
}

export interface CompanyInterviewPrep {
  questions: Array<{ question: string; direction: string }>;
  primarySources: Array<{ label: string; url: string }>;
}

export interface CompanySource {
  id: number;
  title: string;
  url: string;
  publisher: string;
}

export interface CompanyReportMeta {
  kind: "COMPANY";
  schemaVersion: number;
  asOf: string;
  searchQueries: string[];
  searchEntryPointHtml: string | null;
  linkedResumeAnalysisId: string | null;
  repaired: boolean;
}

export interface CompanyReportData {
  brief: CompanyBrief;
  businessMap: CompanyBusinessMap;
  focusBusinesses: CompanyFocusBusinesses;
  financialSnapshot: CompanyFinancialSnapshot;
  currentIssues: CompanyIssue[];
  roleInContext: CompanyRoleInContext;
  opportunitiesAndRisks: { opportunities: CompanyHeadlineText[]; risks: CompanyHeadlineText[] };
  businessCandidates: CompanyBusinessCandidate[];
  interviewPrep: CompanyInterviewPrep;
  sources: CompanySource[];
  reportMeta?: CompanyReportMeta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * CompanyReport 가 역참조하는 최상위 필드를 렌더 전에 확인한다.
 * 불완전 생성 리포트가 TypeError(화이트스크린)로 이어지지 않게 한다. 자소서 리포트 형태는 거부한다.
 */
export function isRenderableCompanyReport(payload: unknown): payload is CompanyReportData {
  if (!isRecord(payload)) return false;
  const brief = payload.brief;
  const businessMap = payload.businessMap;
  const focus = payload.focusBusinesses;
  const risks = payload.opportunitiesAndRisks;
  const interview = payload.interviewPrep;
  return (
    isRecord(brief) && typeof brief.oneLiner === "string" &&
    isRecord(businessMap) && Array.isArray(businessMap.segments) &&
    isRecord(focus) && Array.isArray(focus.items) &&
    isRecord(payload.financialSnapshot) &&
    Array.isArray(payload.currentIssues) &&
    isRecord(payload.roleInContext) &&
    isRecord(risks) && Array.isArray(risks.opportunities) && Array.isArray(risks.risks) &&
    Array.isArray(payload.businessCandidates) &&
    isRecord(interview) && Array.isArray(interview.questions) &&
    Array.isArray(payload.sources)
  );
}
