import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, FileText, RefreshCw } from "lucide-react";
import AuthButton from "@/components/AuthButton";
import Logo from "@/components/Logo";
import { getLoginRedirectPath, useRequireAuth } from "@/hooks/useRequireAuth";
import {
  fetchEntitlementSummary,
  type EntitlementSummary,
} from "@/lib/entitlements";
import { supabase } from "@/lib/supabase";

const ACTION_BUTTON_BASE =
  "h-11 w-full rounded-xl text-sm font-semibold transition-colors";
const PRIMARY_ACTION_CLASS = `${ACTION_BUTTON_BASE} bg-white text-black hover:bg-zinc-200`;
const SECONDARY_ACTION_CLASS = `${ACTION_BUTTON_BASE} border border-white/30 bg-white/[0.16] text-white hover:bg-white/[0.24]`;

function CreditSkeleton() {
  return (
    <div className="space-y-4" aria-label="이용권 정보를 불러오는 중">
      {[248, 96].map(height => (
        <div
          key={height}
          style={{ height }}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] animate-pulse"
        />
      ))}
    </div>
  );
}

/**
 * 분석 종류(자소서·기업)를 카드 한 장으로 묶는다. 두 크레딧 풀은 서로 쓸 수 없어서,
 * 경계가 흐리면 합계를 잘못 읽는다 — 카드·아이콘으로 소속을 눈에 띄게 나눈다.
 */
function CreditGroupCard({
  icon,
  title,
  description,
  remaining,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  remaining: number;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-zinc-300">
            {icon}
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-100">{title}</p>
            <p className="mt-1 text-xs text-zinc-500">{description}</p>
          </div>
        </div>
        <p className="shrink-0 text-2xl font-semibold tracking-tight text-white">
          {remaining}
          <span className="ml-0.5 text-sm font-medium text-zinc-500">회</span>
        </p>
      </div>

      {children ? (
        <div className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {children}
        </div>
      ) : null}
    </section>
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

/**
 * MyEntitlements — 프로필 메뉴 > 내 이용권에서 보는 보유 현황 페이지.
 * 가격표·구매는 /entitlements(이용권 구매)로 분리되어 있다.
 */
export default function MyEntitlements() {
  const [, navigate] = useLocation();
  // 보유 현황은 계정 데이터라 로그인 필수 — 미인증이면 로그인으로 보낸다.
  const { user, isLoading: authLoading } = useRequireAuth({
    redirectPath: "/my/entitlements",
  });
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEntitlements = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate(getLoginRedirectPath("/my/entitlements"));
        return;
      }

      setSummary(await fetchEntitlementSummary(session.access_token));
    } catch {
      setSummary(null);
      setError("이용권 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      void loadEntitlements();
    }
  }, [authLoading, user?.id, loadEntitlements]);

  // 남은 횟수가 있을 때만 분석 진입을 주 행동으로 올린다 — 0회면 /analyze 는 제출 단계에서 막힌다.
  // 아직 못 불러왔으면(로딩·에러) 어느 쪽도 강조하지 않는다.
  const hasEssayCredit = (summary?.remaining ?? 0) > 0;
  const hasCompanyCredit = Boolean(
    summary?.companyAnalysisEnabled && summary.companyRemaining > 0
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28 text-white">
      <motion.nav
        className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-lg border-b border-white/5"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <Logo className="h-6 w-auto" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200"
              onClick={() => navigate("/my")}
            >
              My
            </button>
            <AuthButton />
          </div>
        </div>
      </motion.nav>

      <main className="container max-w-2xl pt-10 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-1">
            내 이용권
          </h1>
          <p className="text-[14px] text-zinc-500 font-light">
            보유한 분석 이용권을 확인할 수 있어요.
          </p>
        </motion.div>

        <section className="mt-8 space-y-6" aria-live="polite">
          {authLoading || isLoading ? (
            <CreditSkeleton />
          ) : error ? (
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
              <CreditGroupCard
                icon={<FileText className="h-4 w-4" />}
                title="자소서 분석"
                description="아래 세 이용권을 합한 횟수예요. 분석 결과가 저장될 때 차감돼요."
                remaining={summary.remaining}
              >
                <CreditSummaryRow
                  title="무료 이용권"
                  description="가입 후 제공되는 무료 분석 이용권이에요."
                  remaining={summary.freeRemaining}
                />
                <CreditSummaryRow
                  title="보너스 이용권"
                  description="피드백 참여 보상 등으로 받은 이용권이에요."
                  remaining={summary.bonusRemaining}
                />
                <CreditSummaryRow
                  title="프리미엄 이용권"
                  description="구매 후 사용할 수 있는 추가 분석 이용권이에요."
                  remaining={summary.premiumRemaining}
                />
              </CreditGroupCard>

              <CreditGroupCard
                icon={<Building2 className="h-4 w-4" />}
                title="기업 분석"
                description="회사·직무를 넣으면 기업 분석 리포트를 만들어 드려요."
                remaining={summary.companyRemaining}
              />
            </div>
          ) : null}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => navigate("/analyze")}
              className={
                hasEssayCredit ? PRIMARY_ACTION_CLASS : SECONDARY_ACTION_CLASS
              }
            >
              자소서 분석하기
            </button>

            {hasCompanyCredit ? (
              <button
                type="button"
                onClick={() => navigate("/company-analysis")}
                className={SECONDARY_ACTION_CLASS}
              >
                기업 분석하기
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => navigate("/entitlements")}
              className={
                summary && !hasEssayCredit && !hasCompanyCredit
                  ? PRIMARY_ACTION_CLASS
                  : SECONDARY_ACTION_CLASS
              }
            >
              이용권 구매하기
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
