import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAnalyzeHandler } from "../../api/analyze.js";
import { SUCCESS_REPORT_TEXT, installProviderFixture } from "./harness/provider-fixture.js";
import { seedEntitlementSettings, seedUser, unlimitedThroughputPolicy } from "./harness/seed.js";
import { createTestPrismaClient, prepareTestDatabase, resetTables } from "./harness/test-database.js";

function response() {
  return {
    body: undefined,
    statusCode: 200,
    json(payload) { this.body = payload; return this; },
    status(code) { this.statusCode = code; return this; },
  };
}

// 멱등키는 /^[A-Za-z0-9_-]{16,128}$/ 를 만족해야 한다. 16자 미만이면
// 예약에 도달하기 전에 400 INVALID_IDEMPOTENCY_KEY 로 거부된다.
function request(idempotencyKey) {
  return {
    body: {
      company: "Pre:View",
      jobKeyword: "Product Manager",
      questions: [{ question: "지원 동기는 무엇인가요?", answer: "가".repeat(200) }],
    },
    headers: { "idempotency-key": idempotencyKey },
    method: "POST",
  };
}

describe("동시 요청과 멱등키", () => {
  let db;
  let fixture;
  // 핸들러는 배경 작업을 await 하지 않으므로 약속을 붙잡아 두었다가 기다린다.
  let backgroundWork = [];

  beforeAll(async () => {
    await prepareTestDatabase();
    db = createTestPrismaClient();
    // API 키는 setup.js 가 이미 가짜 값으로 덮어썼다.
  }, 120_000);

  beforeEach(async () => {
    await resetTables(db);
    await seedEntitlementSettings(db);
    fixture = installProviderFixture();
    fixture.respondWith({ text: SUCCESS_REPORT_TEXT });
    backgroundWork = [];
  });

  afterEach(() => {
    fixture.restore();
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  function handlerFor(userId) {
    return createAnalyzeHandler({
      db,
      enqueueBackgroundWork: (work) => {
        backgroundWork.push(work());
      },
      getAnalysisThroughputPolicy: () => unlimitedThroughputPolicy(),
      requireUser: async () => ({ applicationUser: { id: userId, role: "user" } }),
    });
  }

  async function fire(userId, key) {
    const res = response();
    await handlerFor(userId)(request(key), res);
    return res;
  }

  async function settle() {
    await Promise.allSettled(backgroundWork);
  }

  async function countByStatus(userId) {
    const rows = await db.analysisReservation.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  }

  it("무료 1건 사용자에게 동시 10건이 들어와도 크레딧은 정확히 한 번만 소모된다", async () => {
    const userId = await seedUser(db);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => fire(userId, `concurrent-key-${String(index).padStart(4, "0")}`)),
    );
    await settle();

    const accepted = results.filter((res) => res.statusCode === 202);
    expect(accepted).toHaveLength(1);

    const counts = await countByStatus(userId);
    expect(counts.CONSUMED ?? 0).toBe(1);
    expect(counts.PENDING ?? 0).toBe(0);
    expect(fixture.calls).toHaveLength(1);
  });

  it("같은 멱등키로 동시 요청해도 분석 요청은 하나만 생긴다", async () => {
    const userId = await seedUser(db);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => fire(userId, "same-idempotency-key")),
    );
    await settle();

    const requests = await db.analysisRequest.findMany({ where: { userId } });
    expect(requests).toHaveLength(1);
    expect(fixture.calls).toHaveLength(1);

    const ok = results.filter((res) => res.statusCode === 202 || res.statusCode === 200);
    expect(ok.length).toBeGreaterThanOrEqual(1);

    const counts = await countByStatus(userId);
    expect(counts.CONSUMED ?? 0).toBe(1);
  });

  it("프리미엄 크레딧 3개 사용자에게 동시 10건이 들어오면 4건만 통과한다", async () => {
    await seedEntitlementSettings(db, { premiumEnabled: true });
    const userId = await seedUser(db, { premiumCredits: 3 });

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => fire(userId, `premium-key-${String(index).padStart(5, "0")}`)),
    );
    await settle();

    // 무료 1 + 프리미엄 3 = 4
    expect(results.filter((res) => res.statusCode === 202)).toHaveLength(4);

    const counts = await countByStatus(userId);
    expect(counts.CONSUMED ?? 0).toBe(4);
    expect(counts.PENDING ?? 0).toBe(0);
    expect(fixture.calls).toHaveLength(4);
  });

  it("동시 요청 중 provider 가 전부 실패하면 크레딧이 하나도 소모되지 않는다", async () => {
    fixture.respondWith({ status: 500 });
    await seedEntitlementSettings(db, { premiumEnabled: true });
    const userId = await seedUser(db, { premiumCredits: 3 });

    await Promise.all(
      Array.from({ length: 4 }, (_, index) => fire(userId, `failing-key-${String(index).padStart(5, "0")}`)),
    );
    await settle();

    const counts = await countByStatus(userId);
    expect(counts.CONSUMED ?? 0).toBe(0);
    expect(counts.PENDING ?? 0).toBe(0);
    expect(counts.CANCELLED ?? 0).toBe(4);
  });
});
