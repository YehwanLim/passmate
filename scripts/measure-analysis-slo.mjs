/**
 * 분석 신뢰성 SLO 실측 (체크리스트 5번 / P1-01).
 *
 * 통합 테스트 러너와 달리 이 스크립트는 **진짜 provider 를 호출한다.** 사용자가 실제로
 * 기다리는 시간은 거의 전부가 모델 응답 시간이라, 가짜 provider 로는 잴 수 없기 때문이다.
 *
 * 안전장치:
 *   - 로컬 테스트 데이터베이스에만 쓴다 (운영/스테이징 접속은 거부).
 *   - 실제 사용자 크레딧이 아니라 테스트 DB 의 시드 사용자 크레딧을 쓴다.
 *   - 비용이 발생하므로 --confirm-real-provider-calls 없이는 실행하지 않는다.
 *
 * 사용법:
 *   node scripts/measure-analysis-slo.mjs --confirm-real-provider-calls [--runs=10]
 */
import "dotenv/config";

import { createAnalyzeHandler } from "../api/analyze.js";
import {
  seedEntitlementSettings,
  seedUser,
  unlimitedThroughputPolicy,
} from "../tests/integration/harness/seed.js";
import {
  createTestPrismaClient,
  prepareTestDatabase,
  resetTables,
  testDatabaseUrl,
} from "../tests/integration/harness/test-database.js";

const args = process.argv.slice(2);
const confirmed = args.includes("--confirm-real-provider-calls");
const runs = Number(args.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 10);

if (!confirmed) {
  console.error(
    [
      "이 스크립트는 실제 provider 를 호출하므로 비용이 발생한다.",
      "실행하려면 --confirm-real-provider-calls 를 붙여라.",
      "",
      "  node scripts/measure-analysis-slo.mjs --confirm-real-provider-calls --runs=10",
    ].join("\n"),
  );
  process.exit(1);
}

if (!Number.isInteger(runs) || runs < 1 || runs > 100) {
  console.error("--runs 는 1 이상 100 이하의 정수여야 한다.");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY 가 없다. .env 를 확인하라.");
  process.exit(1);
}

function response() {
  return {
    body: undefined,
    statusCode: 200,
    json(payload) { this.body = payload; return this; },
    status(code) { this.statusCode = code; return this; },
  };
}

function request(index) {
  return {
    body: {
      company: "Pre:View",
      jobKeyword: "프로덕트 매니저",
      questions: [
        {
          question: "지원 동기와 입사 후 포부를 서술해 주세요.",
          answer:
            "저는 사용자의 문제를 데이터로 정의하고 가설을 세워 검증하는 일을 해왔습니다. "
            + "이전 직무에서는 온보딩 이탈 구간을 분석해 첫 주 잔존율을 개선한 경험이 있습니다. "
            + "입사 후에는 사용자 인터뷰와 로그 분석을 병행해 핵심 지표를 정의하고, "
            + "작은 실험을 빠르게 반복하는 문화를 만들고 싶습니다. ".repeat(3),
        },
      ],
    },
    headers: { "idempotency-key": `slo-measurement-run-${String(index).padStart(4, "0")}` },
    method: "POST",
  };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted[0] ?? null,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? null,
  };
}

const seconds = (ms) => (ms === null ? "-" : `${(ms / 1000).toFixed(1)}초`);

const db = createTestPrismaClient();

try {
  console.log("=== 분석 신뢰성 SLO 실측 ===");
  console.log(`대상 DB : ${new URL(testDatabaseUrl()).hostname} (로컬 테스트 전용)`);
  console.log(`실행 횟수: ${runs}회`);
  console.log("provider : 실제 호출 (비용 발생)");
  console.log("");

  await prepareTestDatabase();
  await resetTables(db);
  await seedEntitlementSettings(db, { premiumEnabled: true });
  const userId = await seedUser(db, { premiumCredits: runs + 5 });

  const backgroundWork = [];
  const handler = createAnalyzeHandler({
    db,
    enqueueBackgroundWork: (work) => { backgroundWork.push(work()); },
    getAnalysisThroughputPolicy: () => unlimitedThroughputPolicy(),
    requireUser: async () => ({ applicationUser: { id: userId, role: "user" } }),
  });

  const results = [];
  for (let index = 0; index < runs; index += 1) {
    backgroundWork.length = 0;
    const res = response();
    const startedAt = Date.now();
    await handler(request(index), res);
    await Promise.allSettled(backgroundWork);
    const elapsedMs = Date.now() - startedAt;

    const analysisRequest = await db.analysisRequest.findFirst({
      where: { userId, idempotencyKey: `slo-measurement-run-${String(index).padStart(4, "0")}` },
    });
    const succeeded = analysisRequest?.status === "SUCCEEDED";
    results.push({ elapsedMs, succeeded, status: analysisRequest?.status ?? "NONE", accepted: res.statusCode });
    console.log(
      `  ${String(index + 1).padStart(2)}회차  ${succeeded ? "성공" : "실패"}  `
      + `${seconds(elapsedMs)}  (상태 ${analysisRequest?.status ?? "없음"})`,
    );
  }

  const usages = await db.tokenUsage.findMany({
    where: { analysis: { userId } },
    select: { latencyMs: true, totalTokens: true, promptTokens: true, completionTokens: true, modelName: true },
  });

  const successes = results.filter((r) => r.succeeded);
  const endToEnd = summarize(successes.map((r) => r.elapsedMs));
  const modelOnly = summarize(usages.map((u) => u.latencyMs).filter((v) => Number.isFinite(v)));

  console.log("");
  console.log("=== 결과 ===");
  console.log(`성공률       : ${successes.length}/${results.length} (${((successes.length / results.length) * 100).toFixed(0)}%)`);
  console.log("");
  console.log("전체 소요 시간 (사용자가 기다리는 시간)");
  console.log(`  최소 ${seconds(endToEnd.min)} / 중앙값 ${seconds(endToEnd.p50)} / P95 ${seconds(endToEnd.p95)} / 최대 ${seconds(endToEnd.max)}`);
  console.log("");
  console.log("그중 모델 호출 시간");
  console.log(`  최소 ${seconds(modelOnly.min)} / 중앙값 ${seconds(modelOnly.p50)} / P95 ${seconds(modelOnly.p95)} / 최대 ${seconds(modelOnly.max)}`);
  if (endToEnd.p50 !== null && modelOnly.p50 !== null) {
    console.log(`  -> 우리 코드 오버헤드 (중앙값 기준): 약 ${seconds(endToEnd.p50 - modelOnly.p50)}`);
  }
  console.log("");

  const totalTokens = usages.reduce((sum, u) => sum + (u.totalTokens ?? 0), 0);
  const promptTokens = usages.reduce((sum, u) => sum + (u.promptTokens ?? 0), 0);
  const completionTokens = usages.reduce((sum, u) => sum + (u.completionTokens ?? 0), 0);
  console.log("토큰 사용량");
  console.log(`  모델 ${usages[0]?.modelName ?? "-"}`);
  console.log(`  합계 ${totalTokens} (입력 ${promptTokens} / 출력 ${completionTokens})`);
  console.log(`  1회 평균 ${usages.length > 0 ? Math.round(totalTokens / usages.length) : 0}`);
  console.log("");

  const reservations = await db.analysisReservation.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });
  console.log("예약 상태 (크레딧 정산)");
  for (const row of reservations) console.log(`  ${row.status}: ${row._count._all}건`);
  const pending = reservations.find((r) => r.status === "PENDING")?._count._all ?? 0;
  console.log(pending === 0 ? "  -> PENDING 잔여 없음 (정상)" : `  -> 경고: PENDING ${pending}건 남음`);
} finally {
  await db.$disconnect();
}
