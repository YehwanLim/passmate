import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw } from "lucide-react";
import AuthButton from "@/components/AuthButton";
import Logo from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { getLoginRedirectPath } from "@/hooks/useRequireAuth";
import {
  createPurchaseIntent,
  fetchEntitlementSummary,
  type EntitlementSummary,
} from "@/lib/entitlements";
import { supabase } from "@/lib/supabase";

function CreditSkeleton() {
  return (
    <div
      className="border-y border-white/5"
      aria-label="이용권 정보를 불러오는 중"
    >
      {[1, 2, 3].map(row => (
        <div
          key={row}
          className="h-[76px] border-b border-white/5 bg-white/[0.015] last:border-b-0 animate-pulse"
        />
      ))}
    </div>
  );
}

function CreditSummaryRow({
  title,
  description,
  remaining,
}: {
  title: string;
  description: string;
  remaining: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-medium text-zinc-300">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-600">{description}</p>
      </div>
      <p className="shrink-0 text-base font-medium text-zinc-100">
        {remaining}
        <span className="ml-0.5 text-xs font-normal text-zinc-500">회</span>
      </p>
    </div>
  );
}

export default function Entitlements() {
  const [, navigate] = useLocation();
  // 게스트도 이용권 안내는 볼 수 있다. 로그인은 구매·잔여 조회 시점에만 요구한다.
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseStarted, setPurchaseStarted] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  // 팝업 차단 시 사용자가 직접 클릭해 열 수 있도록 체크아웃 URL을 보관한다.
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

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

  const handlePurchase = useCallback(async () => {
    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const intent = await createPurchaseIntent(accessToken);
      // 결제는 Groble 체크아웃 새 탭에서 진행된다. ref 파라미터가 구매 의도를 연결한다.
      // 클릭 이후 await를 거치면 브라우저가 사용자 제스처로 보지 않아 팝업을 차단할 수 있어,
      // open 실패 시 사용자가 직접 여는 링크를 함께 제공한다.
      window.open(intent.checkoutUrl, "_blank", "noopener,noreferrer");
      setCheckoutUrl(intent.checkoutUrl);
      setPurchaseStarted(true);
    } catch {
      setPurchaseError("구매를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsPurchasing(false);
    }
  }, [getAccessToken]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28 text-white">
      <motion.nav
        className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-lg"
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="홈으로 돌아가기"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
              aria-label="Pre:View 홈"
            >
              <Logo className="h-6 w-auto" />
            </button>
          </div>
          <AuthButton />
        </div>
      </motion.nav>

      <main
        className={`container ${isAuthenticated ? "max-w-3xl" : "max-w-4xl"} pt-10 pb-8`}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-1">
            이용권
          </h1>
          <p className="text-[14px] text-zinc-500 font-light">
            {isAuthenticated
              ? "현재 보유한 분석 이용권을 간단히 확인할 수 있어요."
              : "무료 1회로 시작하고, 필요한 만큼만 이용권을 구매할 수 있어요."}
          </p>
        </motion.div>

        <section className="mt-8" aria-live="polite">
          {authLoading ? (
            <CreditSkeleton />
          ) : !isAuthenticated ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* 무료 체험 */}
                <div className="flex h-full flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 md:p-9">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                    무료 체험
                  </p>
                  <p className="mt-5 text-[2rem] font-bold tracking-tight text-white">
                    0원
                    <span className="ml-1 text-[15px] font-medium text-zinc-500">
                      / 1회
                    </span>
                  </p>
                  <p className="mt-1.5 text-xs font-light text-zinc-500">
                    가입하면 바로 제공돼요
                  </p>
                  <p className="mt-6 text-[14.5px] font-medium leading-relaxed text-zinc-200">
                    지금 쓴 자소서, 어떻게 읽히는지 먼저 확인해 보세요.
                  </p>
                  <p className="mb-7 mt-2 flex-1 text-[13px] font-light leading-[1.8] text-zinc-500">
                    첫 분석은 가입만 하면 무료예요. 리포트는 유료와 똑같이
                    전체를 드립니다. 카드 등록도 필요 없어요.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/analyze")}
                    className="h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.05] text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1]"
                  >
                    무료로 분석하기
                  </button>
                </div>

                {/* 분석 이용권 */}
                <div className="flex h-full flex-col rounded-2xl border border-blue-500/[0.25] bg-white/[0.02] p-8 md:p-9">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-blue-400">
                    분석 이용권
                  </p>
                  <p className="mt-5 text-[2rem] font-bold tracking-tight text-white">
                    9,900원
                    <span className="ml-1 text-[15px] font-medium text-zinc-500">
                      / 3회
                    </span>
                  </p>
                  <p className="mt-1.5 text-xs font-light text-zinc-500">
                    회당 3,300원
                  </p>
                  <p className="mt-6 text-[14.5px] font-medium leading-relaxed text-zinc-200">
                    다음 지원, 다음 수정 때 꺼내 쓰세요.
                  </p>
                  <p className="mb-7 mt-2 flex-1 text-[13px] font-light leading-[1.8] text-zinc-500">
                    지원하는 회사가 바뀌면 리포트의 기준도 바뀝니다. 고쳐 쓴
                    자소서가 정말 나아졌는지도 다시 확인해 보세요.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(getLoginRedirectPath("/entitlements"))}
                    className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-400 hover:to-cyan-300"
                  >
                    이용권 구매하기
                  </button>
                </div>
              </div>

              <p className="text-center text-xs text-zinc-600">
                로그인하면 보유한 이용권을 확인하고 바로 구매할 수 있어요.
              </p>
            </div>
          ) : isLoading ? (
            <CreditSkeleton />
          ) : error && !summary ? (
            <div className="rounded-xl border border-red-400/[0.18] bg-red-400/[0.06] px-6 py-6 text-center">
              <p className="text-sm text-red-100">{error}</p>
              <button
                type="button"
                onClick={() => void loadEntitlements()}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]"
              >
                <RefreshCw className="h-4 w-4" />
                다시 시도
              </button>
            </div>
          ) : summary ? (
            <div className="space-y-4">
              {error && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-red-400/[0.18] bg-red-400/[0.06] px-4 py-3">
                  <p className="text-sm text-red-100">{error}</p>
                  <button
                    type="button"
                    onClick={() => void loadEntitlements()}
                    className="shrink-0 text-sm font-medium text-white underline underline-offset-4"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              <div className="border-y border-white/5">
                <div className="flex items-center justify-between gap-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-300">
                      남은 분석
                    </p>
                    <p className="mt-0.5 text-xl font-semibold tracking-tight text-white">
                      {summary.remaining}
                      <span className="ml-0.5 text-sm font-medium text-zinc-500">
                        회
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      분석 결과가 저장될 때 차감돼요.
                    </p>
                  </div>

                  {summary.premiumEnabled && summary.groblePaymentUrl ? (
                    <div className="shrink-0 text-right">
                      <p className="mb-1.5 text-sm font-semibold text-white">
                        9,900원
                        <span className="ml-1 text-xs font-medium text-zinc-500">
                          / 분석 3회
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => void handlePurchase()}
                        disabled={isPurchasing}
                        className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {isPurchasing ? "여는 중..." : "이용권 구매하기"}
                      </button>
                      <p className="mt-1.5 text-[11px] text-zinc-500">
                        환불 기준은{" "}
                        <button
                          type="button"
                          onClick={() => navigate("/terms")}
                          className="underline underline-offset-2 hover:text-zinc-300"
                        >
                          이용약관
                        </button>
                        을 확인해 주세요.
                      </p>
                      {purchaseError && (
                        <p className="mt-2 text-xs text-red-200">{purchaseError}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600">
                      현재 추가 이용권 판매를 준비하고 있어요.
                    </p>
                  )}
                </div>

                {purchaseStarted && (
                  <div className="flex items-center justify-between gap-4 border-t border-white/5 py-3">
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
                      onClick={() => void loadEntitlements()}
                      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-white underline underline-offset-4"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      새로고침
                    </button>
                  </div>
                )}
              </div>

              <div className="divide-y divide-white/5">
                <CreditSummaryRow
                  title="무료 이용권"
                  description="가입 후 제공되는 무료 분석 이용권이에요."
                  remaining={summary.freeRemaining}
                />
                <CreditSummaryRow
                  title="프리미엄 이용권"
                  description="구매 후 사용할 수 있는 추가 분석 이용권이에요."
                  remaining={summary.premiumRemaining}
                />
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
