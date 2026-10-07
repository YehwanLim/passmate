import type { PurchaseProductKey } from "@/lib/entitlements";
import type { TIERS } from "@/lib/pricing";

// 이용권 페이지의 카피·색 상수. 가격 숫자는 lib/pricing.ts 단일 정의처에 있다.

export type TierKey = (typeof TIERS)[number]["key"];
export type BasicChoice = "single" | "company";

// 환불을 포함한 결제 문의는 메일로 받는다 — Groble이 부분 환불을 지원하지 않아 수동 처리가 전제다.
export const PAYMENT_INQUIRY_MAILTO = `mailto:hansitoring@gmail.com?subject=${encodeURIComponent(
  "[Pre:View] 결제 문의"
)}&body=${encodeURIComponent(
  "아래 내용을 채워 보내주시면 영업일 기준 3일 이내에 안내드릴게요.\n\n- 결제일:\n- 결제 확인 정보(주문번호 또는 결제 이메일):\n- 문의 내용(환불 요청 시 사유 포함):\n"
)}`;

// 카드 문구: "언제 쓰는 이용권인지"(굵게) + 무엇을 받는지 한 줄. 세 카드가 같은 꼴로 읽히지 않게 상황으로 가른다.
export const TIER_COPY: Record<TierKey, { when: string; what: Partial<Record<PurchaseProductKey, string>> }> = {
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

/** 티어별 강조 글자색 — 밝은 디자인은 강조색이 파랑 하나라 모든 티어가 같다. */
export const PLAN_ACCENT_TEXT: Record<PurchaseProductKey, string> = {
  single: "text-brand-ink",
  company: "text-brand-ink",
  standard: "text-brand-ink",
  premium: "text-brand-ink",
  triple: "text-brand-ink",
};

/**
 * 티어별 구매 버튼 — 추천 티어(스탠다드)만 주 버튼(파랑), 나머지는 옅은 파랑 보조 버튼.
 * 상품 키 기준이라 베이직은 자소서·기업 어느 쪽을 골라도 같은 모양이다.
 */
const PLAN_BUTTON_BASIC = "bg-brand-soft text-brand-ink hover:bg-[#dceaff]";
export const PLAN_BUTTON_CLASS: Record<PurchaseProductKey, string> = {
  single: PLAN_BUTTON_BASIC,
  company: PLAN_BUTTON_BASIC,
  standard: "bg-brand text-white hover:bg-brand-hover",
  premium: PLAN_BUTTON_BASIC,
  triple: PLAN_BUTTON_BASIC,
};

/** 추천 카드 — 랜딩의 "커피 한 잔" 기준과 같은 스탠다드. */
export const RECOMMENDED_TIER: TierKey = "standard";
