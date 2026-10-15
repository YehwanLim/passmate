import { describe, expect, it } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-23T10:07:30.000Z");

function createMemoryDatabase() {
  const state = new Map();

  return {
    db: {
      apiRateLimitBucket: {
        upsert: async ({ where, create, update }) => {
          const { subjectKey, route, windowStart } = where.subjectKey_route_windowStart;
          const key = `${subjectKey}:${route}:${windowStart.toISOString()}`;
          const previousCount = state.get(key);
          const requestCount = previousCount === undefined
            ? create.requestCount
            : previousCount + update.requestCount.increment;
          state.set(key, requestCount);
          return { requestCount };
        },
        findUnique: async ({ where }) => {
          const { subjectKey, route, windowStart } = where.subjectKey_route_windowStart;
          const requestCount = state.get(`${subjectKey}:${route}:${windowStart.toISOString()}`);
          return requestCount === undefined ? null : { requestCount };
        },
      },
    },
    state,
  };
}

describe("Postgres user rate limits", () => {
  it("selects the premium throughput only for an enabled setting with remaining premium credits", async () => {
    const rateLimit = await import("./rate-limit.js");

    expect(rateLimit.getAnalysisThroughputPolicy({ premiumEnabled: false, premiumRemaining: 9 }))
      .toBe(rateLimit.ANALYSIS_THROUGHPUT.free);
    expect(rateLimit.getAnalysisThroughputPolicy({ premiumEnabled: true, premiumRemaining: 0 }))
      .toBe(rateLimit.ANALYSIS_THROUGHPUT.free);
    expect(rateLimit.getAnalysisThroughputPolicy({ premiumEnabled: true, premiumRemaining: 1 }))
      .toBe(rateLimit.ANALYSIS_THROUGHPUT.premium);
  });

  it("increments a bucket through the compound Prisma upsert", async () => {
    const calls = [];
    const db = {
      apiRateLimitBucket: {
        upsert: async (args) => {
          calls.push(args);
          return { requestCount: 1 };
        },
      },
    };
    const rateLimit = await import("./rate-limit.js");

    await expect(
      rateLimit.consumeUserRateLimit(db, {
        userId: USER_ID,
        policy: rateLimit.USER_RATE_LIMITS.analysis,
        now: NOW,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      requestCount: 1,
      remaining: 2,
    });

    expect(calls).toEqual([
      {
        where: {
          subjectKey_route_windowStart: {
            subjectKey: `user:${USER_ID}`,
            route: "analysis",
            windowStart: new Date("2026-07-23T10:00:00.000Z"),
          },
        },
        create: {
          subjectKey: `user:${USER_ID}`,
          route: "analysis",
          windowStart: new Date("2026-07-23T10:00:00.000Z"),
          requestCount: 1,
        },
        update: {
          requestCount: { increment: 1 },
        },
        select: { requestCount: true },
      },
    ]);
  });

  it("allows three analysis requests in one fixed 15-minute window then returns RATE_LIMITED", async () => {
    const { db } = createMemoryDatabase();
    const rateLimit = await import("./rate-limit.js");

    const first = await rateLimit.consumeUserRateLimit(db, {
      userId: USER_ID,
      policy: rateLimit.USER_RATE_LIMITS.analysis,
      now: NOW,
    });
    const second = await rateLimit.consumeUserRateLimit(db, {
      userId: USER_ID,
      policy: rateLimit.USER_RATE_LIMITS.analysis,
      now: NOW,
    });
    const third = await rateLimit.consumeUserRateLimit(db, {
      userId: USER_ID,
      policy: rateLimit.USER_RATE_LIMITS.analysis,
      now: NOW,
    });
    const limited = await rateLimit.consumeUserRateLimit(db, {
      userId: USER_ID,
      policy: rateLimit.USER_RATE_LIMITS.analysis,
      now: NOW,
    });

    expect([first.allowed, second.allowed, third.allowed]).toEqual([true, true, true]);
    expect(limited).toMatchObject({
      allowed: false,
      code: "RATE_LIMITED",
      limit: 3,
      remaining: 0,
    });
  });

  it("allows ten premium analysis starts in one 15-minute bucket then limits the eleventh", async () => {
    const { db } = createMemoryDatabase();
    const rateLimit = await import("./rate-limit.js");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(
        rateLimit.consumeUserRateLimit(db, {
          userId: USER_ID,
          policy: rateLimit.ANALYSIS_THROUGHPUT.premium.rateLimit,
          now: NOW,
        }),
      ).resolves.toMatchObject({ allowed: true, limit: 10 });
    }

    await expect(
      rateLimit.consumeUserRateLimit(db, {
        userId: USER_ID,
        policy: rateLimit.ANALYSIS_THROUGHPUT.premium.rateLimit,
        now: NOW,
      }),
    ).resolves.toMatchObject({ allowed: false, code: "RATE_LIMITED", limit: 10 });
  });

  it("uses an independent hourly bucket for administrator model tests", async () => {
    const { db } = createMemoryDatabase();
    const rateLimit = await import("./rate-limit.js");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        rateLimit.consumeUserRateLimit(db, {
          userId: USER_ID,
          policy: rateLimit.USER_RATE_LIMITS.adminModelTest,
          now: NOW,
        }),
      ).resolves.toMatchObject({ allowed: true, limit: 3 });
    }

    await expect(
      rateLimit.consumeUserRateLimit(db, {
        userId: USER_ID,
        policy: rateLimit.USER_RATE_LIMITS.adminModelTest,
        now: new Date("2026-07-23T11:00:00.000Z"),
      }),
      ).resolves.toMatchObject({ allowed: true, remaining: 2 });
  });


  it("peeks the remaining free uses without creating or incrementing a bucket", async () => {
    const rateLimit = await import("./rate-limit.js");
    const { db, state } = createMemoryDatabase();
    const policy = rateLimit.USER_RATE_LIMITS.experienceDraft;

    const fresh = await rateLimit.peekUserRateLimit(db, { userId: USER_ID, policy, now: NOW });
    expect(fresh).toEqual({ limit: 2, remaining: 2, resetAt: new Date("2026-07-24T00:00:00.000Z") });
    expect(state.size).toBe(0);

    await rateLimit.consumeUserRateLimit(db, { userId: USER_ID, policy, now: NOW });
    const afterOne = await rateLimit.peekUserRateLimit(db, { userId: USER_ID, policy, now: NOW });
    expect(afterOne.remaining).toBe(1);

    await rateLimit.consumeUserRateLimit(db, { userId: USER_ID, policy, now: NOW });
    await rateLimit.consumeUserRateLimit(db, { userId: USER_ID, policy, now: NOW });
    const over = await rateLimit.peekUserRateLimit(db, { userId: USER_ID, policy, now: NOW });
    expect(over.remaining).toBe(0);
    expect([...state.values()]).toEqual([3]);
  });
});

describe("anonymous subject rate limits", () => {
  it("counts an IP key separately from a user key and denies past the limit", async () => {
    const rateLimit = await import("./rate-limit.js");
    const { db } = createMemoryDatabase();
    const policy = { route: "site-visit", limit: 2, windowMs: 10 * 60 * 1000 };

    const first = await rateLimit.consumeSubjectRateLimit(db, { subjectKey: "ip:abc", policy, now: NOW });
    const second = await rateLimit.consumeSubjectRateLimit(db, { subjectKey: "ip:abc", policy, now: NOW });
    const third = await rateLimit.consumeSubjectRateLimit(db, { subjectKey: "ip:abc", policy, now: NOW });
    const otherIp = await rateLimit.consumeSubjectRateLimit(db, { subjectKey: "ip:def", policy, now: NOW });

    expect([first.allowed, second.allowed, third.allowed, otherIp.allowed]).toEqual([true, true, false, true]);
  });

  it("rejects an empty or oversized subject key", async () => {
    const rateLimit = await import("./rate-limit.js");
    const { db } = createMemoryDatabase();
    const policy = rateLimit.ANONYMOUS_RATE_LIMITS.siteVisit;

    await expect(rateLimit.consumeSubjectRateLimit(db, { subjectKey: "", policy })).rejects.toThrow(TypeError);
    await expect(rateLimit.consumeSubjectRateLimit(db, { subjectKey: "x".repeat(321), policy })).rejects.toThrow(TypeError);
  });
});

describe("purgeExpiredRateLimitBuckets", () => {
  it("deletes only buckets older than two days", async () => {
    const rateLimit = await import("./rate-limit.js");
    let where;
    const db = { apiRateLimitBucket: { deleteMany: async (args) => { where = args.where; return { count: 4 }; } } };

    const deleted = await rateLimit.purgeExpiredRateLimitBuckets({ db, now: NOW });

    expect(deleted).toBe(4);
    expect(where.windowStart.lt.toISOString()).toBe("2026-07-21T10:07:30.000Z");
  });

  it("never fails the caller", async () => {
    const rateLimit = await import("./rate-limit.js");
    const db = { apiRateLimitBucket: { deleteMany: async () => { throw new Error("db down"); } } };

    await expect(rateLimit.purgeExpiredRateLimitBuckets({ db, now: NOW })).resolves.toBe(0);
    await expect(rateLimit.purgeExpiredRateLimitBuckets({ db: {} })).resolves.toBe(0);
  });
});
