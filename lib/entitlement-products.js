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

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Groble contentId 를 상품 키로 바꾼다. 웹훅(지급 판단)과 관리자 화면(과거 기록 표시)이
 * 같은 규칙을 써야 하므로 여기 한 곳에 둔다. 등록되지 않은 contentId 는 null.
 */
export function resolveProductForContentId(contentId, { premiumContentId, singleContentId } = {}) {
  if (isNonEmptyString(premiumContentId) && contentId === premiumContentId) {
    return "TRIPLE";
  }

  if (isNonEmptyString(singleContentId) && contentId === singleContentId) {
    return "SINGLE";
  }

  return null;
}

/**
 * 저장된 결제 기록(payment_entitlements.raw_event)에서 상품을 읽는다.
 * 상품 구분이 생기기 전 기록에는 product 가 없어 contentId 로 되짚는다.
 * 어느 쪽으로도 알 수 없으면 지어내지 않고 null.
 */
export function resolveProductForPaymentRecord(rawEvent, contentIds) {
  if (rawEvent === null || typeof rawEvent !== "object") {
    return null;
  }

  if (Object.hasOwn(PURCHASE_PRODUCTS, rawEvent.product)) {
    return rawEvent.product;
  }

  return resolveProductForContentId(rawEvent.contentId, contentIds);
}
