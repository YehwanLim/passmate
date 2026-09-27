import { useCallback, useState } from "react";
import { CalendarPlus } from "lucide-react";

import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminRefreshControl } from "@/components/admin/shared/AdminRefreshControl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminResource } from "@/hooks/admin/useAdminResource";
import { adminApiFetch } from "@/lib/adminApi";
import { SESSION_LABELS } from "@/constants/mentoring";
import { slotDayLabel, slotTimeLabel, type MentoringSessionType } from "@/lib/mentoring";

type SlotStatus = "OPEN" | "BOOKED" | "CLOSED";
type AdminBooking = {
  id: string;
  status: "REQUESTED" | "CONFIRMED" | "CANCELLED";
  sessionType: MentoringSessionType;
  message: string;
  createdAt: string;
  userEmail: string;
  userName: string | null;
};
type AdminSlot = { id: string; startsAt: string; durationMin: number; status: SlotStatus; booking: AdminBooking | null };
type SlotAction = "confirm" | "cancel" | "close" | "reopen";

const DURATIONS = [30, 40, 60] as const;
const STATUS_LABEL: Record<SlotStatus, string> = { OPEN: "열림", BOOKED: "신청 있음", CLOSED: "닫힘" };
const BOOKING_LABEL: Record<AdminBooking["status"], string> = { REQUESTED: "확인 중", CONFIRMED: "확정", CANCELLED: "취소" };

/** datetime-local 값(브라우저 로컬 시각)을 ISO 로. 관리자는 한국에 있으므로 로컬 = KST 다. */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function MentoringPage() {
  const { data, isLoading, error, refresh, lastRefreshed } = useAdminResource<{ slots: AdminSlot[] }>(
    "/api/admin/mentoring",
    { errorMessage: "슬롯을 불러오지 못했습니다.", initialLastRefreshed: new Date() },
  );
  const [startsAt, setStartsAt] = useState("");
  const [durationMin, setDurationMin] = useState<string>("40");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, work: () => Promise<unknown>) => {
      setBusy(key);
      setActionError(null);
      try {
        await work();
        refresh();
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "처리하지 못했습니다.");
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const createSlot = (event: React.FormEvent) => {
    event.preventDefault();
    const iso = localInputToIso(startsAt);
    if (!iso) return;
    void run("create", async () => {
      await adminApiFetch("/api/admin/mentoring", {
        method: "POST",
        body: JSON.stringify({ startsAt: iso, durationMin: Number(durationMin) }),
      });
      setStartsAt("");
    });
  };

  const act = (slot: AdminSlot, action: SlotAction) =>
    run(`${slot.id}:${action}`, () =>
      adminApiFetch(`/api/admin/mentoring/${slot.id}`, { method: "PATCH", body: JSON.stringify({ action }) }),
    );

  const remove = (slot: AdminSlot) => {
    if (!window.confirm(`${slotDayLabel(slot.startsAt)} ${slotTimeLabel(slot.startsAt)} 슬롯을 삭제할까요?`)) return;
    void run(`${slot.id}:delete`, () => adminApiFetch(`/api/admin/mentoring/${slot.id}`, { method: "DELETE" }));
  };

  const slots = data?.slots ?? [];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Mentoring"
        description="커피챗·모의 면접·자소서 첨삭 슬롯을 열고 신청을 확정합니다. 확정 답장과 화상 링크는 메일로 직접 보냅니다."
        actions={<AdminRefreshControl lastRefreshed={lastRefreshed} isLoading={isLoading} onRefresh={refresh} id="mentoring-refresh-btn" />}
      />

      <AdminErrorAlert message={error ?? actionError} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">슬롯 열기</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createSlot} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="slot-starts-at" className="text-xs">시작 시각 (KST)</Label>
              <Input id="slot-starts-at" type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} className="h-9 w-[220px]" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">길이</Label>
              <Select value={durationMin} onValueChange={setDurationMin}>
                <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map(minutes => (
                    <SelectItem key={minutes} value={String(minutes)}>{minutes}분</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" disabled={busy === "create" || !startsAt} id="mentoring-create-slot">
              <CalendarPlus className="mr-1.5 h-4 w-4" /> 열기
            </Button>
            <p className="basis-full text-xs text-muted-foreground">
              커피챗 30·40분, 모의 면접 30분, 자소서 첨삭 40분이 기본이지만 신청자는 어떤 세션이든 고를 수 있습니다.
            </p>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">슬롯과 신청</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && slots.length === 0 ? (
            <Skeleton className="h-[200px] w-full" />
          ) : slots.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">열린 슬롯이 없습니다.</p>
          ) : (
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">시간</TableHead>
                    <TableHead className="text-xs">상태</TableHead>
                    <TableHead className="text-xs">신청자</TableHead>
                    <TableHead className="text-xs">상황</TableHead>
                    <TableHead className="text-right text-xs">동작</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slots.map(slot => {
                    const booking = slot.booking;
                    const key = (action: string) => `${slot.id}:${action}`;
                    return (
                      <TableRow key={slot.id}>
                        <TableCell className="whitespace-nowrap text-xs tabular-nums">
                          {slotDayLabel(slot.startsAt)} {slotTimeLabel(slot.startsAt)} · {slot.durationMin}분
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={slot.status === "BOOKED" ? "default" : slot.status === "OPEN" ? "secondary" : "outline"}>
                            {STATUS_LABEL[slot.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {booking ? (
                            <div className="space-y-0.5">
                              <p>{booking.userEmail}</p>
                              <p className="text-muted-foreground">{SESSION_LABELS[booking.sessionType]} · {BOOKING_LABEL[booking.status]}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[360px] whitespace-pre-wrap text-xs text-muted-foreground">{booking?.message ?? "–"}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs">
                          {booking ? (
                            <div className="flex justify-end gap-1.5">
                              {booking.status === "REQUESTED" && (
                                <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs" disabled={busy === key("confirm")} onClick={() => void act(slot, "confirm")}>
                                  확정
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={busy === key("cancel")} onClick={() => void act(slot, "cancel")}>
                                취소
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              {slot.status === "OPEN" ? (
                                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={busy === key("close")} onClick={() => void act(slot, "close")}>
                                  닫기
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={busy === key("reopen")} onClick={() => void act(slot, "reopen")}>
                                  다시 열기
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-destructive" disabled={busy === key("delete")} onClick={() => remove(slot)}>
                                삭제
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
