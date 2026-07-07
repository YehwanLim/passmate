import { Bell, LogOut, User } from "lucide-react";
import { useLocation } from "wouter";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { useAuth } from "@/contexts/AuthContext";

// ============================================================
// Component
// ============================================================

export function AdminHeader() {
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();

  /** 이메일 앞 두 글자로 아바타 폴백 텍스트 생성 */
  const avatarFallback = (user?.name ?? user?.email ?? "AD")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      {/* 사이드바 토글 트리거 */}
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="h-4" />

      {/* 브레드크럼 */}
      <div className="flex-1 min-w-0">
        <AdminBreadcrumb />
      </div>

      {/* 우측 액션 영역 */}
      <div className="flex items-center gap-1">
        {/* 알림 버튼 (추후 알림 기능과 연동) */}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label="알림"
        >
          <Bell className="size-4" />
        </Button>

        {/* 관리자 프로필 드롭다운 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              aria-label="관리자 메뉴"
            >
              <Avatar className="size-7">
                <AvatarImage
                  src={user?.profile_image ?? undefined}
                  alt={user?.name ?? "관리자"}
                />
                <AvatarFallback className="text-[11px] font-semibold">
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-tight">
                  {user?.name ?? "관리자"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </span>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-2"
              onClick={() => navigate("/")}
            >
              <User className="size-4" />
              사용자 페이지로 이동
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
