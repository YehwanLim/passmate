import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Menu, RefreshCw, X } from "lucide-react";
import AuthButton from "@/components/AuthButton";
import Logo from "@/components/Logo";
import { HOME_NAV_ITEMS } from "@/pages/Home";
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
  SEASONAL_DISCOUNT_LABEL,
  TIERS,
  formatKrw,
  savingsFor,
} from "@/lib/pricing";
import { supabase } from "@/lib/supabase";

// 환불을 포함한 결제 문의는 메일로 받는다 — Groble이 부분 환불을 지원하지 않아 수동 처리가 전제다.
const PAYMENT_INQUIRY_MAILTO = `mailto:hansitoring@gmail.com?subject=${encodeURIComponent(
  "[Pre:View] 결제 문의"
)}&body=${encodeURIComponent(
  "아래 내용을 채워 보내주시면 영업일 기준 3일 이내에 안내드릴게요.\n\n- 결제일:\n- 결제 확인 정보(주문번호 또는 결제 이메일):\n- 문의 내용(환불 요청 시 사유 포함):\n"
)}`;

// 카드 문구: "언제 쓰는 이용권인지"(굵게) + 무엇을 받는지 한 줄. 세 카드가 같은 꼴로 읽히지 않게 상황으로 가른다.
const TIER_COPY: Record<(typeof TIERS)[number]["key"], { when: string; what: Partial<Record<PurchaseProductKey, string>> }> = {
  basic: {
    when: "한 번만 필요할 때",
    what: {
      single: "자소서 한 편을 제출 전에 점검받아요.",
      company: "지원할 회사 한 곳을 자소서 쓰기 전에 조사해요.",
    },
  },
  standard: {
    when: "한 회사를 제대로 준비할 때",
    what: {
      standard: "회사를 조사한 뒤 자소서를 쓰고, 고쳐 쓴 자소서를 한 번 더 진단받아요.",
    },
  },
  premium: {
    when: "여러 회사에 함께 지원할 때",
    what: {
      premium: "회사 세 곳을 조사하고, 회사마다 자소서 분석을 한 번씩 할 수 있어요.",
    },
  },
};

/** 티어별 강조 글자색 — 할인 문구가 그 카드의 버튼 색과 같은 계열로 읽히게 한다. */
const PLAN_ACCENT_TEXT: Record<PurchaseProductKey, string> = {
  single: "text-sky-300",
  company: "text-sky-300",
  standard: "text-sky-300",
  premium: "text-violet-300",
  triple: "text-sky-300",
};

/**
 * 티어별 구매 버튼 — 랜딩 이용권 섹션(PricingSection)에서 쓰는 버튼 디자인 그대로다.
 * 베이직은 그 섹션의 일반 버튼, 스탠다드·프리미엄은 강조 버튼의 그라데이션에 색만 바꿨다.
 * 상품 키 기준이라 베이직은 자소서·기업 어느 쪽을 골라도 같은 모양이다.
 */
const PLAN_BUTTON_BASIC =
  "border border-white/[0.12] bg-white/[0.05] text-zinc-200 hover:bg-white/[0.1]";
const PLAN_BUTTON_CLASS: Record<PurchaseProductKey, string> = {
  single: PLAN_BUTTON_BASIC,
  company: PLAN_BUTTON_BASIC,
  standard:
    "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20 hover:from-blue-400 hover:to-cyan-300",
  premium:
    "bg-gradient-to-r from-violet-300 to-purple-200 text-[#2E1065] shadow-lg shadow-violet-400/20 hover:from-violet-200 hover:to-purple-100",
  triple: PLAN_BUTTON_BASIC,
};

/** 추천 카드 — 랜딩의 "커피 한 잔" 기준과 같은 스탠다드. */
const RECOMMENDED_TIER = "standard";

type BasicChoice = "single" | "company";

export default function Entitlements() {
  const [, navigate] = useLocation();
  // 게스트도 이용권 안내는 볼 수 있다. 로그인은 구매·잔여 조회 시점에만 요구한다.
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseStarted, setPurchaseStarted] = useState(false);
  // 팝업 차단 시 사용자가 직접 클릭해 열 수 있도록 체크아웃 URL을 보관한다.
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [basicChoice, setBasicChoice] = useState<BasicChoice>("single");
  const [availability, setAvailability] = useState<SalesAvailability | null>(null);

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
  useEffect(() => {
    if (window.location.hash === "#company") {
      setBasicChoice("company");
      document.getElementById("basic")?.scrollIntoView({ block: "start" });
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

  const renderPaidPlanButton = (product: PurchaseProductKey) => {
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
        <p className="flex h-11 items-center justify-center text-xs text-zinc-500">
          현재 추가 이용권 판매를 준비하고 있어요.
        </p>
      );
    }

    return (
      <button
        type="button"
        onClick={() => startCheckout(product)}
        className={buttonClassName}
      >
        {`${plan.label} 구매하기`}
      </button>
    );
  };

  const renderTierCard = (tier: (typeof TIERS)[number]) => {
    const product: PurchaseProductKey = tier.key === "basic" ? basicChoice : tier.products[0];
    const plan = PRICING[product];
    const recommended = tier.key === RECOMMENDED_TIER;
    const hasStrike = plan.listPrice > plan.salePrice;
    const totalUses = plan.uses + plan.companyUses;
    const usesLabel = [
      plan.uses > 0 ? `자소서 진단 ${plan.uses}회` : null,
      plan.companyUses > 0 ? `기업 분석 ${plan.companyUses}회` : null,
    ]
      .filter(Boolean)
      .join(" + ");

    return (
      <div
        key={tier.key}
        id={tier.key}
        className={`plan-card flex h-full flex-col rounded-2xl border p-7 md:p-8 ${
          recommended
            ? "plan-card--recommended border-white/[0.3] bg-white/[0.06]"
            : "border-white/[0.12] bg-white/[0.035]"
        }`}
      >
        {recommended && <span className="plan-badge">추천</span>}

        <p className="text-[21px] font-bold tracking-tight text-white">
          {tier.label}
        </p>

        {/* 베이직만 토글이 들어가 아래 가격 줄이 밀리므로 구성 안내 영역 높이를 카드마다 맞춘다. */}
        <div className="mt-2.5 min-h-[62px]">
          {tier.key === "basic" ? (
            <div>
            <p className="text-[11px] font-medium text-zinc-500">
              둘 중 하나를 골라 주세요
            </p>
            <div
              role="radiogroup"
              aria-label="베이직 구성 선택"
              className="mt-1.5 grid grid-cols-2 gap-2"
            >
              {tier.products.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={basicChoice === choice}
                  onClick={() => setBasicChoice(choice)}
                  className={`h-10 whitespace-nowrap rounded-xl border text-[12.5px] font-semibold transition-colors ${
                    basicChoice === choice
                      ? "border-white/40 bg-white/[0.12] text-white"
                      : "border-white/[0.12] bg-white/[0.05] text-zinc-400 hover:bg-white/[0.1] hover:text-zinc-200"
                  }`}
                >
                  {PRICING[choice].label}
                </button>
              ))}
            </div>
            </div>
          ) : (
            <p className="text-[13.5px] text-zinc-300">{usesLabel}</p>
          )}
        </div>

        <p className="mt-5 whitespace-nowrap text-[2.4rem] font-bold leading-none tracking-tight text-white">
          {formatKrw(plan.salePrice)}
          <span className="ml-1.5 text-[14px] font-medium text-zinc-300">
            / {totalUses}회
          </span>
        </p>

        {hasStrike ? (
          <p className="mt-2 whitespace-nowrap text-[12px] text-zinc-500 line-through decoration-zinc-500">
            {tier.key === "basic" ? "정가" : "따로 사면"} {formatKrw(plan.listPrice)}
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-zinc-500">정가 판매</p>
        )}

        <p className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap text-[12.5px] text-zinc-400">
          {totalUses > 0 && (
            <span>
              1회당{" "}
              <span className="font-semibold text-white">
                {formatKrw(Math.round(plan.salePrice / totalUses))}
              </span>
            </span>
          )}
          {totalUses > 0 && hasStrike && <span className="text-zinc-600">·</span>}
          {hasStrike && (
            <span className={`font-bold ${PLAN_ACCENT_TEXT[product]}`}>
              {plan.discountLabel}
            </span>
          )}
        </p>

        <div className="mt-5 flex-1">
          <p className="text-[15px] font-semibold text-white">{TIER_COPY[tier.key].when}</p>
          <p className="mt-1.5 text-[13.5px] leading-[1.7] text-zinc-300">{TIER_COPY[tier.key].what[product]}</p>
        </div>

        <div className="mt-6">{renderPaidPlanButton(product)}</div>
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
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
            이용권
          </h1>
          <p className="text-[14px] text-zinc-400 font-light">
            필요한 만큼만 사세요. 어떤 이용권이든 리포트는 같습니다.
            {isAuthenticated && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => navigate("/my/entitlements")}
                  className="text-zinc-300 underline underline-offset-4 transition-colors hover:text-white"
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
            {/* 무료 체험은 파는 물건이 아니라 입구다 — 카드 열에서 빼서 한 줄로. */}
            <div className="flex flex-col gap-3 rounded-xl border border-white/[0.12] bg-white/[0.035] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[14.5px] text-zinc-200">
                <span className="font-semibold text-white">첫 분석 1회는 무료</span>
                <span className="text-zinc-500"> · </span>
                가입만 하면 바로, 카드 등록 없이. 리포트는 유료와 똑같아요.
              </p>
              <button
                type="button"
                onClick={() => navigate("/analyze")}
                className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-white underline underline-offset-4 transition-colors hover:text-sky-300"
              >
                무료로 분석하기
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <p className="seasonal-discount-label w-fit pt-2 text-[14px] font-bold">
              {SEASONAL_DISCOUNT_LABEL}
            </p>

            <div className="grid gap-5 pt-1 md:grid-cols-3">
              {TIERS.map((tier) => renderTierCard(tier))}
            </div>

            {/* 리포트 구성 — 카드처럼 보이지 않게 상자 대신 구분선으로. */}
            <div className="grid gap-8 border-t border-white/[0.1] pt-8 md:grid-cols-2 md:gap-10">
              <div>
                <p className="text-[12.5px] font-semibold text-sky-300">
                  자소서 진단 리포트
                </p>
                <p className="mt-1.5 text-[14px] font-semibold text-white">
                  어떤 이용권을 선택하든, 이 모든 게 담깁니다
                </p>
                <ul className="mt-4 space-y-2.5">
                  {REPORT_INCLUDED_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-[14px] text-zinc-200">
                      <Check className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[12.5px] font-semibold text-sky-300">
                  기업 분석 리포트
                </p>
                <p className="mt-1.5 text-[14px] font-semibold text-white">
                  스탠다드·프리미엄에 포함, 베이직에서 따로 고를 수 있어요
                </p>
                <ul className="mt-4 space-y-2.5">
                  {COMPANY_REPORT_INCLUDED_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-[14px] text-zinc-200">
                      <Check className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[12.5px] text-zinc-400">
                  세 곳을 준비하면 프리미엄이 따로 살 때보다 {formatKrw(savingsFor(PRICING.premium))} 저렴합니다.
                </p>
              </div>
            </div>

            {purchaseStarted && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <p className="text-xs text-zinc-400">
                  새 탭에서 결제를 진행해 주세요. 결제를 완료하면 이용권이 곧 반영돼요.
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
              <p className="text-center text-xs text-zinc-500">
                로그인하면 보유한 이용권을 확인하고 바로 구매할 수 있어요.
              </p>
            )}

            {isAuthenticated && (
              <p className="text-right text-[12px] text-zinc-500">
                결제에 문제가 있나요?{" "}
                <a
                  href={PAYMENT_INQUIRY_MAILTO}
                  className="underline underline-offset-2 hover:text-zinc-300"
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
