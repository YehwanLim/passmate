import { PURCHASE_PRODUCT_KEYS, type PurchaseProductKey } from "./pricing";

export type { PurchaseProductKey };

export type EntitlementSummary = {
  premiumEnabled: boolean;
  freeRemaining: number;
  /** 피드백 참여·관리자 지급으로 받은 자소서 크레딧. remaining 합계에 포함된다. */
  bonusRemaining: number;
  premiumRemaining: number;
  remaining: number;
  groblePaymentUrl: string | null;
  grobleSinglePaymentUrl: string | null;
  /** 상품 키별 결제 URL. 판매 스위치·상품 활성·URL 이 모두 갖춰진 상품만 문자열, 나머지 null. */
  checkoutUrls: Record<PurchaseProductKey, string | null>;
  feedbackRewardClaimed: boolean;
  /** 기업 분석 리포트 판매·생성 스위치. 구버전 서버 응답에 없으면 false. */
  companyAnalysisEnabled: boolean;
  /** 기업 분석 리포트 잔여 크레딧(자소서 remaining 과 별도 풀). 구버전 응답에 없으면 0. */
  companyRemaining: number;
};

export class EntitlementApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntitlementApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new EntitlementApiError(`Invalid ${field} response`);
  }

  return value;
}

function readCheckoutUrl(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new EntitlementApiError(`Invalid ${field} response`);
  }
  return value;
}

/** 구버전 서버 응답(checkoutUrls 없음)은 두 URL 필드로 1회권·스탠다드만 채우고 나머지는 닫힌 것으로 본다. */
function readCheckoutUrls(payload: Record<string, unknown>): Record<PurchaseProductKey, string | null> {
  const source = isRecord(payload.checkoutUrls) ? payload.checkoutUrls : null;
  const urls = {} as Record<PurchaseProductKey, string | null>;
  for (const key of PURCHASE_PRODUCT_KEYS) {
    urls[key] = source ? readCheckoutUrl(source[key], `checkoutUrls.${key}`) : null;
  }
  if (!source) {
    urls.single = readCheckoutUrl(payload.grobleSinglePaymentUrl, "grobleSinglePaymentUrl");
    urls.standard = readCheckoutUrl(payload.groblePaymentUrl, "groblePaymentUrl");
  }
  return urls;
}

function readError(payload: unknown, fallback: string): string {
  return isRecord(payload) && typeof payload.error === "string" && payload.error
    ? payload.error
    : fallback;
}

async function readPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new EntitlementApiError("Invalid server response");
  }
}

function parseEntitlementSummary(payload: unknown): EntitlementSummary {
  if (!isRecord(payload)) {
    throw new EntitlementApiError("Invalid entitlement response");
  }

  if (typeof payload.premiumEnabled !== "boolean") {
    throw new EntitlementApiError("Invalid premiumEnabled response");
  }

  if (
    payload.groblePaymentUrl !== null &&
    typeof payload.groblePaymentUrl !== "string"
  ) {
    throw new EntitlementApiError("Invalid groblePaymentUrl response");
  }

  if (
    payload.grobleSinglePaymentUrl !== null &&
    payload.grobleSinglePaymentUrl !== undefined &&
    typeof payload.grobleSinglePaymentUrl !== "string"
  ) {
    throw new EntitlementApiError("Invalid grobleSinglePaymentUrl response");
  }

  return {
    premiumEnabled: payload.premiumEnabled,
    freeRemaining: readNonNegativeInteger(
      payload.freeRemaining,
      "freeRemaining"
    ),
    // 구버전 서버 응답에는 없다. 있으면 다른 잔여 수와 같은 엄격함으로 읽는다.
    bonusRemaining:
      payload.bonusRemaining === undefined
        ? 0
        : readNonNegativeInteger(payload.bonusRemaining, "bonusRemaining"),
    premiumRemaining: readNonNegativeInteger(
      payload.premiumRemaining,
      "premiumRemaining"
    ),
    remaining: readNonNegativeInteger(payload.remaining, "remaining"),
    groblePaymentUrl: payload.groblePaymentUrl,
    // 구버전 서버 응답에도 화면이 깨지지 않도록 없으면 "미설정"으로 본다.
    grobleSinglePaymentUrl: payload.grobleSinglePaymentUrl ?? null,
    checkoutUrls: readCheckoutUrls(payload),
    // 구버전 서버 응답에도 화면이 깨지지 않도록 없으면 "아직 안 받음"으로 본다.
    feedbackRewardClaimed: payload.feedbackRewardClaimed === true,
    companyAnalysisEnabled: payload.companyAnalysisEnabled === true,
    // 구버전 서버 응답에는 없다. 있으면 다른 잔여 수와 같은 엄격함으로 읽는다.
    companyRemaining:
      payload.companyRemaining === undefined
        ? 0
        : readNonNegativeInteger(payload.companyRemaining, "companyRemaining"),
  };
}

function getAuthorizationHeaders(accessToken: string): HeadersInit {
  if (!accessToken.trim()) {
    throw new EntitlementApiError("Authentication required");
  }

  return { Authorization: `Bearer ${accessToken}` };
}

export async function fetchEntitlementSummary(
  accessToken: string,
  fetcher: typeof fetch = fetch
): Promise<EntitlementSummary> {
  const response = await fetcher("/api/entitlements", {
    headers: getAuthorizationHeaders(accessToken),
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new EntitlementApiError(
      readError(payload, "Unable to load entitlements")
    );
  }

  return parseEntitlementSummary(payload);
}

export type PurchaseIntent = {
  purchaseIntentId: string;
  checkoutUrl: string;
};

function parsePurchaseIntent(payload: unknown): PurchaseIntent {
  if (
    !isRecord(payload) ||
    typeof payload.purchaseIntentId !== "string" ||
    typeof payload.checkoutUrl !== "string"
  ) {
    throw new EntitlementApiError("Invalid purchase intent response");
  }

  return {
    purchaseIntentId: payload.purchaseIntentId,
    checkoutUrl: payload.checkoutUrl,
  };
}

export async function createPurchaseIntent(
  accessToken: string,
  product: PurchaseProductKey,
  fetcher: typeof fetch = fetch
): Promise<PurchaseIntent> {
  const response = await fetcher(
    `/api/entitlements/purchase-intents?product=${product}`,
    {
      method: "POST",
      headers: getAuthorizationHeaders(accessToken),
    }
  );
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new EntitlementApiError(
      readError(payload, "Unable to start a purchase")
    );
  }

  return parsePurchaseIntent(payload);
}

/** 비로그인 화면용 판매 가용성. 서버 `GET /api/entitlements?availability=1`. */
export type SalesAvailability = {
  companyAnalysisEnabled: boolean;
  purchasable: Record<PurchaseProductKey, boolean>;
};

export async function fetchSalesAvailability(): Promise<SalesAvailability> {
  const response = await fetch("/api/entitlements?availability=1");
  if (!response.ok) {
    throw new Error(`Sales availability request failed (${response.status})`);
  }
  const payload: unknown = await response.json();
  const source = isRecord(payload) && isRecord(payload.purchasable) ? payload.purchasable : null;
  const purchasable = {} as Record<PurchaseProductKey, boolean>;
  for (const key of PURCHASE_PRODUCT_KEYS) {
    purchasable[key] = source?.[key] === true;
  }
  return {
    companyAnalysisEnabled: isRecord(payload) && payload.companyAnalysisEnabled === true,
    purchasable,
  };
}
