import type { ReportNavSection } from "./reportNavigation";

/** 표지(히어로)는 목차에 넣지 않는다. 자소서 리포트의 section- 접두와 겹치지 않게 company- 를 쓴다. */
export const COMPANY_HERO_ID = "company-hero";

export const COMPANY_REPORT_NAV_SECTIONS: ReportNavSection[] = [
  { id: "company-business", indexLabel: "01", label: "사업 구조" },
  { id: "company-focus", indexLabel: "02", label: "집중 사업" },
  { id: "company-numbers", indexLabel: "03", label: "실적과 주가" },
  { id: "company-issues", indexLabel: "04", label: "최근 이슈" },
  { id: "company-role", indexLabel: "05", label: "직무의 역할" },
  { id: "company-risks", indexLabel: "06", label: "기회와 위험" },
  { id: "company-candidates", indexLabel: "07", label: "자소서 소재" },
  { id: "company-interview", indexLabel: "08", label: "면접 준비" },
  { id: "company-sources", indexLabel: "09", label: "출처" },
];
