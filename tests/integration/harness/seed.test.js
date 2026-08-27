import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getEntitlementSummary } from "../../../lib/analysis-entitlements.js";
import { getModelCallSequence, readAiModelSettings } from "../../../lib/ai-model-settings.js";
import {
  createTestPrismaClient,
  prepareTestDatabase,
  resetTables,
} from "./test-database.js";
import {
  seedAiModelSettings,
  seedEntitlementSettings,
  seedUser,
  unlimitedThroughputPolicy,
} from "./seed.js";

describe("시드 헬퍼", () => {
  let db;

  beforeAll(async () => {
    await prepareTestDatabase();
    db = createTestPrismaClient();
  }, 120_000);

  beforeEach(async () => {
    await resetTables(db);
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("무료 크레딧 1개를 가진 사용자를 만든다", async () => {
    await seedEntitlementSettings(db);
    const userId = await seedUser(db);

    const summary = await db.$transaction((tx) => getEntitlementSummary(tx, userId));

    expect(summary).toMatchObject({ freeRemaining: 1, premiumRemaining: 0, remaining: 1 });
  });

  it("프리미엄이 켜져 있으면 지급한 만큼 프리미엄 크레딧을 갖는다", async () => {
    await seedEntitlementSettings(db, { premiumEnabled: true });
    const userId = await seedUser(db, { premiumCredits: 5 });

    const summary = await db.$transaction((tx) => getEntitlementSummary(tx, userId));

    expect(summary).toMatchObject({
      premiumEnabled: true,
      freeRemaining: 1,
      premiumRemaining: 5,
      remaining: 6,
    });
  });

  it("사용자마다 다른 식별자와 이메일을 만든다", async () => {
    await seedEntitlementSettings(db);
    const first = await seedUser(db);
    const second = await seedUser(db);

    expect(first).not.toBe(second);
    expect(await db.user.count()).toBe(2);
  });

  it("무제한 처리량 정책은 레이트리밋과 동시성 제한을 사실상 없앤다", () => {
    const policy = unlimitedThroughputPolicy();

    expect(policy.concurrencyLimit).toBeGreaterThanOrEqual(1000);
    expect(policy.rateLimit.limit).toBeGreaterThanOrEqual(1000);
    expect(policy.rateLimit.route).toBe("analysis");
  });

  it("폴백을 심지 않으면 모델 후보가 하나뿐이라 재시도가 일어나지 않는다", async () => {
    const sequence = getModelCallSequence(await readAiModelSettings(db));

    expect(sequence).toHaveLength(1);
  });

  it("폴백을 심으면 모델 후보가 둘이 되어 재시도가 가능해진다", async () => {
    await seedAiModelSettings(db, { withFallback: true });

    const sequence = getModelCallSequence(await readAiModelSettings(db));

    expect(sequence).toHaveLength(2);
    expect(sequence[0].providerKey).toBe("gemini");
    expect(sequence[1].providerKey).toBe("openai");
  });
});
