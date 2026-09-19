import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Building2, FileText, RefreshCw } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { getLoginRedirectPath, useRequireAuth } from "@/hooks/useRequireAuth";
import {
  fetchEntitlementSummary,
  type EntitlementSummary,
} from "@/lib/entitlements";
import { supabase } from "@/lib/supabase";

// 랜딩의 CTA 쌍과 같은 버튼: 주 버튼은 landing-primary-cta(빛 스침·호버 상승), 보조 버튼은 높이·모서리를 맞춘 유리 표면.
const PRIMARY_ACTION_CLASS = "landing-primary-cta group w-full";
const SECONDARY_ACTION_CLASS =
  "inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.05] px-5 text-[13.5px] font-semibold tracking-[-0.01em] text-zinc-200 transition-colors hover:bg-white/[0.1]";

function ActionButton({
  primary,
  onClick,
  children,
}: {
  primary: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={primary ? PRIMARY_ACTION_CLASS : SECONDARY_ACTION_CLASS}
    >
      {primary ? (
        <>
          <span className="relative z-10">{children}</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </>
      ) : (
        children
      )}
    </button>
  );
}

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
 * 카드 우측의 남은 횟수. 숫자만 덜렁 놓으면 뭘 뜻하는지 읽히지 않아 "N회 남음" 한 줄로 쓴다.
 * 0회는 가라앉혀 "쓸 수 있는 게 있는지"가 한눈에 갈리게 한다.
 */
function RemainingStat({ remaining }: { remaining: number }) {
  const isEmpty = remaining === 0;

  return (
    <p
      className={`shrink-0 whitespace-nowrap pt-0.5 text-right leading-none ${
        isEmpty ? "text-zinc-600" : "text-white"
      }`}
    >
      <span className="text-3xl font-bold tracking-tight tabular-nums">
        {remaining}
      </span>
      <span
        className={`ml-0.5 text-sm font-medium ${isEmpty ? "text-zinc-600" : "text-zinc-300"}`}
      >
        회 남음
      </span>
    </p>
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
        <RemainingStat remaining={remaining} />
      </div>

      {children ? (
        <div className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06] sm:ml-12">
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
  // 0회인 풀은 통째로 가라앉혀서, 실제로 횟수가 남은 이용권만 눈에 들어오게 한다.
  const isEmpty = remaining === 0;

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p
          className={`text-sm font-medium ${isEmpty ? "text-zinc-500" : "text-zinc-200"}`}
        >
          {title}
        </p>
        <p className="mt-0.5 text-xs text-zinc-600">{description}</p>
      </div>
      <p
        className={`shrink-0 text-right text-base tabular-nums ${
          isEmpty ? "font-medium text-zinc-600" : "font-semibold text-white"
        }`}
      >
        {remaining}
        <span
          className={`ml-0.5 text-xs font-normal ${isEmpty ? "text-zinc-600" : "text-zinc-400"}`}
        >
          회
        </span>
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
      <SiteHeader />

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

          <div className="flex flex-col gap-3">
            <ActionButton
              primary={hasEssayCredit}
              onClick={() => navigate("/analyze")}
            >
              자소서 분석하기
            </ActionButton>

            {hasCompanyCredit ? (
              <ActionButton
                primary={false}
                onClick={() => navigate("/company-analysis")}
              >
                기업 분석하기
              </ActionButton>
            ) : null}

            <ActionButton
              primary={Boolean(summary && !hasEssayCredit && !hasCompanyCredit)}
              onClick={() => navigate("/entitlements")}
            >
              이용권 구매하기
            </ActionButton>
          </div>
        </section>
      </main>
    </div>
  );
}
