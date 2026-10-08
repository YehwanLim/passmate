/**
 * 전역 상단 메뉴(components/SiteHeader.tsx) 항목. 랜딩을 포함해 리포트 화면을 뺀 모든 페이지가 같은 목록을 쓴다.
 * "할 수 있는 일"만 둔다. 서비스 소개는 로고(홈)로 간다.
 * 마이페이지(내 지원서·내 경험 탭)는 경험 관리가 핵심 기능이 되며 프로필 안에 숨지 않게 메뉴에 둔다(10-08).
 * 로그인 전이면 로그인 뒤 마이페이지로 돌아온다.
 */
export type SiteNavItem = {
  label: string;
  type: "route";
  target: string;
};

export const SITE_NAV_ITEMS: readonly SiteNavItem[] = [
  { label: "자소서 분석", type: "route", target: "/analyze" },
  { label: "기업 분석", type: "route", target: "/company-analysis" },
  { label: "마이페이지", type: "route", target: "/my" },
  { label: "취업 가이드", type: "route", target: "/guide" },
  // 멘토링(/mentoring)은 페이지·파운더 섹션 링크·sitemap 은 그대로 두고, 손볼 것이 남아 상단 메뉴에서만 잠시 뺐다(09-27).
  { label: "이용권", type: "route", target: "/entitlements" },
];

/** 현재 경로가 이 항목의 페이지(또는 그 하위)인가. aria-current 표시에 쓴다. */
export function isCurrentNavItem(item: SiteNavItem, pathname: string): boolean {
  return pathname === item.target || pathname.startsWith(`${item.target}/`);
}
