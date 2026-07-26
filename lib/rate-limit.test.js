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
      },
    },
    state,
  };
}

describe("Postgres user rate limits", () => {
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

});
