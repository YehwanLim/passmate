/**
 * 전역 상단 메뉴(components/SiteHeader.tsx) 항목. 랜딩을 포함해 리포트 화면을 뺀 모든 페이지가 같은 목록을 쓴다.
 * `section` 은 랜딩의 섹션 id 로 스크롤, `route` 는 경로 이동.
 */
export type SiteNavItem = {
  label: string;
  type: "section" | "route";
  target: string;
};

export const SITE_NAV_ITEMS: readonly SiteNavItem[] = [
  { label: "서비스 소개", type: "section", target: "service-intro" },
  { label: "자소서 분석", type: "route", target: "/analyze" },
  { label: "기업 분석", type: "route", target: "/company-analysis" },
  { label: "취업 가이드", type: "route", target: "/guide" },
  { label: "이용권 구매", type: "route", target: "/entitlements" },
  { label: "내 지원서", type: "route", target: "/my" },
];

/** 현재 경로가 이 항목의 페이지(또는 그 하위)인가. aria-current 표시에 쓴다. */
export function isCurrentNavItem(item: SiteNavItem, pathname: string): boolean {
  if (item.type !== "route") return false;
  return pathname === item.target || pathname.startsWith(`${item.target}/`);
}
