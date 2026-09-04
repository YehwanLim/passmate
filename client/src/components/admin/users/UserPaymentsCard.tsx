import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import {
  estimatedAmountFor,
  formatKrw,
  productLabel,
} from "@/lib/pricing";
import type {
  UserDetailPayment,
  UserDetailPendingPurchase,
} from "@/hooks/admin/useUserDetail";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

interface UserPaymentsCardProps {
  payments: UserDetailPayment[];
  pending_purchases: UserDetailPendingPurchase[];
}

/**
 * UserPaymentsCard
 *
 * 관리자 사용자 상세의 결제 내역 카드.
 *
 * 금액은 DB에 없다 — 금액의 진실은 Groble 상품 설정이다. 여기 보이는 금액은
 * 현재 판매가를 과거 결제에 소급한 **추정치**라서 가격을 바꾸면 과거 금액도 함께
 * 바뀌어 보인다. 정산은 Groble 화면을 기준으로 한다.
 */
export function UserPaymentsCard({ payments, pending_purchases }: UserPaymentsCardProps) {
  const estimatedTotal = payments.reduce(
    (sum, payment) => sum + (estimatedAmountFor(payment.product) ?? 0),
    0
  );
  const hasUnknownProduct = payments.some((payment) => payment.product === null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="size-4" />
            결제 내역
          </CardTitle>
          {payments.length > 0 && (
            <span className="text-xs text-muted-foreground">
              총 {payments.length}건 · 추정 {formatKrw(estimatedTotal)}
            </span>
          )}
        </div>
        <CardDescription className="text-xs">
          금액은 현재 판매가로 되짚은 추정치입니다. 정산 금액은 Groble 기준입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">결제 내역이 없습니다.</p>
        ) : (
          <ul className="space-y-1">
            {payments.map((payment) => {
              const amount = estimatedAmountFor(payment.product);
              return (
                <li
                  key={payment.id}
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span>
                    <span className="font-medium">{productLabel(payment.product)}</span>
                    {" · "}크레딧 +{payment.credits_granted}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {amount === null ? "금액 불명" : `추정 ${formatKrw(amount)}`}
                    {" · "}
                    {formatDateTime(payment.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {hasUnknownProduct && (
          <p className="text-xs text-muted-foreground">
            상품을 알 수 없는 결제가 있습니다. 등록되지 않은 Groble contentId 로 들어온
            결제이니 지급된 크레딧을 기준으로 확인하세요.
          </p>
        )}

        {pending_purchases.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              결제 시도 (미완료)
              <Badge variant="outline" className="text-[10px]">
                {pending_purchases.length}건
              </Badge>
            </p>
            <ul className="space-y-1">
              {pending_purchases.map((intent) => (
                <li
                  key={intent.id}
                  className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span>
                    {productLabel(intent.product)}
                    {" · "}
                    {intent.status === "CANCELLED" ? "취소됨" : "결제창 진입 후 이탈"}
                  </span>
                  <span className="shrink-0">{formatDateTime(intent.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UserPaymentsCard;
