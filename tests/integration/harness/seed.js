import { randomUUID } from "node:crypto";

/**
 * EntitlementSetting 은 groblePaymentUrl 이 필수라 기본값을 넣어 준다.
 * 결제는 이 러너의 범위 밖이므로 도달하지 않는 더미 주소를 쓴다.
 */
export async function seedEntitlementSettings(
  db,
  { premiumEnabled = false, analysisEnabled = true } = {},
) {
  await db.entitlementSetting.upsert({
    where: { id: "singleton" },
    update: { premiumEnabled, analysisEnabled },
    create: {
      id: "singleton",
      premiumEnabled,
      analysisEnabled,
      groblePaymentUrl: "https://payments.invalid/checkout",
      grobleSinglePaymentUrl: "https://payments.invalid/checkout-single",
    },
  });
}

export async function seedUser(db, { premiumCredits = 0, email } = {}) {
  const id = randomUUID();
  await db.user.create({
    data: { id, email: email ?? `integration-${id}@example.invalid` },
  });
  await db.analysisEntitlement.create({
    data: { userId: id, premiumCreditsGranted: premiumCredits },
  });
  return id;
}

/**
 * ai_model_settings 행이 없으면 readAiModelSettings 가 fallbackModel: null 인
 * 기본값을 돌려주고, 그러면 모델 후보가 하나뿐이라 폴백 재시도가 일어나지 않는다.
 * 429 뒤 재시도를 검증하는 테스트는 withFallback: true 로 심어야 한다.
 */
export async function seedAiModelSettings(db, { withFallback = false } = {}) {
  await db.aiModelSetting.upsert({
    where: { id: "singleton" },
    update: {
      defaultProviderKey: "gemini",
      defaultModelName: "gemini-2.5-flash-lite",
      fallbackProviderKey: withFallback ? "openai" : null,
      fallbackModelName: withFallback ? "gpt-4o-mini" : null,
    },
    create: {
      id: "singleton",
      defaultProviderKey: "gemini",
      defaultModelName: "gemini-2.5-flash-lite",
      fallbackProviderKey: withFallback ? "openai" : null,
      fallbackModelName: withFallback ? "gpt-4o-mini" : null,
    },
  });
}

/**
 * 크레딧 락 직렬화를 관찰하려면 레이트리밋과 동시성 제한이 먼저 걸리면 안 된다.
 * 제한 자체를 검증하는 테스트에서는 이것을 쓰지 말고 실제 정책을 쓴다.
 */
export function unlimitedThroughputPolicy() {
  return {
    concurrencyLimit: 100_000,
    rateLimit: { route: "analysis", limit: 100_000, windowMs: 15 * 60 * 1000 },
  };
}
