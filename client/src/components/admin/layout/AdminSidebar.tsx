import {
  LayoutDashboard,
  Users,
  FileText,
  Bot,
  BrainCircuit,
  MessageSquareCode,
  BarChart3,
  CreditCard,
  MessageSquare,
  ScrollText,
  Settings,
  SlidersHorizontal,
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
} from "@/components/ui/sidebar";
import Logo from "@/components/Logo";
import type { AdminNavGroup } from "@/types/admin";

// ============================================================
// 메뉴 구성 정의
// ============================================================

const NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/admin",
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        key: "users",
        label: "Users",
        icon: Users,
        href: "/admin/users",
      },
      {
        key: "resume-analysis",
        label: "Resume Analysis",
        icon: FileText,
        href: "/admin/resume-analysis",
      },
      {
        key: "ai-usage",
        label: "AI Usage",
        icon: Bot,
        href: "/admin/ai-usage",
      },
      {
        key: "ai-models",
        label: "AI Models",
        icon: BrainCircuit,
        href: "/admin/ai-models",
      },
      {
        key: "ai-settings",
        label: "AI Settings",
        icon: SlidersHorizontal,
        href: "/admin/ai-settings",
      },
      {
        key: "prompts",
        label: "Prompts",
        icon: MessageSquareCode,
        href: "/admin/prompts",
      },
      {
        key: "payments",
        label: "Payments",
        icon: CreditCard,
        href: "/admin/payments",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        key: "analytics",
        label: "Analytics",
        icon: BarChart3,
        href: "/admin/analytics",
      },
      {
        key: "feedback",
        label: "Feedback",
        icon: MessageSquare,
        href: "/admin/feedback",
      },
      {
        key: "logs",
        label: "Logs",
        icon: ScrollText,
        href: "/admin/logs",
      },
    ],
  },
];

const FOOTER_ITEMS: AdminNavGroup = {
  items: [
    {
      key: "settings",
      label: "Settings",
      icon: Settings,
      href: "/admin/settings",
    },
  ],
};

// ============================================================
// Component
// ============================================================

export function AdminSidebar() {
  const [location, navigate] = useLocation();

  /**
   * 현재 경로가 해당 메뉴 아이템에 해당하는지 판단.
   * Dashboard(/admin)는 정확히 일치, 나머지는 startsWith로 판단.
   */
  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
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
              tooltip="PassMate Admin"
            >
              <Logo
                className="h-5 w-5 flex-shrink-0"
                textClassName="text-sm font-semibold text-foreground"
                logoColor="var(--color-blue-500)"
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

      {/* ── 푸터: Settings ── */}
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
