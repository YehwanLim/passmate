import {
  LayoutDashboard,
  Users,
  FileText,
  Bot,
  Footprints,
  Megaphone,
  Settings,
} from "lucide-react";
import { useLocation } from "wouter";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import Logo from "@/components/Logo";
import type { AdminNavGroup } from "@/types/admin";

// ============================================================
// 메뉴 구성 정의
// ============================================================

// 매일 보는 것만 둔다. 멘토링·피드백은 주소(/admin/mentoring, /admin/feedback)와 알림함으로 들어간다.
const NAV_GROUPS: AdminNavGroup[] = [
  {
    items: [
      { key: "dashboard", label: "홈", icon: LayoutDashboard, href: "/admin" },
      { key: "behavior", label: "사용 행동", icon: Footprints, href: "/admin/behavior" },
      { key: "users", label: "사용자", icon: Users, href: "/admin/users" },
      {
        key: "resume-analysis",
        label: "분석 기록",
        icon: FileText,
        href: "/admin/resume-analysis",
        match: ["/admin/logs"],
      },
      {
        key: "ai",
        label: "AI",
        icon: Bot,
        href: "/admin/ai-usage",
        match: ["/admin/ai-models", "/admin/prompts"],
      },
      { key: "notices", label: "공지", icon: Megaphone, href: "/admin/notices" },
    ],
  },
];

const FOOTER_ITEMS: AdminNavGroup = {
  items: [
    {
      key: "settings",
      label: "설정",
      icon: Settings,
      href: "/admin/settings",
    },
  ],
};

// ============================================================
// Component
// ============================================================

export function AdminSidebar() {
  const [location, setLocation] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  // 좁은 화면에선 메뉴가 화면을 덮는 시트라, 이동하면 닫아 줘야 바로 본문이 보인다.
  const navigate = (href: string) => {
    setLocation(href);
    if (isMobile) setOpenMobile(false);
  };

  /**
   * 현재 경로가 해당 메뉴 아이템에 해당하는지 판단.
   * 홈(/admin)은 정확히 일치, 나머지는 href 나 match 접두사로 판단.
   */
  const isActive = (href: string, match: string[] = []) => {
    if (href === "/admin") return location === "/admin";
    return [href, ...match].some((prefix) => location.startsWith(prefix));
  };

  return (
    <Sidebar collapsible="icon">
      {/* ── 헤더: 로고 ── */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => navigate("/admin")}
              tooltip="Pre:View Admin"
            >
              <Logo
                className="h-5 w-auto flex-shrink-0"
                variant="default"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── 본문: 메뉴 그룹 ── */}
      <SidebarContent>
        {NAV_GROUPS.map((group, groupIdx) => (
          <SidebarGroup key={groupIdx}>
            {group.label && (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            )}
            <SidebarMenu>
              {group.items.map(item => {
                const Icon = item.icon;
                const active = isActive(item.href, item.match);
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={active}
                      onClick={() => navigate(item.href)}
                      tooltip={item.label}
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.badge != null && item.badge > 0 && (
                      <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            {groupIdx < NAV_GROUPS.length - 1 && (
              <SidebarSeparator className="mt-2" />
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── 푸터: 설정 ── */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {FOOTER_ITEMS.items.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <SidebarMenuItem key={item.key}>
                <SidebarMenuButton
                  isActive={active}
                  onClick={() => navigate(item.href)}
                  tooltip={item.label}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
