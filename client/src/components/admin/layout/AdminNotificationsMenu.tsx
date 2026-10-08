import { useRef } from "react";
import { Bell } from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SESSION_LABELS } from "@/constants/mentoring";
import { useAdminNotifications } from "@/hooks/admin/useAdminNotifications";
import { productLabel, type PurchaseProduct } from "@/lib/pricing";

const timeLabel = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "–";

/**
 * 머리말 종 버튼. 멘토링 확정 대기(처리할 때까지 남음)와, 마지막으로 열어 본 뒤 들어온 결제·실패 분석.
 * 닫을 때 "마지막으로 본 시각"을 갱신해 결제·실패 수가 0 으로 돌아간다.
 * 옆 메뉴에서 뺀 멘토링 화면으로 가는 입구이기도 하다.
 */
export function AdminNotificationsMenu() {
  const [, navigate] = useLocation();
  const { data, total, markSeen } = useAdminNotifications();
  const wasOpen = useRef(false);

  const handleOpenChange = (open: boolean) => {
    if (!open && wasOpen.current) markSeen();
    wasOpen.current = open;
  };

  const mentoring = data?.mentoringRequested;
  const payments = data?.payments;
  const failed = data?.failedAnalyses;

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 text-muted-foreground hover:text-foreground"
          aria-label={total > 0 ? `알림 ${total}건` : "알림"}
        >
          <Bell className="size-4" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between text-xs">
            멘토링 확정 대기 <span className="tabular-nums">{mentoring?.count ?? 0}건</span>
          </DropdownMenuLabel>
          {mentoring?.items.map((item) => (
            <DropdownMenuItem key={item.id} className="text-xs" onClick={() => navigate("/admin/mentoring")}>
              {SESSION_LABELS[item.sessionType as keyof typeof SESSION_LABELS] ?? item.sessionType} · {timeLabel(item.startsAt)} 예정
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem className="text-xs text-muted-foreground" onClick={() => navigate("/admin/mentoring")}>
            멘토링 화면 열기 →
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between text-xs">
            새 결제 <span className="tabular-nums">{payments?.count ?? 0}건</span>
          </DropdownMenuLabel>
          {payments?.items.map((item) => (
            <DropdownMenuItem key={item.id} className="text-xs" onClick={() => navigate(`/admin/users/${item.userId}`)}>
              {item.product === "UNKNOWN" ? "상품 모름" : productLabel(item.product as PurchaseProduct)} · {timeLabel(item.createdAt)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between text-xs">
            새 실패 분석 <span className="tabular-nums">{failed?.count ?? 0}건</span>
          </DropdownMenuLabel>
          {failed?.items.map((item) => (
            <DropdownMenuItem key={item.id} className="text-xs" onClick={() => navigate(`/admin/resume-analysis/${item.id}`)}>
              {item.errorCode ?? "원인 미분류"} · {timeLabel(item.createdAt)}
            </DropdownMenuItem>
          ))}
          {(failed?.count ?? 0) > 0 && (
            <DropdownMenuItem className="text-xs text-muted-foreground" onClick={() => navigate("/admin/logs")}>
              실패 로그 열기 →
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        {data && (
          <p className="px-2 pb-1 pt-2 text-[11px] text-muted-foreground">
            결제·실패는 {timeLabel(data.since)} 이후 · 닫으면 확인한 것으로 칩니다
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
