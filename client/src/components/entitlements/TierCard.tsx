import type { ReactNode } from "react";

import type { PurchaseProductKey } from "@/lib/entitlements";
import { PRICING, TIERS, formatKrw } from "@/lib/pricing";
import {
  PLAN_ACCENT_TEXT,
  RECOMMENDED_TIER,
  TIER_COPY,
  type BasicChoice,
} from "@/pages/entitlementsCopy";

type Tier = (typeof TIERS)[number];

/** 이용권 카드 한 장. 베이직은 자소서/기업 중 하나를 고르는 토글이 들어간다. 버튼은 children 슬롯. */
export function TierCard({
  tier,
  basicChoice,
  onBasicChoice,
  children,
}: {
  tier: Tier;
  basicChoice: BasicChoice;
  onBasicChoice: (choice: BasicChoice) => void;
  children: ReactNode;
}) {
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
                onClick={() => onBasicChoice(choice)}
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

      <div className="mt-6">{children}</div>
    </div>
  );
}
