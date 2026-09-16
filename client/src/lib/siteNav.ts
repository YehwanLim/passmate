/**
 * 전역 상단 메뉴(components/SiteHeader.tsx) 항목. 랜딩을 포함해 리포트 화면을 뺀 모든 페이지가 같은 목록을 쓴다.
 * "할 수 있는 일"만 둔다. 내 지원서·내 이용권은 프로필 드롭다운(AuthButton)에 있고, 서비스 소개는 로고(홈)로 간다.
 */
export type SiteNavItem = {
  label: string;
  type: "route";
  target: string;
};

export const SITE_NAV_ITEMS: readonly SiteNavItem[] = [
  { label: "자소서 분석", type: "route", target: "/analyze" },
  { label: "기업 분석", type: "route", target: "/company-analysis" },
  { label: "취업 가이드", type: "route", target: "/guide" },
  { label: "이용권", type: "route", target: "/entitlements" },
];

/** 현재 경로가 이 항목의 페이지(또는 그 하위)인가. aria-current 표시에 쓴다. */
export function isCurrentNavItem(item: SiteNavItem, pathname: string): boolean {
  return pathname === item.target || pathname.startsWith(`${item.target}/`);
}
