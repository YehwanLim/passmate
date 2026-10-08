import { useCallback, useState } from "react";
import { Megaphone, Pencil, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminResource } from "@/hooks/admin/useAdminResource";
import { adminApiFetch } from "@/lib/adminApi";
import {
  EMPTY_NOTICE_FORM,
  NOTICE_KIND_LABEL,
  NOTICE_STATUS_LABEL,
  formToBody,
  noticeStatus,
  noticeToForm,
  shownNoticeIds,
  validateNoticeForm,
  type AdminNotice,
  type NoticeFormState,
  type NoticeKind,
} from "./noticeForm";

const periodLabel = (notice: AdminNotice) => {
  const format = (value: string) =>
    new Date(value).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  if (!notice.startsAt && !notice.endsAt) return "끌 때까지";
  return `${notice.startsAt ? format(notice.startsAt) : "지금"} ~ ${notice.endsAt ? format(notice.endsAt) : "끌 때까지"}`;
};

/**
 * NoticesPage — 사이트 공지(팝업·상단 배너) 만들기·켜기·고치기.
 * 켜져 있고 기간 안인 것 중 종류별로 가장 최근에 만든 하나만 사이트에 뜬다(관리자 화면 제외).
 */
export default function NoticesPage() {
  const { data, isLoading, error, refresh, lastRefreshed } = useAdminResource<{ notices: AdminNotice[] }>(
    "/api/admin/notices",
    { errorMessage: "공지를 불러오지 못했습니다.", initialLastRefreshed: new Date() },
  );
  const [form, setForm] = useState<NoticeFormState>(EMPTY_NOTICE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const notices = data?.notices ?? [];
  const shown = shownNoticeIds(notices);
  const formProblem = validateNoticeForm(form);
  const set = <K extends keyof NoticeFormState>(key: K, value: NoticeFormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const run = useCallback(
    async (key: string, work: () => Promise<unknown>) => {
      setBusy(key);
      setActionError(null);
      try {
        await work();
        refresh();
        return true;
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "처리하지 못했습니다.");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const resetForm = () => {
    setForm(EMPTY_NOTICE_FORM);
    setEditingId(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (formProblem) return;
    const body = JSON.stringify(formToBody(form));
    const ok = await run("save", () =>
      editingId
        ? adminApiFetch(`/api/admin/notices/${editingId}`, { method: "PATCH", body })
        : adminApiFetch("/api/admin/notices", { method: "POST", body }),
    );
    if (ok) resetForm();
  };

  const toggle = (notice: AdminNotice, active: boolean) =>
    run(`${notice.id}:toggle`, () =>
      adminApiFetch(`/api/admin/notices/${notice.id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
    );

  const remove = (notice: AdminNotice) => {
    if (!window.confirm(`"${notice.title}" 공지를 지울까요? 되돌릴 수 없어요.`)) return;
    void run(`${notice.id}:delete`, async () => {
      await adminApiFetch(`/api/admin/notices/${notice.id}`, { method: "DELETE" });
      if (editingId === notice.id) resetForm();
    });
  };

  const edit = (notice: AdminNotice) => {
    setEditingId(notice.id);
    setForm(noticeToForm(notice));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="공지"
        description="들어오면 뜨는 팝업과 화면 맨 위 띠 배너. 켜져 있고 기간 안인 것 중 종류별로 가장 최근 것 하나만 보입니다."
        actions={<AdminRefreshControl lastRefreshed={lastRefreshed} isLoading={isLoading} onRefresh={refresh} id="notices-refresh-btn" />}
      />

      <AdminErrorAlert message={error ?? actionError} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{editingId ? "공지 고치기" : "새 공지"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">종류</Label>
              <Select value={form.kind} onValueChange={(value) => set("kind", value as NoticeKind)}>
                <SelectTrigger className="h-9" id="notice-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANNER">{NOTICE_KIND_LABEL.BANNER} (화면 맨 위 한 줄)</SelectItem>
                  <SelectItem value="POPUP">{NOTICE_KIND_LABEL.POPUP} (들어오면 뜨는 창)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notice-title" className="text-xs">제목 (필수, 100자)</Label>
              <Input id="notice-title" value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={100} className="h-9" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="notice-body" className="text-xs">
                내용 (1,000자{form.kind === "BANNER" ? " · 배너는 짧게 한 줄" : " · 줄바꿈 그대로 보임"})
              </Label>
              <Textarea id="notice-body" value={form.body} onChange={(event) => set("body", event.target.value)} maxLength={1000} rows={form.kind === "POPUP" ? 4 : 2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notice-link-label" className="text-xs">버튼 문구 (비우면 "자세히 보기")</Label>
              <Input id="notice-link-label" value={form.linkLabel} onChange={(event) => set("linkLabel", event.target.value)} maxLength={30} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notice-link-url" className="text-xs">버튼 링크 (/guide 같은 사이트 안 경로 또는 https://)</Label>
              <Input id="notice-link-url" value={form.linkUrl} onChange={(event) => set("linkUrl", event.target.value)} placeholder="예: /entitlements" className="h-9" />
            </div>
            {form.kind === "POPUP" && (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="notice-image-url" className="text-xs">이미지 주소 (선택 · 사이트 안 경로나 Supabase 저장소 주소만)</Label>
                <Input id="notice-image-url" value={form.imageUrl} onChange={(event) => set("imageUrl", event.target.value)} placeholder="예: https://xxxx.supabase.co/storage/v1/object/public/…" className="h-9" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="notice-starts-at" className="text-xs">시작 (비우면 켜는 즉시)</Label>
              <Input id="notice-starts-at" type="datetime-local" value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notice-ends-at" className="text-xs">끝 (비우면 끌 때까지)</Label>
              <Input id="notice-ends-at" type="datetime-local" value={form.endsAt} onChange={(event) => set("endsAt", event.target.value)} className="h-9" />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Switch id="notice-active" checked={form.active} onCheckedChange={(checked) => set("active", checked)} />
              <Label htmlFor="notice-active" className="text-sm">저장하면 바로 켜기</Label>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
              <Button type="submit" size="sm" disabled={busy === "save" || formProblem != null} id="notice-save">
                <Megaphone className="mr-1.5 h-4 w-4" /> {editingId ? "고친 내용 저장" : "공지 만들기"}
              </Button>
              {editingId && (
                <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                  고치기 취소
                </Button>
              )}
              {formProblem && form.title && <p className="text-xs text-destructive">{formProblem}</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">공지 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && notices.length === 0 ? (
            <Skeleton className="h-[160px] w-full" />
          ) : notices.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">아직 만든 공지가 없습니다.</p>
          ) : (
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">종류</TableHead>
                    <TableHead className="text-xs">제목</TableHead>
                    <TableHead className="text-xs">상태</TableHead>
                    <TableHead className="text-xs">기간</TableHead>
                    <TableHead className="text-xs">켜기</TableHead>
                    <TableHead className="text-right text-xs">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notices.map((notice) => {
                    const status = noticeStatus(notice);
                    const hiddenByNewer = status === "live" && !shown.has(notice.id);
                    return (
                      <TableRow key={notice.id}>
                        <TableCell className="text-xs">{NOTICE_KIND_LABEL[notice.kind]}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs font-medium">{notice.title}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={status === "live" && !hiddenByNewer ? "default" : "secondary"} className="text-[11px]">
                            {hiddenByNewer ? "더 최근 공지에 가려짐" : NOTICE_STATUS_LABEL[status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{periodLabel(notice)}</TableCell>
                        <TableCell>
                          <Switch
                            checked={notice.active}
                            disabled={busy === `${notice.id}:toggle`}
                            onCheckedChange={(checked) => void toggle(notice, checked)}
                            aria-label={`${notice.title} 켜기`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => edit(notice)} aria-label="고치기">
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive"
                              disabled={busy === `${notice.id}:delete`}
                              onClick={() => remove(notice)}
                              aria-label="지우기"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            사이트에는 1분 안에 반영됩니다. 방문자가 "닫기"를 누르면 그 방문 동안, "오늘 하루 보지 않기"를 누르면 자정까지 안 보입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
