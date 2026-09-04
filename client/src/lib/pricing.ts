// 이용권 가격 표시의 단일 정의처. 랜딩(PricingSection)과 이용권 페이지(Entitlements)가 공유한다.
// 실제 결제 금액은 Groble 상품 설정이 진실이므로, 여기 값을 바꿀 땐 Groble 상품 가격도 함께 맞춘다.

export type PricingPlan = {
  /** 카드 상단 라벨 */
  label: string;
  /** 정가(원) — 취소선으로 표기 */
  listPrice: number;
  /** 할인가(원) */
  salePrice: number;
  /** 할인율 배지 문구 */
  discountLabel: string;
  /** 제공 분석 횟수 */
  uses: number;
};

export const PRICING = {
  single: {
    label: "1회권",
    listPrice: 9_900,
    salePrice: 5_900,
    discountLabel: "40% 할인",
    uses: 1,
  },
  triple: {
    label: "3회권",
    listPrice: 29_700,
    salePrice: 14_900,
    discountLabel: "약 50% 할인",
    uses: 3,
  },
} satisfies Record<string, PricingPlan>;

/** 3회권 기준 회당 가격(원). 반올림 값이며 pricing.test.ts가 산술 일치를 검증한다. */
export const TRIPLE_PER_USE_PRICE = 4_967;

export const SEASONAL_DISCOUNT_LABEL = "하반기 채용 시즌 기념 할인";

/**
 * 어떤 이용권이든 리포트에 공통으로 담기는 구성.
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

export function formatKrw(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}
