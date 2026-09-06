// 이용권 가격 표시의 단일 정의처. 랜딩(PricingSection)과 이용권 페이지(Entitlements)가 공유한다.
// 실제 결제 금액은 Groble 상품 설정이 진실이므로, 여기 값을 바꿀 땐 Groble 상품 가격도 함께 맞춘다.
// 티어(스펙 §7-3): 베이직 5,900(자소서 1 또는 기업 1) → 스탠다드 14,900(자소서 2 + 기업 1) → 프리미엄 25,900(자소서 3 + 기업 3).

/** 서버 쿼리 키(lib/entitlement-products.js PRODUCT_QUERY_KEYS)와 같다. checkoutUrls 의 키이기도 하다. */
export const PURCHASE_PRODUCT_KEYS = ["single", "company", "standard", "premium", "triple"] as const;
export type PurchaseProductKey = (typeof PURCHASE_PRODUCT_KEYS)[number];

export type PricingPlan = {
  /** 카드·버튼 라벨 */
  label: string;
  /** 정가 또는 "따로 살 때"(번들) 가격(원) — 취소선으로 표기. 판매가와 같으면 취소선 없음 */
  listPrice: number;
  /** 판매가(원) */
  salePrice: number;
  /** 할인·절약 배지 문구. 빈 문자열이면 배지 없음 */
  discountLabel: string;
  /** 자소서 분석 횟수 */
  uses: number;
  /** 기업 분석 횟수 */
  companyUses: number;
};

export const PRICING: Record<PurchaseProductKey, PricingPlan> = {
  single: {
    label: "자소서 진단 1회",
    listPrice: 9_900,
    salePrice: 5_900,
    discountLabel: "40% 할인",
    uses: 1,
    companyUses: 0,
  },
  company: {
    label: "기업 분석 1회",
    listPrice: 5_900,
    salePrice: 5_900,
    discountLabel: "",
    uses: 0,
    companyUses: 1,
  },
  standard: {
    label: "스탠다드",
    listPrice: 17_700,
    salePrice: 14_900,
    discountLabel: "2,800원 절약",
    uses: 2,
    companyUses: 1,
  },
  premium: {
    label: "프리미엄",
    listPrice: 35_400,
    salePrice: 25_900,
    discountLabel: "9,500원 절약",
    uses: 3,
    companyUses: 3,
  },
  // 판매 종료. 과거 결제 기록의 라벨·추정 금액에만 쓴다.
  triple: {
    label: "3회권(구)",
    listPrice: 29_700,
    salePrice: 14_900,
    discountLabel: "약 50% 할인",
    uses: 3,
    companyUses: 0,
  },
};

/** 티어 카드 순서. 베이직은 상품 둘 중 하나를 고른다. */
export const TIERS = [
  { key: "basic", label: "베이직", products: ["single", "company"] },
  { key: "standard", label: "스탠다드", products: ["standard"] },
  { key: "premium", label: "프리미엄", products: ["premium"] },
] as const;

/** 스탠다드 기준 회당 가격(원, 14,900 / 3회). 반올림 값이며 pricing.test.ts가 산술 일치를 검증한다. */
export const TRIPLE_PER_USE_PRICE = 4_967;

export const SEASONAL_DISCOUNT_LABEL = "하반기 채용 시즌 기념 할인";

/**
 * 어떤 이용권이든 자소서 리포트에 공통으로 담기는 구성.
 * 실제 리포트 섹션(shared/prompts/reportPrompt.js·ReportShowcase)과 일치해야 한다 — 과장 금지.
 */
export const REPORT_INCLUDED_FEATURES = [
  "지원 기업의 채용 기준 분석",
  "채용 담당자 시선의 첫인상 진단",
  "강점과 보완점 핵심 진단",
  "원문 문장별 첨삭 피드백",
  "면접 예상 질문과 모범 답변 가이드",
  "합격 확률을 높이는 액션 플랜",
];

/** 기업 분석 리포트 구성(companyReportNavigation.ts 의 9섹션과 일치해야 한다 — 과장 금지). */
export const COMPANY_REPORT_INCLUDED_FEATURES = [
  "무엇을 팔아 돈을 버는지와 요즘 힘을 싣는 사업",
  "매출·이익·주가 흐름과 최근 1년 주요 이슈",
  "지원 직무가 하는 일과 직무 관련 최신 소식",
  "자소서에 쓸 사업 소재와 면접 예상 질문",
  "출처 링크가 붙은 부록",
];

export function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function savingsFor(plan: PricingPlan): number {
  return plan.listPrice - plan.salePrice;
}

/** 서버가 쓰는 상품 키(lib/entitlement-products.js). 상품을 알 수 없는 결제는 null. */
export type PurchaseProduct = "SINGLE" | "COMPANY_SINGLE" | "STANDARD" | "PREMIUM" | "TRIPLE";

export const PRODUCT_KEY_BY_PRODUCT: Record<PurchaseProduct, PurchaseProductKey> = {
  SINGLE: "single",
  COMPANY_SINGLE: "company",
  STANDARD: "standard",
  PREMIUM: "premium",
  TRIPLE: "triple",
};

export function productLabel(product: PurchaseProduct | null): string {
  const key = product ? PRODUCT_KEY_BY_PRODUCT[product] : undefined;
  return key ? PRICING[key].label : "–";
}

/**
 * 결제 금액은 저장되지 않으므로(금액의 진실은 Groble) 현재 판매가로 되짚는다.
 * 가격을 바꾸면 과거 결제도 새 가격으로 보이니, 화면에는 반드시 '추정'으로 표기한다.
 */
export function estimatedAmountFor(product: PurchaseProduct | null): number | null {
  const key = product ? PRODUCT_KEY_BY_PRODUCT[product] : undefined;
  return key ? PRICING[key].salePrice : null;
}
