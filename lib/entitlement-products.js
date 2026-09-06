// 유료 이용권 상품 정의의 단일 정의처.
// 크레딧 수는 상품 정의의 일부라 배포 코드와 함께 바뀌어야 하므로 DB가 아닌 상수로 둔다.
// (금액은 Groble 상품 설정이 진실이고, 서버는 금액을 검증하지 않는다.)
// 상품별 Groble 연결(contentId·결제 URL·판매 여부)은 purchase_product_settings 테이블에서 읽는다.
// 티어: 베이직 = SINGLE(자소서 1) 또는 COMPANY_SINGLE(기업 1) / 스탠다드 = 자소서 2 + 기업 1 / 프리미엄 = 자소서 3 + 기업 3.
// TRIPLE(구 3회권)은 판매 종료 — 과거 기록 라벨과 전환기 지급을 위해 남긴다.
export const PURCHASE_PRODUCTS = Object.freeze({
  SINGLE: { resumeCredits: 1, companyCredits: 0 },
  COMPANY_SINGLE: { resumeCredits: 0, companyCredits: 1 },
  STANDARD: { resumeCredits: 2, companyCredits: 1 },
  PREMIUM: { resumeCredits: 3, companyCredits: 3 },
  TRIPLE: { resumeCredits: 3, companyCredits: 0 },
});

export const PURCHASE_PRODUCT_KEYS = Object.freeze(Object.keys(PURCHASE_PRODUCTS));

/** 구매 의도 쿼리스트링(?product=)과 GET /api/entitlements 의 checkoutUrls 키. 클라이언트 pricing.ts 와 같아야 한다. */
export const PRODUCT_QUERY_KEYS = Object.freeze({
  SINGLE: "single",
  COMPANY_SINGLE: "company",
  STANDARD: "standard",
  PREMIUM: "premium",
  TRIPLE: "triple",
});

const PRODUCT_BY_QUERY_KEY = Object.freeze(
  Object.fromEntries(Object.entries(PRODUCT_QUERY_KEYS).map(([product, key]) => [key, product])),
);

/**
 * 구매 의도 생성 쿼리스트링을 상품 키로 변환한다.
 * 파라미터가 없으면 구 클라이언트가 3회권 결제로 쓰던 경로를 승계한 STANDARD, 무효 값이면 null.
 */
export function parsePurchaseProductQuery(value) {
  if (value === undefined) {
    return "STANDARD";
  }

  return typeof value === "string" && Object.hasOwn(PRODUCT_BY_QUERY_KEY, value)
    ? PRODUCT_BY_QUERY_KEY[value]
    : null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Groble contentId 를 상품 키로 바꾼다. 웹훅(지급 판단)과 관리자 화면(과거 기록 표시)이
 * 같은 규칙을 써야 하므로 여기 한 곳에 둔다. 등록되지 않은 contentId 는 null.
 */
export function resolveProductForContentId(contentId, contentIdByProduct = {}) {
  if (!isNonEmptyString(contentId)) {
    return null;
  }

  for (const product of PURCHASE_PRODUCT_KEYS) {
    const candidate = contentIdByProduct[product];
    if (isNonEmptyString(candidate) && candidate === contentId) {
      return product;
    }
  }

  return null;
}

/**
 * 저장된 결제 기록(payment_entitlements.raw_event)에서 상품을 읽는다.
 * 상품 구분이 생기기 전 기록에는 product 가 없어 contentId 로 되짚는다.
 * 어느 쪽으로도 알 수 없으면 지어내지 않고 null.
 */
export function resolveProductForPaymentRecord(rawEvent, contentIdByProduct) {
  if (rawEvent === null || typeof rawEvent !== "object") {
    return null;
  }

  if (Object.hasOwn(PURCHASE_PRODUCTS, rawEvent.product)) {
    return rawEvent.product;
  }

  return resolveProductForContentId(rawEvent.contentId, contentIdByProduct);
}

/**
 * 카탈로그 도입 전에는 env 로 contentId 를 관리했다(GROBLE_PREMIUM_CONTENT_ID = 구 3회권).
 * 행에 값이 없고, 그 값을 쓰는 다른 행도 없을 때만 fallback 으로 쓴다 — 관리자가 STANDARD 행에
 * 구 3회권 contentId 를 넣는 순간(컷오버) TRIPLE 대응이 사라져 2+1 지급으로 바뀐다.
 */
const LEGACY_CONTENT_ID_ENV = Object.freeze({
  SINGLE: "GROBLE_SINGLE_CONTENT_ID",
  TRIPLE: "GROBLE_PREMIUM_CONTENT_ID",
});

/**
 * 상품별 설정을 5상품 모두 채운 객체로 돌려준다. 행이 없는 상품은 팔지 않는 것으로 본다
 * (마이그레이션이 5행을 넣지만, 적용 전 배포·삭제된 행에도 화면이 깨지지 않게).
 */
export async function readPurchaseProductSettings(db, env = process.env) {
  const rows = await db.purchaseProductSetting.findMany();
  const rowByProduct = new Map(rows.map((row) => [row.product, row]));
  const usedContentIds = new Set(
    rows.map((row) => row.grobleContentId).filter((value) => isNonEmptyString(value)),
  );

  const settings = {};
  for (const product of PURCHASE_PRODUCT_KEYS) {
    const row = rowByProduct.get(product);
    const envName = LEGACY_CONTENT_ID_ENV[product];
    const legacyContentId = envName ? env?.[envName] : undefined;
    const fallback =
      isNonEmptyString(legacyContentId) && !usedContentIds.has(legacyContentId) ? legacyContentId : null;

    settings[product] = {
      contentId: isNonEmptyString(row?.grobleContentId) ? row.grobleContentId : fallback,
      paymentUrl: isNonEmptyString(row?.paymentUrl) ? row.paymentUrl : "",
      active: row?.active === true,
    };
  }
  return settings;
}

/** readPurchaseProductSettings 결과에서 contentId 가 있는 상품만 { product: contentId } 로 뽑는다. */
export function contentIdsBySettings(settings) {
  const contentIds = {};
  for (const product of PURCHASE_PRODUCT_KEYS) {
    const contentId = settings?.[product]?.contentId;
    if (isNonEmptyString(contentId)) {
      contentIds[product] = contentId;
    }
  }
  return contentIds;
}
