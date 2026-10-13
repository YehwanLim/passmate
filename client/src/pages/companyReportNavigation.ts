import type { ReportNavSection } from "./reportNavigation";

/** 표지(히어로)는 목차에 넣지 않는다. 자소서 리포트의 section- 접두와 겹치지 않게 company- 를 쓴다. */
export const COMPANY_HERO_ID = "company-hero";

export interface CompanyReportNavOptions {
  /** 경쟁사 비교·경영진 메시지는 10-12 에 더했다. 그 전에 생성된 리포트에는 없다. */
  hasCompetitors: boolean;
  hasLeadership: boolean;
  /** 전형 안내는 저장해 둔 채용 공고와 회사 이름이 맞을 때만 보인다. */
  hasProcess: boolean;
}

/** 기업 분석 리포트 목차. 없는 섹션은 빼고 번호를 순서대로 다시 매긴다(자소서 리포트 buildReportNavSections 와 같은 방식). */
export function buildCompanyReportNavSections({ hasCompetitors, hasLeadership, hasProcess }: CompanyReportNavOptions): ReportNavSection[] {
  const sections: Array<Omit<ReportNavSection, "indexLabel"> | null> = [
    { id: "company-business", label: "사업 구조" },
    hasCompetitors ? { id: "company-competitors", label: "경쟁사 비교" } : null,
    { id: "company-focus", label: "집중 사업" },
    hasLeadership ? { id: "company-leadership", label: "경영진 메시지" } : null,
    { id: "company-numbers", label: "실적과 주가" },
    { id: "company-issues", label: "최근 이슈" },
    { id: "company-role", label: "직무의 역할" },
    { id: "company-risks", label: "기회와 위험" },
    { id: "company-candidates", label: "자소서 소재" },
    { id: "company-interview", label: "면접 준비" },
    hasProcess ? { id: "company-process", label: "전형 안내" } : null,
    { id: "company-sources", label: "출처" },
  ];
  return sections
    .filter((section): section is Omit<ReportNavSection, "indexLabel"> => section !== null)
    .map((section, index) => ({ ...section, indexLabel: String(index + 1).padStart(2, "0") }));
}

/** 지금 생성되는 리포트의 기본 구성(랜딩 목차·가격표가 쓴다). 전형 안내는 일부 회사에만 붙어 넣지 않는다 — 과장 금지. */
export const COMPANY_REPORT_NAV_SECTIONS: ReportNavSection[] = buildCompanyReportNavSections({
  hasCompetitors: true,
  hasLeadership: true,
  hasProcess: false,
});
