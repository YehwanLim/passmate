import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, RefreshCw } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { PlanPurchaseButton } from "@/components/entitlements/PlanPurchaseButton";
import { TierCard } from "@/components/entitlements/TierCard";
import { useAuth } from "@/contexts/AuthContext";
import { getLoginRedirectPath } from "@/hooks/useRequireAuth";
import {
  fetchEntitlementSummary,
  fetchSalesAvailability,
  type EntitlementSummary,
  type PurchaseProductKey,
  type SalesAvailability,
} from "@/lib/entitlements";
import {
  COMPANY_REPORT_INCLUDED_FEATURES,
  PRICING,
  REPORT_INCLUDED_FEATURES,
  TIERS,
  formatKrw,
  savingsFor,
} from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { PAYMENT_INQUIRY_MAILTO, type BasicChoice } from "@/copy/entitlementsCopy";

export default function Entitlements() {
  const [, navigate] = useLocation();
  // 게스트도 이용권 안내는 볼 수 있다. 로그인은 구매·잔여 조회 시점에만 요구한다.
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseStarted, setPurchaseStarted] = useState(false);
  const [basicChoice, setBasicChoice] = useState<BasicChoice>("single");
  const [availability, setAvailability] = useState<SalesAvailability | null>(null);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate(getLoginRedirectPath("/entitlements"));
      return null;
    }

    return session.access_token;
  }, [navigate]);

  const loadEntitlements = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      setSummary(await fetchEntitlementSummary(accessToken));
    } catch {
      setSummary(null);
      setError("이용권 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void loadEntitlements();
    }
  }, [authLoading, isAuthenticated, loadEntitlements]);

  // 비로그인 방문자는 이용권 요약을 못 받으므로, 판매 가용성만 따로 물어 미판매 티어를 활성 버튼으로 보여 주지 않는다.
  // 실패하면 모르는 상태로 두고 로그인 버튼을 그대로 보여 준다(로그인 후 서버가 다시 판단).
  useEffect(() => {
    if (authLoading || isAuthenticated) return;
    let cancelled = false;
    fetchSalesAvailability()
      .then((next) => {
        if (!cancelled) setAvailability(next);
      })
      .catch(() => {
        /* 모르면 로그인 버튼 유지 */
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  // /entitlements#company — 기업 분석 이용권이 없어서 온 사용자는 베이직 카드의 기업 분석을 바로 고른 상태로 만난다.
  // /entitlements#standard·#premium — 소진 모달 등에서 추천 티어로 바로 스크롤한다.
  useEffect(() => {
    if (window.location.hash === "#company") {
      setBasicChoice("company");
      document.getElementById("basic")?.scrollIntoView({ block: "start" });
      return;
    }
    const targetId = window.location.hash.slice(1);
    if (TIERS.some((tier) => tier.key === targetId)) {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    }
  }, []);

  const startCheckout = useCallback(
    (product: PurchaseProductKey) => {
      const path = `/checkout?product=${product}`;
      // 클릭한 그 순간에 열어야 브라우저가 사용자 제스처로 인정해 팝업을 막지 않는다.
      // 구매 의도 생성(서버 왕복)은 새 탭이 맡는다 — 여기서 await 하면 창이 차단된다.
      const opened = window.open(path, "_blank");
      if (!opened) {
        navigate(path);
        return;
      }
      setPurchaseStarted(true);
    },
    [navigate]
  );

  // 결제 게이트: 서버가 판매 스위치·상품 활성·결제 URL을 모두 반영해 checkoutUrls 를 준다. 페이지는 있는지만 본다.
  const canPurchase = (product: PurchaseProductKey) => {
    if (!summary) return false;
    return Boolean(summary.checkoutUrls[product]);
  };

  return (
    <div className="min-h-screen bg-stage pb-28 text-ink">
      {/* 등장 모션은 transform 만: initial 의 opacity:0 은 빌드 프리렌더 HTML 에 구워져 하이드레이션 전까지 투명해진다(랜딩에서 겪은 문제). */}
      <SiteHeader variant="light" />

      <main className="container max-w-5xl pt-10 pb-8">
        <motion.div
          initial={{ y: 16 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink">
            이용권
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-4">
            필요한 만큼만 사세요. 어떤 이용권이든 자소서 리포트는 같습니다.
            {isAuthenticated && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => navigate("/my/entitlements")}
                  className="font-semibold text-ink-2 underline underline-offset-4 transition-colors hover:text-ink"
                >
                  내 이용권 현황 보기
                </button>
              </>
            )}
          </p>
        </motion.div>

        <section className="mt-8 space-y-10" aria-live="polite">
          {/* 보유 현황은 /my/entitlements로 분리 — 여기서는 구매 게이트 복구용 에러만 보여준다. */}
          {isAuthenticated && !isLoading && error && (
            <div className="flex items-center justify-between gap-4 rounded-[16px] bg-danger-soft px-4 py-3">
              <p className="text-sm text-danger">{error}</p>
              <button
                type="button"
                onClick={() => void loadEntitlements()}
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-ink-2 underline underline-offset-4 hover:text-ink"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                다시 시도
              </button>
            </div>
          )}

          {/* 가격 카드 — 로그인 여부와 상관없이 항상 보여준다. */}
          <div className="space-y-6">
            {/* 무료 체험은 파는 물건이 아니라 입구다 — 카드 열에서 빼서 한 줄로. */}
            <div className="flex flex-col gap-3 rounded-[20px] bg-surface px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[15px] font-semibold text-ink">첫 분석은 무료예요</p>
              <button
                type="button"
                onClick={() => navigate("/analyze")}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-[10px] bg-brand-soft px-4 text-[14px] font-semibold text-brand-ink transition-colors hover:bg-[#dceaff] sm:self-auto"
              >
                무료로 분석하기
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-5 pt-1 md:grid-cols-3">
              {TIERS.map((tier) => {
                const product: PurchaseProductKey = tier.key === "basic" ? basicChoice : tier.products[0];
                return (
                  <TierCard
                    key={tier.key}
                    tier={tier}
                    basicChoice={basicChoice}
                    onBasicChoice={setBasicChoice}
                  >
                    <PlanPurchaseButton
                      product={product}
                      authLoading={authLoading}
                      isAuthenticated={isAuthenticated}
                      isLoading={isLoading}
                      availability={availability}
                      canPurchase={canPurchase(product)}
                      onBuy={startCheckout}
                      onLogin={() => navigate(getLoginRedirectPath("/entitlements"))}
                    />
                  </TierCard>
                );
              })}
            </div>

            {/* 리포트 구성 — 체크 목록은 배경에 묻혀서, 가격 카드와 같은 흰 카드에 제목을 크게 두고 항목은 줄로 나눈다. */}
            <div className="grid gap-5 pt-5 md:grid-cols-2">
              <div className="rounded-[20px] bg-surface px-6 py-7 md:px-8">
                <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink">
                  자소서 진단 리포트
                </h2>
                <p className="mt-1 text-[14px] text-ink-4">
                  어떤 이용권이든 내용은 같아요
                </p>
                <ul className="mt-5 divide-y divide-line-soft border-t border-line-soft">
                  {REPORT_INCLUDED_FEATURES.map((feature) => (
                    <li key={feature} className="py-3 text-[15px] text-ink-2">
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[20px] bg-surface px-6 py-7 md:px-8">
                <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink">
                  기업 분석 리포트
                </h2>
                <p className="mt-1 text-[14px] text-ink-4">
                  스탠다드·프리미엄에 포함, 베이직에서 따로 고를 수 있어요
                </p>
                <ul className="mt-5 divide-y divide-line-soft border-t border-line-soft">
                  {COMPANY_REPORT_INCLUDED_FEATURES.map((feature) => (
                    <li key={feature} className="py-3 text-[15px] text-ink-2">
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[13px] text-ink-4">
                  세 곳을 준비하면 프리미엄이 따로 살 때보다 {formatKrw(savingsFor(PRICING.premium))} 저렴합니다.
                </p>
              </div>
            </div>

            {purchaseStarted && (
              <div className="flex items-center justify-between gap-4 rounded-[16px] bg-surface px-5 py-4">
                <p className="text-[13px] text-ink-3">
                  새 탭에서 결제를 진행해 주세요. 결제를 완료하면 이용권이 곧 반영돼요.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/my/entitlements")}
                  className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-brand-ink hover:text-brand"
                >
                  내 이용권 확인
                </button>
              </div>
            )}

            {!isAuthenticated && (
              <p className="text-center text-[13px] text-ink-4">
                로그인하면 보유한 이용권을 확인하고 바로 구매할 수 있어요.
              </p>
            )}

            {isAuthenticated && (
              <p className="text-right text-[13px] text-ink-4">
                결제에 문제가 있나요?{" "}
                <a
                  href={PAYMENT_INQUIRY_MAILTO}
                  className="underline underline-offset-2 hover:text-ink-2"
                >
                  이메일로 문의하기
                </a>
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
