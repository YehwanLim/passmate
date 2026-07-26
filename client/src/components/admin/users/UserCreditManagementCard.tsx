import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, History, TicketCheck } from "lucide-react";
import type { UseUserCreditsResult } from "@/hooks/admin/useUserCredits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface UserCreditManagementCardProps {
  credits: UseUserCreditsResult;
}

type PendingAction =
  | { kind: "grant"; credits: number; note?: string }
  | { kind: "coupon"; couponId: string; code: string };

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UserCreditManagementCard({
  credits,
}: UserCreditManagementCardProps) {
  const { detail, coupons, isLoading, error, grant, applyCoupon } = credits;
  const [directCredits, setDirectCredits] = useState("1");
  const [note, setNote] = useState("");
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableCoupons = useMemo(() => {
    const now = Date.now();
    return coupons.filter(
      coupon =>
        coupon.isActive &&
        (!coupon.expiresAt || new Date(coupon.expiresAt).getTime() > now) &&
        (coupon.maxUses === null || coupon.usedCount < coupon.maxUses)
    );
  }, [coupons]);

  const couponById = useMemo(
    () => new Map(coupons.map(coupon => [coupon.id, coupon])),
    [coupons]
  );

  const requestDirectGrant = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(directCredits);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) return;
    const trimmedNote = note.trim();
    setPendingAction({
      kind: "grant",
      credits: amount,
      ...(trimmedNote ? { note: trimmedNote } : {}),
    });
  };

  const requestCouponApplication = () => {
    const coupon = availableCoupons.find(item => item.id === selectedCouponId);
    if (!coupon) return;
    setPendingAction({
      kind: "coupon",
      couponId: coupon.id,
      code: coupon.code,
    });
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setIsSubmitting(true);
    try {
      if (pendingAction.kind === "grant") {
        await grant(pendingAction.credits, pendingAction.note);
        setDirectCredits("1");
        setNote("");
      } else {
        await applyCoupon(pendingAction.couponId);
        setSelectedCouponId("");
      }
      setPendingAction(null);
    } catch {
      // The hook exposes the server message in the card's API error state.
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !detail) {
    return (
      <Card aria-label="분석 이용권 관리 로딩 중">
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-36 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!detail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">분석 이용권 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {error ?? "이용권 정보를 불러오지 못했습니다."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const balances = [
    { label: "전체", value: detail.summary.remaining },
    { label: "무료", value: detail.summary.freeRemaining },
    { label: "보너스", value: detail.summary.bonusRemaining },
    { label: "프리미엄", value: detail.summary.premiumRemaining },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <TicketCheck className="size-4" />
            분석 이용권 관리
          </CardTitle>
          <CardDescription className="text-xs">
            무료 분석 이용권을 직접 지급하거나 발급된 쿠폰을 사용자에게
            적용합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {balances.map(balance => (
              <div
                key={balance.label}
                className="rounded-lg border bg-muted/20 p-3"
              >
                <p className="text-xs text-muted-foreground">
                  {balance.label} 잔여
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {balance.value.toLocaleString("ko-KR")}
                  <span className="ml-1 text-xs font-normal">회</span>
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <form
              onSubmit={requestDirectGrant}
              className="space-y-3 rounded-lg border p-4"
            >
              <div>
                <h3 className="text-sm font-semibold">직접 지급</h3>
                <p className="text-xs text-muted-foreground">
                  1회부터 최대 10,000회까지 지급할 수 있습니다.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="direct-credit-amount" className="text-xs">
                  무료 분석 횟수
                </Label>
                <Input
                  id="direct-credit-amount"
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  required
                  value={directCredits}
                  onChange={event => setDirectCredits(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="direct-credit-note" className="text-xs">
                  메모 (선택)
                </Label>
                <Textarea
                  id="direct-credit-note"
                  maxLength={500}
                  rows={3}
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  placeholder="지급 사유를 입력하세요."
                />
                <p className="text-right text-[11px] text-muted-foreground">
                  {note.length} / 500
                </p>
              </div>
              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full"
              >
                직접 지급
              </Button>
            </form>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <h3 className="text-sm font-semibold">쿠폰 적용</h3>
                <p className="text-xs text-muted-foreground">
                  현재 적용 가능한 무료 이용권 쿠폰만 표시합니다.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="credit-coupon-select" className="text-xs">
                  이용권 쿠폰
                </Label>
                <Select
                  value={selectedCouponId}
                  onValueChange={setSelectedCouponId}
                >
                  <SelectTrigger id="credit-coupon-select" className="w-full">
                    <SelectValue
                      placeholder={
                        availableCoupons.length
                          ? "쿠폰을 선택하세요."
                          : "적용 가능한 쿠폰이 없습니다."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoupons.map(coupon => (
                      <SelectItem key={coupon.id} value={coupon.id}>
                        {coupon.code} ·{" "}
                        {coupon.creditsGranted.toLocaleString("ko-KR")}회
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={!selectedCouponId || isSubmitting || isLoading}
                onClick={requestCouponApplication}
                className="w-full"
              >
                쿠폰 적용
              </Button>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">지급 이력</h3>
            </div>
            {detail.grants.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                지급 이력이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>출처</TableHead>
                      <TableHead className="text-right">지급 수량</TableHead>
                      <TableHead>쿠폰 코드</TableHead>
                      <TableHead>메모</TableHead>
                      <TableHead>관리자 이메일 / ID</TableHead>
                      <TableHead className="text-right">지급 일시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.grants.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {item.source === "MANUAL" ? "직접 지급" : "쿠폰"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.creditsGranted.toLocaleString("ko-KR")}회
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.couponId
                            ? (couponById.get(item.couponId)?.code ??
                              item.couponId)
                            : "–"}
                        </TableCell>
                        <TableCell
                          className="max-w-48 truncate text-xs"
                          title={item.note ?? undefined}
                        >
                          {item.note ?? "–"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.grantedByUserId}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={open => !open && !isSubmitting && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.kind === "grant"
                ? "이용권을 직접 지급할까요?"
                : "선택한 쿠폰을 적용할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === "grant"
                ? `무료 분석 이용권 ${pendingAction.credits.toLocaleString("ko-KR")}회를 지급합니다.`
                : `${pendingAction?.code ?? "선택한 쿠폰"} 쿠폰은 적용 후 다시 사용할 수 없습니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={event => {
                event.preventDefault();
                void confirmAction();
              }}
            >
              {isSubmitting ? "처리 중..." : "확인"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
