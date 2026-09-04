import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Menu, RefreshCw, X } from "lucide-react";
import AuthButton from "@/components/AuthButton";
import Logo from "@/components/Logo";
import { HOME_NAV_ITEMS } from "@/pages/Home";
import { useAuth } from "@/contexts/AuthContext";
import { getLoginRedirectPath } from "@/hooks/useRequireAuth";
import {
  createPurchaseIntent,
  fetchEntitlementSummary,
  type EntitlementSummary,
  type PurchaseProductKey,
} from "@/lib/entitlements";
import {
  PRICING,
  REPORT_INCLUDED_FEATURES,
  SEASONAL_DISCOUNT_LABEL,
  TRIPLE_PER_USE_PRICE,
  formatKrw,
} from "@/lib/pricing";
import { supabase } from "@/lib/supabase";

// 환불을 포함한 결제 문의는 메일로 받는다 — Groble이 부분 환불을 지원하지 않아 수동 처리가 전제다.
const PAYMENT_INQUIRY_MAILTO = `mailto:hansitoring@gmail.com?subject=${encodeURIComponent(
  "[Pre:View] 결제 문의"
)}&body=${encodeURIComponent(
  "아래 내용을 채워 보내주시면 영업일 기준 3일 이내에 안내드릴게요.\n\n- 결제일:\n- 결제 확인 정보(주문번호 또는 결제 이메일):\n- 문의 내용(환불 요청 시 사유 포함):\n"
)}`;

const PAID_PLAN_COPY: Record<
  PurchaseProductKey,
  { lead: string; body: string; perUseNote: string }
> = {
  single: {
    lead: "당장 앞둔 마감 하나에 집중하고 싶다면.",
    body: "지금 쓴 자소서가 채용 담당자에게 어떻게 읽히는지, 제출 전에 확인해 보세요.",
    perUseNote: "이번 지원, 제출 전 마지막 점검",
  },
  triple: {
    lead: "고쳐 쓰고, 다시 확인하고, 다음 지원까지.",
    body: "지원하는 회사가 바뀌면 리포트의 기준도 바뀝니다. 고쳐 쓴 자소서가 정말 나아졌는지도 다시 확인해 보세요.",
    perUseNote: `회당 ${formatKrw(TRIPLE_PER_USE_PRICE)} — 커피 한 잔 값`,
  },
};

export default function Entitlements() {
  const [, navigate] = useLocation();
  // 게스트도 이용권 안내는 볼 수 있다. 로그인은 구매·잔여 조회 시점에만 요구한다.
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingProduct, setPurchasingProduct] =
    useState<PurchaseProductKey | null>(null);
  const [purchaseStarted, setPurchaseStarted] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  // 팝업 차단 시 사용자가 직접 클릭해 열 수 있도록 체크아웃 URL을 보관한다.
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 랜딩과 같은 GNB 메뉴를 유지한다. 섹션 타입은 랜딩으로 이동한 뒤 해당 섹션으로 스크롤.
  const handleNavClick = useCallback(
    (target: string, type: string) => {
      setIsMobileMenuOpen(false);

      if (type === "section") {
        navigate("/");
        // 랜딩이 마운트되기를 기다렸다가 해당 섹션으로 스크롤한다.
        let attempts = 0;
        const scrollToTarget = () => {
          const element = document.getElementById(target);
          if (element) {
            element.scrollIntoView({ behavior: "smooth" });
            return;
          }
          if (attempts++ < 10) {
            window.setTimeout(scrollToTarget, 100);
          }
        };
        window.setTimeout(scrollToTarget, 100);
        return;
      }

      if (target === "/entitlements") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      navigate(target);
    },
    [navigate]
  );

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

  const handlePurchase = useCallback(
    async (product: PurchaseProductKey) => {
      setPurchasingProduct(product);
      setPurchaseError(null);

      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;

        const intent = await createPurchaseIntent(accessToken, product);
        // 결제는 Groble 체크아웃 새 탭에서 진행된다. ref 파라미터가 구매 의도를 연결한다.
        // 클릭 이후 await를 거치면 브라우저가 사용자 제스처로 보지 않아 팝업을 차단할 수 있어,
        // open 실패 시 사용자가 직접 여는 링크를 함께 제공한다.
        window.open(intent.checkoutUrl, "_blank", "noopener,noreferrer");
        setCheckoutUrl(intent.checkoutUrl);
        setPurchaseStarted(true);
      } catch {
        setPurchaseError("구매를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
      } finally {
        setPurchasingProduct(null);
      }
    },
    [getAccessToken]
  );

  // 결제 게이트: 판매 스위치가 켜져 있고 해당 상품의 결제 URL이 설정된 경우에만 열린다.
  const canPurchase = (product: PurchaseProductKey) => {
    if (!summary) return false;
    const paymentUrl =
      product === "single"
        ? summary.grobleSinglePaymentUrl
        : summary.groblePaymentUrl;
    return Boolean(summary.premiumEnabled && paymentUrl);
  };

  const renderPaidPlanButton = (product: PurchaseProductKey) => {
    const plan = PRICING[product];
    const buttonClassName =
      product === "triple"
        ? "h-11 w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-400 hover:to-cyan-300 disabled:opacity-50"
        : "h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.05] text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1] disabled:opacity-50";

    if (!isAuthenticated) {
      return (
        <button
          type="button"
          onClick={() => navigate(getLoginRedirectPath("/entitlements"))}
          className={buttonClassName}
        >
          {plan.label} 구매하기
        </button>
      );
    }

    if (!canPurchase(product)) {
      return (
        <p className="flex h-11 items-center justify-center text-xs text-zinc-600">
          현재 추가 이용권 판매를 준비하고 있어요.
        </p>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void handlePurchase(product)}
        disabled={purchasingProduct !== null}
        className={buttonClassName}
      >
        {purchasingProduct === product ? "여는 중..." : `${plan.label} 구매하기`}
      </button>
    );
  };

  const renderPaidPlanCard = (product: PurchaseProductKey) => {
    const plan = PRICING[product];
    const copy = PAID_PLAN_COPY[product];
    const highlighted = product === "triple";

    return (
      <div
        className={`flex h-full flex-col rounded-2xl border bg-white/[0.02] p-8 md:p-9 ${
          highlighted ? "border-blue-500/[0.25]" : "border-white/[0.06]"
        }`}
      >
        <p
          className={`text-lg font-bold tracking-tight ${
            highlighted ? "text-blue-400" : "text-zinc-200"
          }`}
        >
          {plan.label}
        </p>
        <p className="mt-4 text-[2.4rem] font-bold leading-none tracking-tight text-white">
          {formatKrw(plan.salePrice)}
          <span className="ml-1.5 text-[15px] font-medium text-zinc-500">
            / {plan.uses}회
          </span>
        </p>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-3 text-[15px]">
          <span className="font-light text-zinc-400 line-through decoration-zinc-300/60 decoration-[1.5px]">
            정가 {formatKrw(plan.listPrice)}
          </span>
          <span className="text-lg font-extrabold tracking-tight text-sky-300">
            {plan.discountLabel}
          </span>
        </p>
        <p className="mt-1.5 text-xs font-light text-zinc-500">
          {copy.perUseNote}
        </p>
        <p className="mt-6 text-[14.5px] font-medium leading-relaxed text-zinc-200">
          {copy.lead}
        </p>
        <p className="mb-7 mt-2 flex-1 text-[13px] font-light leading-[1.8] text-zinc-500">
          {copy.body}
        </p>
        {renderPaidPlanButton(product)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28 text-white">
      <motion.nav
        className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-lg"
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 lg:px-10">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center"
            aria-label="Pre:View 홈"
          >
            <Logo className="h-5 w-auto" />
          </button>

          <div className="hidden items-center gap-4 sm:flex md:gap-7">
            {HOME_NAV_ITEMS.map(({ label, type, target }) => (
              <button
                key={label}
                className="landing-nav-link"
                onClick={() => handleNavClick(target, type)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <AuthButton />
            <button
              type="button"
              className="mobile-nav-toggle sm:hidden"
              aria-label="모바일 메뉴 열기"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-entitlements-nav"
              onClick={() => setIsMobileMenuOpen(open => !open)}
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              id="mobile-entitlements-nav"
              className="mobile-nav-panel sm:hidden"
              initial={{ opacity: 0, y: -8, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {HOME_NAV_ITEMS.map(({ label, type, target }) => (
                <button
                  key={label}
                  type="button"
                  className="mobile-nav-link"
                  onClick={() => handleNavClick(target, type)}
                >
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <main className="container max-w-5xl pt-10 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-1">
            이용권
          </h1>
          <p className="text-[14px] text-zinc-500 font-light">
            무료 1회로 시작하고, 필요한 만큼만 이용권을 구매할 수 있어요.
            {isAuthenticated && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => navigate("/my/entitlements")}
                  className="text-zinc-400 underline underline-offset-4 transition-colors hover:text-zinc-200"
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
            <div className="flex items-center justify-between gap-4 rounded-xl border border-red-400/[0.18] bg-red-400/[0.06] px-4 py-3">
              <p className="text-sm text-red-100">{error}</p>
              <button
                type="button"
                onClick={() => void loadEntitlements()}
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-white underline underline-offset-4"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                다시 시도
              </button>
            </div>
          )}

          {/* 가격 카드 — 로그인 여부와 상관없이 항상 보여준다. */}
          <div className="space-y-6">
            <p className="text-[14.5px] font-bold tracking-[0.14em] text-sky-300">
              {SEASONAL_DISCOUNT_LABEL}
            </p>

            <div className="grid gap-6 md:grid-cols-3">
              {/* 무료 체험 */}
              <div className="flex h-full flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 md:p-9">
                <p className="text-lg font-bold tracking-tight text-zinc-200">
                  무료 체험
                </p>
                <p className="mt-4 text-[2.4rem] font-bold leading-none tracking-tight text-white">
                  0원
                  <span className="ml-1 text-[15px] font-medium text-zinc-500">
                    / 1회
                  </span>
                </p>
                <p className="mt-1.5 text-[13px] font-light text-zinc-500">
                  가입하면 바로 제공돼요
                </p>
                <p className="mt-6 text-[14.5px] font-medium leading-relaxed text-zinc-200">
                  지금 쓴 자소서, 어떻게 읽히는지 먼저 확인해 보세요.
                </p>
                <p className="mb-7 mt-2 flex-1 text-[13px] font-light leading-[1.8] text-zinc-500">
                  첫 분석은 가입만 하면 무료예요. 리포트는 유료와 똑같이 전체를
                  드립니다. 카드 등록도 필요 없어요.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/analyze")}
                  className="h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.05] text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1]"
                >
                  무료로 분석하기
                </button>
              </div>

              {renderPaidPlanCard("single")}
              {renderPaidPlanCard("triple")}
            </div>

            {/* 어떤 이용권이든 리포트 구성은 동일하다 */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-7 py-6">
              <p className="text-[14px] font-semibold text-zinc-200">
                어떤 이용권을 선택하든, 리포트에는 이 모든 게 담깁니다
              </p>
              <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {REPORT_INCLUDED_FEATURES.map(feature => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-[13.5px] font-light text-zinc-400"
                  >
                    <Check className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {purchaseError && (
              <p className="text-center text-xs text-red-200">{purchaseError}</p>
            )}

            {purchaseStarted && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="text-xs text-zinc-500">
                  결제 창이 열리지 않았다면{" "}
                  {checkoutUrl ? (
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-white underline underline-offset-4"
                    >
                      여기를 눌러 결제 페이지를 열어 주세요
                    </a>
                  ) : (
                    "잠시 후 다시 시도해 주세요"
                  )}
                  . 결제를 완료하면 이용권이 곧 반영돼요.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/my/entitlements")}
                  className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-white underline underline-offset-4"
                >
                  내 이용권 확인
                </button>
              </div>
            )}

            {!isAuthenticated && (
              <p className="text-center text-xs text-zinc-600">
                로그인하면 보유한 이용권을 확인하고 바로 구매할 수 있어요.
              </p>
            )}

            {isAuthenticated && (
              <p className="text-right text-[11px] text-zinc-700">
                결제에 문제가 있나요?{" "}
                <a
                  href={PAYMENT_INQUIRY_MAILTO}
                  className="underline underline-offset-2 hover:text-zinc-500"
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
