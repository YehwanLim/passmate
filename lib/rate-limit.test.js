import { describe, expect, it } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-23T10:07:30.000Z");

function createMemoryDatabase() {
  const state = new Map();

  return {
    db: {
      $queryRaw: async (_strings, subjectKey, route, windowStart) => {
        const key = `${subjectKey}:${route}:${windowStart.toISOString()}`;
        const requestCount = (state.get(key) ?? 0) + 1;
        state.set(key, requestCount);
        return [{ request_count: requestCount }];
      },
    },
    state,
  };
}

describe("Postgres user rate limits", () => {
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

  it("labels a raw bucket query failure without exposing its message", async () => {
    const rateLimit = await import("./rate-limit.js");
    const failure = new Error("database connection string must stay private");
    failure.code = "P2010";
    const db = { $queryRaw: async () => { throw failure; } };

    await expect(
      rateLimit.consumeUserRateLimit(db, {
        userId: USER_ID,
        policy: rateLimit.USER_RATE_LIMITS.analysis,
        now: NOW,
      }),
    ).rejects.toMatchObject({
      code: "P2010",
      safeDiagnosticStage: "rate_limit_bucket",
    });
  });
});
