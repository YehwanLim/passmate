import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Building2, FileText, PenLine, RefreshCw } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { getLoginRedirectPath, useRequireAuth } from "@/hooks/useRequireAuth";
import {
  fetchEntitlementSummary,
  type EntitlementSummary,
  type FreeTools,
  type FreeToolUsage,
} from "@/lib/entitlements";
import { supabase } from "@/lib/supabase";

// 주 버튼은 파랑(bg-brand), 보조 버튼은 높이·모서리를 맞춘 흰 표면.
const PRIMARY_ACTION_CLASS =
  "group inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-[12px] bg-brand px-5 text-[15px] font-bold text-white transition-colors hover:bg-brand-hover";
const SECONDARY_ACTION_CLASS =
  "inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-surface px-5 text-[15px] font-semibold text-ink-2 transition-colors hover:bg-fill";

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
          <span>{children}</span>
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
          className="rounded-[20px] bg-surface animate-pulse"
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
        isEmpty ? "text-ink-4" : "text-ink"
      }`}
    >
      <span className="text-[28px] font-extrabold tracking-[-0.03em] tabular-nums">
        {remaining}
      </span>
      <span
        className={`ml-0.5 text-sm font-medium ${isEmpty ? "text-ink-4" : "text-ink-3"}`}
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
  /** 없으면 큰 숫자를 쓰지 않는다 — 줄마다 횟수를 보여 주는 카드(자소서 분석). */
  remaining?: number;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[20px] bg-surface p-[22px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-fill text-ink-3">
            {icon}
          </span>
          <div>
            <p className="text-[16px] font-bold text-ink">{title}</p>
            <p className="mt-1 text-[13px] leading-[1.6] text-ink-4">{description}</p>
          </div>
        </div>
        {remaining === undefined ? null : <RemainingStat remaining={remaining} />}
      </div>

      {children ? (
        <div className="mt-4 divide-y divide-line-soft border-t border-line-soft sm:ml-12">
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
          className={`text-[15px] ${isEmpty ? "font-medium text-ink-4" : "font-semibold text-ink-2"}`}
        >
          {title}
        </p>
        <p className="mt-0.5 text-[13px] text-ink-4">{description}</p>
      </div>
      <p
        className={`shrink-0 text-right text-[22px] leading-none tracking-[-0.02em] tabular-nums ${
          isEmpty ? "font-semibold text-ink-4" : "font-extrabold text-ink"
        }`}
      >
        {remaining}
        <span className="ml-0.5 text-sm font-medium tracking-normal text-ink-4">회</span>
      </p>
    </div>
  );
}

function FreeToolRow({ title, description, usage }: { title: string; description: string; usage: FreeToolUsage }) {
  const isEmpty = usage.remaining === 0;

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className={`text-[15px] ${isEmpty ? "font-medium text-ink-4" : "font-semibold text-ink-2"}`}>{title}</p>
        <p className="mt-0.5 text-[13px] text-ink-4">{description}</p>
      </div>
      <p className={`shrink-0 text-right text-[22px] leading-none tracking-[-0.02em] tabular-nums ${isEmpty ? "font-semibold text-ink-4" : "font-extrabold text-ink"}`}>
        {usage.remaining}
        <span className="text-sm font-medium tracking-normal text-ink-4"> / {usage.limit}회</span>
      </p>
    </div>
  );
}

/**
 * 이용권 없이 하루 몇 번 쓰는 AI 도구. 이용권과 섞이지 않게 카드를 따로 두고, 위 두 카드처럼 큰 숫자 대신 "남은 / 하루" 로 쓴다.
 * 서버 창이 UTC 자정 정렬이라 다시 채워지는 시각은 늘 KST 오전 9시다.
 */
function FreeToolsCard({ tools }: { tools: FreeTools }) {
  return (
    <section className="rounded-[20px] bg-surface p-[22px]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-fill text-ink-3">
          <PenLine className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[16px] font-bold text-ink">매일 무료</p>
          <p className="mt-1 text-[13px] leading-[1.6] text-ink-4">무료 횟수는 매일 오전 9시에 다시 채워져요.</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-line-soft border-t border-line-soft sm:ml-12">
        <FreeToolRow
          title="자소서 초안 쓰기"
          description="문항에 맞는 내 경험을 골라 자소서 초안을 자동으로 써 줘요."
          usage={tools.experienceDraft}
        />
        <FreeToolRow
          title="경험 자동 추가"
          description="'경험 카드'에서 이력서·자소서를 올리면 경험을 뽑아 정리해 줘요. 정리된 경험은 지원서를 작성할 때 사용돼요."
          usage={tools.experienceExtract}
        />
      </div>
    </section>
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

  const needsPurchase = Boolean(summary && !hasEssayCredit && !hasCompanyCredit);

  return (
    <div className="min-h-screen bg-stage pb-28 text-ink">
      <SiteHeader variant="light" />

      {/* 한 줄짜리 내용이라 왼쪽에 붙이지 않고 가운데 열(최대 672px)에 모은다 */}
      <main className="container max-w-2xl pt-10 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          {/* 구매는 맨 아래에 두면 안 보여서(10-08) 제목 옆으로 올린다. 남은 게 없을 때만 파랑으로 강조한다. */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold tracking-[-0.03em] text-ink">
                내 이용권
              </h1>
              <p className="mt-1.5 text-[15px] text-ink-4">
                보유한 분석 이용권을 확인할 수 있어요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/entitlements")}
              className={`mt-1 inline-flex h-10 shrink-0 items-center rounded-[10px] px-4 text-[14px] font-bold transition-colors ${
                needsPurchase
                  ? "bg-brand text-white hover:bg-brand-hover"
                  : "border border-line bg-surface text-brand hover:bg-fill"
              }`}
            >
              이용권 구매하기
            </button>
          </div>
        </motion.div>

        <section className="mt-8 space-y-6" aria-live="polite">
          {authLoading || isLoading ? (
            <CreditSkeleton />
          ) : error ? (
            <div className="rounded-[20px] bg-surface px-6 py-6 text-center">
              <p className="text-sm text-danger">{error}</p>
              <button
                type="button"
                onClick={() => void loadEntitlements()}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-[10px] bg-fill px-4 text-sm font-semibold text-ink-2 transition-colors hover:bg-line"
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
                description="리포트가 만들어지면 1회 차감돼요. 분석에 실패하면 차감되지 않아요."
              >
                <CreditSummaryRow
                  title="무료 이용권"
                  description="가입하면 자소서 분석 1회를 무료로 드려요."
                  remaining={summary.freeRemaining}
                />
                {/* 보너스 이용권은 받은 사람에게만 보인다(0회면 숨김). */}
                {summary.bonusRemaining > 0 && (
                  <CreditSummaryRow
                    title="보너스 이용권"
                    description="피드백 설문에 참여하고 받은 이용권이에요."
                    remaining={summary.bonusRemaining}
                  />
                )}
                <CreditSummaryRow
                  title="프리미엄 이용권"
                  description="구매한 분석 이용권이에요. 다 쓰면 더 구매할 수 있어요."
                  remaining={summary.premiumRemaining}
                />
              </CreditGroupCard>

              <CreditGroupCard
                icon={<Building2 className="h-4 w-4" />}
                title="기업 분석"
                description="회사·직무를 넣으면 기업 분석 리포트를 만들어 드려요."
                remaining={summary.companyRemaining}
              />

              {summary.freeTools ? <FreeToolsCard tools={summary.freeTools} /> : null}
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

          </div>
        </section>

        {/* 회원 탈퇴 — 마이페이지에서 옮겨 왔다(10-08). 법상 탈퇴 길은 있어야 해서 지우지 않고, 자주 오지 않는 이 화면 맨 아래에 작게 둔다. */}
        <div className="mt-16 flex justify-end">
          <button
            id="my-account-deletion-link"
            type="button"
            onClick={() => navigate("/account/deletion")}
            className="text-[12px] text-ink-5 transition-colors hover:text-ink-3"
          >
            회원 탈퇴
          </button>
        </div>
      </main>
    </div>
  );
}
