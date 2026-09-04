import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

import Logo from "@/components/Logo";
import { getLoginRedirectPath } from "@/hooks/useRequireAuth";
import {
  createPurchaseIntent,
  type PurchaseProductKey,
} from "@/lib/entitlements";
import { PRICING } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";

const PRODUCT_KEYS: PurchaseProductKey[] = ["single", "triple"];

function readProduct(search: string): PurchaseProductKey | null {
  const value = new URLSearchParams(search).get("product");
  return PRODUCT_KEYS.find((key) => key === value) ?? null;
}

type Phase = "opening" | "invalid" | "failed";

/**
 * Checkout
 *
 * 이용권 구매 버튼이 새 탭으로 여는 중간 페이지(/checkout?product=single|triple).
 *
 * 구매 의도를 만들어 그 id를 결제 URL의 ref 로 붙여야 Groble 웹훅이 결제 주인을
 * 찾을 수 있다. 그 서버 왕복을 클릭과 창 열기 사이에 두면 브라우저가 팝업으로
 * 보고 막을 수 있어, 창을 먼저 열고 기다림을 이 페이지 안으로 옮겼다.
 */
export default function Checkout() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("opening");
  const [product, setProduct] = useState<PurchaseProductKey | null>(null);

  const openCheckout = useCallback(async () => {
    const requested = readProduct(window.location.search);
    setProduct(requested);

    if (!requested) {
      setPhase("invalid");
      return;
    }

    setPhase("opening");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate(getLoginRedirectPath(`/checkout?product=${requested}`));
      return;
    }

    try {
      const intent = await createPurchaseIntent(session.access_token, requested);
      // 결제 페이지에 이 탭의 제어권을 남기지 않는다(역 탭내빙 방지).
      window.opener = null;
      window.location.replace(intent.checkoutUrl);
    } catch {
      setPhase("failed");
    }
  }, [navigate]);

  useEffect(() => {
    void openCheckout();
  }, [openCheckout]);

  const planLabel = product ? PRICING[product].label : "이용권";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0A0A0A] px-6 text-white">
      <Logo />

      {phase === "opening" && (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-5 animate-spin text-zinc-500" />
          <p className="text-sm text-zinc-300">
            {planLabel} 결제 페이지로 이동하고 있어요.
          </p>
          <p className="text-xs text-zinc-600">잠시만 기다려 주세요.</p>
        </div>
      )}

      {phase === "invalid" && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-zinc-300">
            이용권 정보를 확인하지 못했어요.
          </p>
          <button
            type="button"
            onClick={() => navigate("/entitlements")}
            className="text-sm font-medium text-white underline underline-offset-4"
          >
            이용권 안내로 돌아가기
          </button>
        </div>
      )}

      {phase === "failed" && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-zinc-300">결제 페이지를 열지 못했어요.</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => void openCheckout()}
              className="text-sm font-medium text-white underline underline-offset-4"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => navigate("/entitlements")}
              className="text-sm text-zinc-500 underline underline-offset-4"
            >
              이용권 안내로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
