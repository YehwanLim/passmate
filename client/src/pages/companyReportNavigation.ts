import type { ReportNavSection } from "./reportNavigation";

/** 표지(히어로)는 목차에 넣지 않는다. 자소서 리포트의 section- 접두와 겹치지 않게 company- 를 쓴다. */
export const COMPANY_HERO_ID = "company-hero";

export const COMPANY_REPORT_NAV_SECTIONS: ReportNavSection[] = [
  { id: "company-business", indexLabel: "01", label: "돈 버는 구조" },
  { id: "company-focus", indexLabel: "02", label: "밀고 있는 사업" },
  { id: "company-numbers", indexLabel: "03", label: "숫자로 보는 회사" },
  { id: "company-issues", indexLabel: "04", label: "최근 1년의 국면" },
  { id: "company-role", indexLabel: "05", label: "이 직무의 자리" },
  { id: "company-risks", indexLabel: "06", label: "기회와 리스크" },
  { id: "company-candidates", indexLabel: "07", label: "맡고 싶은 사업" },
  { id: "company-interview", indexLabel: "08", label: "면접 전 체크리스트" },
  { id: "company-sources", indexLabel: "09", label: "출처와 기준일" },
];
