export type EntitlementSummary = {
  premiumEnabled: boolean;
  freeRemaining: number;
  premiumRemaining: number;
  remaining: number;
  groblePaymentUrl: string | null;
};

export type PurchaseIntent = {
  purchaseIntentId: string;
  checkoutUrl: string;
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

  return {
    premiumEnabled: payload.premiumEnabled,
    freeRemaining: readNonNegativeInteger(
      payload.freeRemaining,
      "freeRemaining"
    ),
    premiumRemaining: readNonNegativeInteger(
      payload.premiumRemaining,
      "premiumRemaining"
    ),
    remaining: readNonNegativeInteger(payload.remaining, "remaining"),
    groblePaymentUrl: payload.groblePaymentUrl,
  };
}

function parsePurchaseIntent(payload: unknown): PurchaseIntent {
  if (
    !isRecord(payload) ||
    typeof payload.purchaseIntentId !== "string" ||
    !payload.purchaseIntentId ||
    typeof payload.checkoutUrl !== "string" ||
    !payload.checkoutUrl
  ) {
    throw new EntitlementApiError("Invalid purchase response");
  }

  try {
    const checkoutUrl = new URL(payload.checkoutUrl);
    if (checkoutUrl.protocol !== "https:") {
      throw new Error("Unsupported checkout protocol");
    }
  } catch {
    throw new EntitlementApiError("Invalid checkoutUrl response");
  }

  return {
    purchaseIntentId: payload.purchaseIntentId,
    checkoutUrl: payload.checkoutUrl,
  };
}

function getAuthorizationHeaders(accessToken: string): HeadersInit {
  if (!accessToken.trim()) {
    throw new EntitlementApiError("Authentication required");
  }

  return { Authorization: `Bearer ${accessToken}` };
}

export function canPurchaseEntitlement(summary: EntitlementSummary): boolean {
  return summary.premiumEnabled && Boolean(summary.groblePaymentUrl?.trim());
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

export async function createPurchaseIntent(
  accessToken: string,
  fetcher: typeof fetch = fetch
): Promise<PurchaseIntent> {
  const response = await fetcher("/api/entitlements/purchase-intents", {
    method: "POST",
    headers: getAuthorizationHeaders(accessToken),
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new EntitlementApiError(
      readError(payload, "Unable to start checkout")
    );
  }

  return parsePurchaseIntent(payload);
}
