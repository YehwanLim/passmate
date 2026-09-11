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

/** 티어별 강조 글자색 — 할인 문구가 그 카드의 버튼 색과 같은 계열로 읽히게 한다. */
export const PLAN_ACCENT_TEXT: Record<PurchaseProductKey, string> = {
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
export const PLAN_BUTTON_CLASS: Record<PurchaseProductKey, string> = {
  single: PLAN_BUTTON_BASIC,
  company: PLAN_BUTTON_BASIC,
  standard:
    "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20 hover:from-blue-400 hover:to-cyan-300",
  premium:
    "bg-gradient-to-r from-violet-300 to-purple-200 text-[#2E1065] shadow-lg shadow-violet-400/20 hover:from-violet-200 hover:to-purple-100",
  triple: PLAN_BUTTON_BASIC,
};

/** 추천 카드 — 랜딩의 "커피 한 잔" 기준과 같은 스탠다드. */
export const RECOMMENDED_TIER: TierKey = "standard";
