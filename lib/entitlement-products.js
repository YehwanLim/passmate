// 유료 분석 이용권 상품 정의의 단일 정의처.
// 크레딧 수는 상품 정의의 일부라 배포 코드와 함께 바뀌어야 하므로 DB가 아닌 상수로 둔다.
// (금액은 Groble 상품 설정이 진실이고, 서버는 금액을 검증하지 않는다.)
export const PURCHASE_PRODUCTS = {
  SINGLE: { credits: 1 },
  TRIPLE: { credits: 3 },
};

/**
 * 구매 의도 생성 쿼리스트링(?product=single|triple)을 상품 키로 변환한다.
 * 파라미터가 없으면 기존 클라이언트와의 하위호환을 위해 TRIPLE, 무효 값이면 null.
 */
export function parsePurchaseProductQuery(value) {
  if (value === undefined) {
    return "TRIPLE";
  }

  if (value === "single") {
    return "SINGLE";
  }

  if (value === "triple") {
    return "TRIPLE";
  }

  return null;
}
