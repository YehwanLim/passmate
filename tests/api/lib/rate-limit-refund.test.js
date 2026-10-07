import { describe, expect, it, vi } from "vitest";
import { USER_RATE_LIMITS, consumeUserRateLimit, refundUserRateLimit } from "../../../lib/rate-limit.js";

describe("experienceDraft 정책", () => {
  it("하루 2개, KST 09:00(UTC 자정)에 초기화된다", async () => {
    const policy = USER_RATE_LIMITS.experienceDraft;
    expect(policy).toEqual({ route: "experience-draft", limit: 2, windowMs: 24 * 60 * 60 * 1000 });
    const db = { apiRateLimitBucket: { upsert: vi.fn(async () => ({ requestCount: 1 })) } };
    const rate = await consumeUserRateLimit(db, { userId: "u1", policy, now: new Date("2026-10-05T23:59:00.000Z") });
    expect(rate.resetAt.toISOString()).toBe("2026-10-06T00:00:00.000Z");
    expect(rate.remaining).toBe(1);
  });
});

describe("refundUserRateLimit", () => {
  it("같은 창의 버킷에서 0 아래로는 내리지 않고 1을 뺀다", async () => {
    const db = { apiRateLimitBucket: { updateMany: vi.fn(async () => ({ count: 1 })) } };
    const now = new Date("2026-10-05T10:00:00.000Z");
    await refundUserRateLimit(db, { userId: "u1", policy: USER_RATE_LIMITS.experienceDraft, now });
    expect(db.apiRateLimitBucket.updateMany).toHaveBeenCalledWith({
      where: {
        subjectKey: "user:u1",
        route: "experience-draft",
        windowStart: new Date("2026-10-05T00:00:00.000Z"),
        requestCount: { gt: 0 },
      },
      data: { requestCount: { decrement: 1 } },
    });
  });
});

describe("experienceExtract 정책", () => {
  it("하루 3번, 초안과 다른 버킷이고 KST 09:00(UTC 자정)에 초기화된다", async () => {
    const policy = USER_RATE_LIMITS.experienceExtract;
    expect(policy).toEqual({ route: "experience-extract", limit: 3, windowMs: 24 * 60 * 60 * 1000 });
    expect(policy.route).not.toBe(USER_RATE_LIMITS.experienceDraft.route);
    const db = { apiRateLimitBucket: { upsert: vi.fn(async () => ({ requestCount: 1 })) } };
    const rate = await consumeUserRateLimit(db, { userId: "u1", policy, now: new Date("2026-10-08T23:59:00.000Z") });
    expect(rate.resetAt.toISOString()).toBe("2026-10-09T00:00:00.000Z");
    expect(rate.remaining).toBe(2);
  });
});
