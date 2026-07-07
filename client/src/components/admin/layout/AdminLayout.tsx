import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { AdminContent } from "./AdminContent";

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * AdminLayout
 *
 * 관리자 전용 레이아웃. 일반 사용자 레이아웃과 완전히 분리됩니다.
 *
 * 구조:
 *   SidebarProvider            ← shadcn Sidebar 상태 관리 (expand/collapse, mobile Sheet)
 *     AdminSidebar             ← 좌측 사이드바 (데스크톱 고정 / 모바일 Sheet)
 *     SidebarInset             ← 사이드바 외 우측 영역
 *       AdminHeader            ← sticky 상단 헤더 (SidebarTrigger + Breadcrumb + 아바타)
 *       AdminContent           ← 주 콘텐츠 영역 (overflow-y-auto)
 *         {children}           ← 각 관리자 페이지
 *
 * 반응형:
 *   - lg 이상: Sidebar 고정 표시, collapsible="icon" 지원
 *   - lg 미만: Sidebar가 shadcn Sheet(Drawer)로 전환됨 (SidebarProvider가 자동 처리)
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AdminSidebar />
        <SidebarInset className="flex flex-col min-w-0">
          <AdminHeader />
          <AdminContent>{children}</AdminContent>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
