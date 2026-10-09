import type { ReactNode } from "react";

import type { PurchaseProductKey } from "@/lib/entitlements";
import { PRICING, TIERS, formatKrw } from "@/lib/pricing";
import {
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
      className={`flex h-full flex-col rounded-[28px] border-2 bg-surface p-7 md:p-8 ${
        recommended ? "border-brand" : "border-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[17px] font-bold tracking-[-0.02em] text-ink">
          {tier.label}
        </p>
        {recommended && (
          <span className="inline-flex h-7 items-center rounded-[8px] bg-brand-soft px-2.5 text-[13px] font-semibold text-brand-ink">
            추천
          </span>
        )}
      </div>

      {/* 베이직만 토글이 들어가 아래 가격 줄이 밀리므로 구성 안내 영역 높이를 카드마다 맞춘다. */}
      <div className="mt-2.5 min-h-[62px]">
        {tier.key === "basic" ? (
          <div>
          <p className="text-[12px] font-medium text-ink-4">
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
                className={`h-10 whitespace-nowrap rounded-[10px] border text-[13px] font-semibold transition-colors ${
                  basicChoice === choice
                    ? "border-brand bg-brand-soft text-brand-ink"
                    : "border-line bg-surface text-ink-3 hover:bg-fill-soft hover:text-ink-2"
                }`}
              >
                {PRICING[choice].label}
              </button>
            ))}
          </div>
          </div>
        ) : (
          <p className="text-[14px] text-ink-3">{usesLabel}</p>
        )}
      </div>

      <p className="mt-5 whitespace-nowrap text-[36px] font-extrabold leading-none tracking-[-0.03em] text-ink">
        {formatKrw(plan.salePrice)}
        <span className="ml-1.5 text-[14px] font-medium tracking-normal text-ink-4">
          / {totalUses}회
        </span>
      </p>

      {hasStrike ? (
        <p className="mt-2 whitespace-nowrap text-[13px] text-ink-4 line-through">
          {tier.key === "basic" ? "정가" : "따로 사면"} {formatKrw(plan.listPrice)}
        </p>
      ) : (
        <p className="mt-2 text-[13px] text-ink-4">정가 판매</p>
      )}

      <p className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap text-[13px] text-ink-4">
        {totalUses > 0 && (
          <span>
            1회당{" "}
            <span className="font-semibold text-ink-2">
              {formatKrw(Math.round(plan.salePrice / totalUses))}
            </span>
          </span>
        )}
      </p>

      <div className="mt-5 flex-1">
        <p className="text-[15px] font-semibold text-ink">{TIER_COPY[tier.key].when}</p>
        <p className="mt-1.5 text-[14px] leading-[1.7] text-ink-3">{TIER_COPY[tier.key].what[product]}</p>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
