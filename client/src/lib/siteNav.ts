/**
 * 전역 상단 메뉴(components/SiteHeader.tsx) 항목. 랜딩을 포함해 리포트 화면을 뺀 모든 페이지가 같은 목록을 쓴다.
 * "할 수 있는 일"만 둔다. 서비스 소개는 로고(홈)로 간다.
 * 마이페이지(내 지원서·내 경험 탭)는 경험 관리가 핵심 기능이 되며 프로필 안에 숨지 않게 메뉴에 둔다(10-08).
 * 로그인 전이면 로그인 뒤 마이페이지로 돌아온다.
 */
/** 펼침 메뉴 한 줄. target 에 해시(#experiences)가 있으면 그 탭으로 연다. */
export type SiteNavChild = {
  label: string;
  target: string;
  description?: string;
};

export type SiteNavItem = {
  label: string;
  type: "route";
  target: string;
  /** 있으면 데스크톱에선 마우스를 올릴 때 펼치고, 폰 메뉴에선 늘 펼쳐 둔다 */
  children?: readonly SiteNavChild[];
};

export const SITE_NAV_ITEMS: readonly SiteNavItem[] = [
  // 채용 공고는 지원 순서(공고 → 회사 → 자소서)의 맨 앞이라 첫 칸(10-09). 펼치지 않는다.
  { label: "채용 공고", type: "route", target: "/jobs" },
  // 자소서 분석·기업 분석을 한 칸으로 합쳤다(10-09). 칸을 누르면 가장 많이 쓰는 자소서 분석으로 간다.
  {
    label: "분석하기",
    type: "route",
    target: "/analyze",
    children: [
      { label: "자소서 분석", target: "/analyze", description: "채용 담당자의 눈으로 보는 자소서 분석" },
      { label: "기업 분석", target: "/company-analysis", description: "지원할 회사의 사업·이슈·직무 정리" },
    ],
  },
  // AI 면접은 출시하며 분석하기 펼침 안에서 꺼내 한 칸을 줬다(11-08). 처음 보는 사람이 많아 랜딩 소개 칸으로 보낸다.
  // 해시 주소라 SiteHeader 가 wouter Link 대신 일반 <a> 로 그린다(같은 화면이면 그 자리로 스크롤, 다른 화면이면 랜딩을 열고 스크롤).
  { label: "AI 모의 면접", type: "route", target: "/#interview-practice" },
  { label: "취업 가이드", type: "route", target: "/guide" },
  // 멘토링(/mentoring)은 페이지·파운더 섹션 링크·sitemap 은 그대로 두고, 손볼 것이 남아 상단 메뉴에서만 잠시 뺐다(09-27).
  // 펼치면 분석 이용권과 AI 모의 면접 이용권(#interview)으로 바로 간다(11-08).
  {
    label: "이용권",
    type: "route",
    target: "/entitlements",
    children: [
      { label: "분석 이용권", target: "/entitlements", description: "자소서·기업 분석 횟수권" },
      { label: "AI 모의 면접 이용권", target: "/entitlements#interview", description: "실시간 화상 면접 1회권·3회권" },
    ],
  },
  // 마이페이지는 맨 오른쪽 — 내 것(지원서·경험·기업)을 모아 보는 곳이라 "할 수 있는 일" 다음에 둔다(10-08).
  // 펼치면 마이페이지 탭(해시)과 내 이용권으로 바로 간다(10-09).
  {
    label: "마이페이지",
    type: "route",
    target: "/my",
    children: [
      { label: "자기소개서", target: "/my", description: "채용 공고별로 쓴 자소서와 분석 리포트" },
      { label: "경험 카드", target: "/my#experiences", description: "경험 관리하고 자소서 초안 쓰기" },
      { label: "기업 리포트", target: "/my#company", description: "분석한 회사 리포트 모아 보기" },
      { label: "AI 모의 면접 기록", target: "/my/interview-practice", description: "지난 면접의 피드백과 대화 다시 보기" },
      { label: "내 이용권", target: "/my/entitlements", description: "이용권 남은 횟수 확인 및 구매" },
    ],
  },
];

/** 현재 경로가 이 항목(또는 펼침 메뉴 항목)의 페이지이거나 그 하위인가. aria-current 표시에 쓴다. */
export function isCurrentNavItem(item: SiteNavItem, pathname: string): boolean {
  const targets = [item.target, ...(item.children ?? []).map(child => child.target.split("#")[0])];
  return targets.some(target => pathname === target || pathname.startsWith(`${target}/`));
}
