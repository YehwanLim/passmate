import type { PurchaseProductKey, SalesAvailability } from "@/lib/entitlements";
import { PRICING } from "@/lib/pricing";
import { PLAN_BUTTON_CLASS } from "@/pages/entitlementsCopy";

/**
 * 티어 카드의 구매 버튼. 로딩 → 비활성, 게스트 → 로그인, 서버가 결제 URL을 안 주면 "판매 준비 중".
 * 결제 게이트는 서버(checkoutUrls)가 결정하고 여기서는 있는지만 본다.
 */
export function PlanPurchaseButton({
  product,
  authLoading,
  isAuthenticated,
  isLoading,
  availability,
  canPurchase,
  onBuy,
  onLogin,
}: {
  product: PurchaseProductKey;
  authLoading: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  availability: SalesAvailability | null;
  canPurchase: boolean;
  onBuy: (product: PurchaseProductKey) => void;
  onLogin: () => void;
}) {
  const plan = PRICING[product];
  const buttonClassName = `h-11 w-full rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${PLAN_BUTTON_CLASS[product]}`;

  // 아직 결제 URL을 모르는 동안은 "판매 준비 중"이 아니라 비활성 버튼을 보여준다 —
  // 로딩과 판매 중단은 다른 상태고, 섞으면 로그인한 사용자에게 틀린 안내가 깜빡인다.
  if (authLoading || (isAuthenticated && isLoading)) {
    return (
      <button type="button" disabled className={buttonClassName}>
        {plan.label} 구매하기
      </button>
    );
  }

  if (!isAuthenticated && availability && !availability.purchasable[product]) {
    return (
      <p className="flex h-11 items-center justify-center text-xs text-zinc-500">
        현재 추가 이용권 판매를 준비하고 있어요.
      </p>
    );
  }

  if (!isAuthenticated) {
    return (
      <button type="button" onClick={onLogin} className={buttonClassName}>
        {plan.label} 구매하기
      </button>
    );
  }

  if (!canPurchase) {
    return (
      <p className="flex h-11 items-center justify-center text-xs text-zinc-500">
        현재 추가 이용권 판매를 준비하고 있어요.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onBuy(product)}
      className={buttonClassName}
    >
      {`${plan.label} 구매하기`}
    </button>
  );
}
