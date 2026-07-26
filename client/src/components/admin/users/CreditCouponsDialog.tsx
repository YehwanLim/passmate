import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Pencil, TicketPlus } from "lucide-react";
import type {
  CreateCreditCouponInput,
  CreditCoupon,
  UpdateCreditCouponInput,
} from "@/lib/admin-credits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CreditCouponsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupons: CreditCoupon[];
  isLoading?: boolean;
  error?: string | null;
  onCreate: (input: CreateCreditCouponInput) => Promise<CreditCoupon>;
  onUpdate: (input: UpdateCreditCouponInput) => Promise<CreditCoupon>;
}

function initialExpiry(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "이용권 쿠폰을 저장하지 못했습니다.";
}

export function createCouponAtomically(
  onCreate: (input: CreateCreditCouponInput) => Promise<CreditCoupon>,
  input: CreateCreditCouponInput
) {
  return onCreate(input);
}

export function CreditCouponsDialog({
  open,
  onOpenChange,
  coupons,
  isLoading = false,
  error,
  onCreate,
  onUpdate,
}: CreditCouponsDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [creditsGranted, setCreditsGranted] = useState("1");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const editingCoupon = useMemo(
    () => coupons.find(coupon => coupon.id === editingId) ?? null,
    [coupons, editingId]
  );

  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setCreditsGranted("1");
    setMaxUses("");
    setExpiresAt("");
    setIsActive(true);
    setFormError(null);
  };

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  const editCoupon = (coupon: CreditCoupon) => {
    setEditingId(coupon.id);
    setCode(coupon.code);
    setCreditsGranted(String(coupon.creditsGranted));
    setMaxUses(coupon.maxUses === null ? "" : String(coupon.maxUses));
    setExpiresAt(initialExpiry(coupon.expiresAt));
    setIsActive(coupon.isActive);
    setFormError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedCredits = Number(creditsGranted);
    const parsedMaxUses = maxUses === "" ? null : Number(maxUses);
    if (
      !Number.isInteger(parsedCredits) ||
      parsedCredits < 1 ||
      parsedCredits > 10000
    )
      return;
    if (
      parsedMaxUses !== null &&
      (!Number.isInteger(parsedMaxUses) || parsedMaxUses < 1)
    )
      return;

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingCoupon) {
        await onUpdate({
          id: editingCoupon.id,
          ...(editingCoupon.usedCount === 0
            ? { creditsGranted: parsedCredits }
            : {}),
          maxUses: parsedMaxUses,
          expiresAt: expiresAt || null,
          isActive,
        });
      } else {
        await createCouponAtomically(onCreate, {
          code: code.trim().toUpperCase(),
          creditsGranted: parsedCredits,
          maxUses: parsedMaxUses,
          expiresAt: expiresAt || null,
          isActive,
        });
      }
      resetForm();
    } catch (cause) {
      setFormError(messageFrom(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCoupon = async (coupon: CreditCoupon, checked: boolean) => {
    setUpdatingId(coupon.id);
    setFormError(null);
    try {
      await onUpdate({ id: coupon.id, isActive: checked });
    } catch (cause) {
      setFormError(messageFrom(cause));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>무료 이용권 쿠폰 관리</DialogTitle>
          <DialogDescription>
            결제 할인 쿠폰이 아닌 무료 분석 횟수 쿠폰을 생성하고 운영합니다.
          </DialogDescription>
        </DialogHeader>

        {(error || formError) && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{formError ?? error}</AlertDescription>
          </Alert>
        )}

        <form
          onSubmit={submit}
          className="space-y-4 rounded-lg border bg-muted/20 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">
                {editingCoupon ? "쿠폰 수정" : "새 쿠폰 생성"}
              </h3>
              <p className="text-xs text-muted-foreground">
                코드와 무료 분석 횟수, 사용 조건을 설정합니다.
              </p>
            </div>
            {editingCoupon && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                새 쿠폰
              </Button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-code">코드</Label>
              <Input
                id="coupon-code"
                value={code}
                onChange={event => setCode(event.target.value.toUpperCase())}
                minLength={3}
                maxLength={64}
                pattern="[A-Z0-9_-]{3,64}"
                placeholder="WELCOME10"
                disabled={Boolean(editingCoupon)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-credits">무료 분석 횟수</Label>
              <Input
                id="coupon-credits"
                type="number"
                min={1}
                max={10000}
                step={1}
                value={creditsGranted}
                onChange={event => setCreditsGranted(event.target.value)}
                disabled={Boolean(editingCoupon && editingCoupon.usedCount > 0)}
                required
              />
              {editingCoupon && editingCoupon.usedCount > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  사용된 쿠폰의 지급 횟수는 변경할 수 없습니다.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-max-uses">최대 사용 수 (선택)</Label>
              <Input
                id="coupon-max-uses"
                type="number"
                min={1}
                step={1}
                value={maxUses}
                onChange={event => setMaxUses(event.target.value)}
                placeholder="무제한"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-expiry">만료일 (선택)</Label>
              <Input
                id="coupon-expiry"
                type="date"
                value={expiresAt}
                onChange={event => setExpiresAt(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 lg:self-end">
              <Label htmlFor="coupon-active" className="cursor-pointer">
                활성
              </Label>
              <Switch
                id="coupon-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              <TicketPlus className="size-4" />
              {isSubmitting
                ? "저장 중..."
                : editingCoupon
                  ? "변경 저장"
                  : "쿠폰 생성"}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">발급된 쿠폰</h3>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : coupons.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              발급된 무료 이용권 쿠폰이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>코드</TableHead>
                    <TableHead className="text-right">무료 분석 횟수</TableHead>
                    <TableHead className="text-right">사용 횟수</TableHead>
                    <TableHead className="text-right">만료일</TableHead>
                    <TableHead className="text-center">활성</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map(coupon => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {coupon.code}
                      </TableCell>
                      <TableCell className="text-right">
                        {coupon.creditsGranted.toLocaleString("ko-KR")}회
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {coupon.usedCount.toLocaleString("ko-KR")} /{" "}
                        {coupon.maxUses === null
                          ? "무제한"
                          : coupon.maxUses.toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                        {coupon.expiresAt
                          ? new Date(coupon.expiresAt).toLocaleDateString(
                              "ko-KR"
                            )
                          : "없음"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={coupon.isActive}
                          disabled={updatingId === coupon.id}
                          onCheckedChange={checked =>
                            void toggleCoupon(coupon, checked)
                          }
                          aria-label={`${coupon.code} 활성 상태`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => editCoupon(coupon)}
                          aria-label={`${coupon.code} 수정`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
