import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAnalyzeHandler } from "../../api/analyze.js";
import { getEntitlementSummary } from "../../lib/analysis-entitlements.js";
import { SUCCESS_REPORT_TEXT, installProviderFixture } from "./harness/provider-fixture.js";
import {
  seedAiModelSettings,
  seedEntitlementSettings,
  seedUser,
  unlimitedThroughputPolicy,
} from "./harness/seed.js";
import { createTestPrismaClient, prepareTestDatabase, resetTables } from "./harness/test-database.js";

function response() {
  return {
    body: undefined,
    statusCode: 200,
    json(payload) { this.body = payload; return this; },
    status(code) { this.statusCode = code; return this; },
  };
}

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

describe("provider 시나리오", () => {
  let db;
  let fixture;
  // 핸들러는 배경 작업을 waitUntil 처럼 fire-and-forget 으로 넘긴다(await 하지 않는다).
  // 테스트는 그 작업이 끝난 뒤의 상태를 봐야 하므로 약속을 붙잡아 두었다가 기다린다.
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
    backgroundWork = [];
  });

  afterEach(() => {
    fixture.restore();
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  function buildHandler(userId) {
    return createAnalyzeHandler({
      db,
      enqueueBackgroundWork: (work) => {
        backgroundWork.push(work());
      },
      getAnalysisThroughputPolicy: () => unlimitedThroughputPolicy(),
      requireUser: async () => ({ applicationUser: { id: userId, role: "user" } }),
    });
  }

  async function postAnalyze(userId, key = "scenario-key-0001") {
    const res = response();
    await buildHandler(userId)(request(key), res);
    // 접수 응답을 받은 뒤 배경 분석이 끝나기를 기다린다.
    await Promise.allSettled(backgroundWork);
    return res;
  }

  async function reservationStatuses(userId) {
    const rows = await db.analysisReservation.findMany({ where: { userId }, select: { status: true } });
    return rows.map((row) => row.status).sort();
  }

  it("성공: 예약이 CONSUMED 되고 크레딧이 한 번 소모된다", async () => {
    fixture.respondWith({ text: SUCCESS_REPORT_TEXT });
    const userId = await seedUser(db);

    const res = await postAnalyze(userId);

    expect(res.statusCode).toBe(202);
    expect(fixture.calls).toHaveLength(1);
    expect(await reservationStatuses(userId)).toEqual(["CONSUMED"]);
    const requests = await db.analysisRequest.findMany({ where: { userId } });
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe("SUCCEEDED");
  });

  it("타임아웃: 예약이 CANCELLED 되어 크레딧이 소모되지 않는다", async () => {
    fixture.respondWith({ abort: true });
    const userId = await seedUser(db);

    await postAnalyze(userId);

    expect(await reservationStatuses(userId)).toEqual(["CANCELLED"]);
    const requests = await db.analysisRequest.findMany({ where: { userId } });
    expect(requests[0].status).toBe("FAILED");
  });

  it("429: 실패하면 크레딧이 소모되지 않는다", async () => {
    fixture.respondWith({ status: 429 });
    const userId = await seedUser(db);

    await postAnalyze(userId);

    expect(fixture.calls.length).toBeGreaterThanOrEqual(1);
    expect(await reservationStatuses(userId)).toEqual(["CANCELLED"]);
  });

  it("429 뒤 성공: 폴백 모델로 재시도해 회복하고 크레딧은 한 번만 소모된다", async () => {
    // 폴백을 심지 않으면 모델 후보가 하나뿐이라 재시도 자체가 일어나지 않는다.
    await seedAiModelSettings(db, { withFallback: true });
    fixture.respondWith([{ status: 429 }, { text: SUCCESS_REPORT_TEXT }]);
    const userId = await seedUser(db);

    await postAnalyze(userId);

    // 첫 호출은 gemini 가 429, 두 번째는 폴백인 openai 가 성공한다.
    expect(fixture.calls.map((call) => call.provider)).toEqual(["gemini", "openai"]);
    expect(await reservationStatuses(userId)).toEqual(["CONSUMED"]);
  }, 20_000);

  it("500: 크레딧이 소모되지 않는다", async () => {
    fixture.respondWith({ status: 500 });
    const userId = await seedUser(db);

    await postAnalyze(userId);

    expect(await reservationStatuses(userId)).toEqual(["CANCELLED"]);
  });

  it("파싱 실패: 진짜 파서가 거부하고 크레딧이 소모되지 않는다", async () => {
    fixture.respondWith({ text: "이것은 JSON 이 아니다" });
    const userId = await seedUser(db);

    await postAnalyze(userId);

    expect(fixture.calls).toHaveLength(1);
    expect(await reservationStatuses(userId)).toEqual(["CANCELLED"]);
    const requests = await db.analysisRequest.findMany({ where: { userId } });
    expect(requests[0].status).toBe("FAILED");
  });

  it("실패한 뒤에도 남은 무료 크레딧이 회복된다", async () => {
    fixture.respondWith({ status: 500 });
    const userId = await seedUser(db);

    await postAnalyze(userId);

    const summary = await db.$transaction((tx) => getEntitlementSummary(tx, userId));
    expect(summary.freeRemaining).toBe(1);
  });
});
