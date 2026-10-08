import { Link, useLocation } from "wouter";

import { cn } from "@/lib/utils";

export interface AdminSectionTab {
  label: string;
  href: string;
  /** href 말고도 이 탭을 활성으로 칠 경로 접두사(상세 화면 등) */
  match?: string[];
}

// 옆 메뉴 한 칸 아래 묶인 화면들. 주소는 예전 그대로라 북마크가 깨지지 않는다.
export const ANALYSIS_SECTION_TABS: AdminSectionTab[] = [
  { label: "전체 기록", href: "/admin/resume-analysis" },
  { label: "실패 로그", href: "/admin/logs" },
];

export const AI_SECTION_TABS: AdminSectionTab[] = [
  { label: "사용량", href: "/admin/ai-usage" },
  { label: "모델", href: "/admin/ai-models" },
  { label: "프롬프트", href: "/admin/prompts" },
];

export function isSectionTabActive(location: string, tab: AdminSectionTab): boolean {
  return [tab.href, ...(tab.match ?? [])].some((prefix) => location === prefix || location.startsWith(`${prefix}/`));
}

/** 분석 기록·AI 묶음 화면 위의 밑줄 탭. */
export function AdminSectionTabs({ tabs }: { tabs: AdminSectionTab[] }) {
  const [location] = useLocation();
  return (
    <nav className="-mt-2 mb-5 flex gap-1 border-b border-border" aria-label="하위 메뉴">
      {tabs.map((tab) => {
        const active = isSectionTabActive(location, tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-foreground font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
