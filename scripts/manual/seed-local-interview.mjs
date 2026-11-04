// 로컬 전용 DB(preview_interview_dev)에 AI 면접 연습을 써 볼 재료를 넣는다. 운영 데이터는 복사하지 않는다.
//
//   DATABASE_URL=postgresql://<내 계정>@localhost:5432/preview_interview_dev \
//   node scripts/manual/seed-local-interview.mjs --user-id <Supabase uid> --email <로그인 이메일> [--credits 3]
//
// - 로컬 호스트가 아니면 바로 멈춘다(운영 DB 보호).
// - 로그인은 운영 Supabase 를 그대로 쓰므로, 로컬 users 행의 id 가 Supabase uid 와 같아야 403 이 나지 않는다.
//   uid 는 로컬 앱에서 로그인한 뒤 브라우저 콘솔에서 `(await (await import("/src/lib/supabase.ts")).supabase.auth.getUser()).data.user.id` 로 볼 수 있다.
// - 리포트는 공개 예시(client/src/constants/resumeReportSample.ts)를 Vite 로 읽어 그대로 심는다. 가상의 지원자다.
// - 스키마가 바뀌었으면 먼저: DATABASE_URL=... DIRECT_URL=... pnpm exec prisma db push
import { userInfo } from "node:os";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { createServer } from "vite";

const ROOT = path.resolve(import.meta.dirname, "../..");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const userId = option("user-id");
const email = option("email");
const credits = Number(option("credits") ?? 3);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID.test(userId ?? "") || !email?.includes("@")) {
  console.error("--user-id <uuid> 와 --email <이메일> 이 필요합니다.");
  process.exit(2);
}

const databaseUrl = process.env.DATABASE_URL ?? `postgresql://${userInfo().username}@localhost:5432/preview_interview_dev`;
const { hostname, pathname } = new URL(databaseUrl);
if (hostname !== "localhost" && hostname !== "127.0.0.1") {
  console.error(`로컬 데이터베이스에만 심습니다. 대상 호스트: ${hostname}`);
  process.exit(2);
}

async function loadSampleReport() {
  // 모듈 하나만 읽으면 되므로 의존성 미리 묶기(dep-scan)는 끈다 — 켜 두면 public 의 html 들을 훑다가 경고를 낸다.
  const vite = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, "vite.config.ts"),
    server: { middlewareMode: true },
    logLevel: "error",
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const module = await vite.ssrLoadModule("/client/src/constants/resumeReportSample.ts");
    return module.RESUME_REPORT_SAMPLE;
  } finally {
    await vite.close();
  }
}

const sample = await loadSampleReport();
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  await db.user.upsert({ where: { id: userId }, update: { email }, create: { id: userId, email, name: sample.displayName } });
  await db.entitlementSetting.upsert({
    where: { id: "singleton" },
    update: { analysisEnabled: true, interviewEnabled: true },
    create: { id: "singleton", analysisEnabled: true, interviewEnabled: true, premiumEnabled: false, groblePaymentUrl: "https://payments.invalid/checkout" },
  });
  await db.analysisEntitlement.upsert({
    where: { userId },
    update: { interviewCreditsGranted: credits },
    create: { userId, interviewCreditsGranted: credits },
  });

  const existing = await db.analysis.findFirst({ where: { userId, kind: "RESUME", status: "SUCCESS" }, select: { id: true } });
  let analysisId = existing?.id;
  if (!analysisId) {
    const project = await db.project.create({
      data: { userId, title: `${sample.company} ${sample.jobRole}`, company: sample.company, jobKeyword: sample.jobRole },
    });
    const questions = sample.report.questionTabs.map((tab, index) => `[문항 ${index + 1}] ${tab.prompt}`).join("\n\n");
    const answers = sample.report.questionTabs.map((tab, index) => `[문항 ${index + 1}]\n${tab.fullAnswer}`).join("\n\n");
    const analysis = await db.analysis.create({
      data: {
        userId,
        projectId: project.id,
        kind: "RESUME",
        status: "SUCCESS",
        questionText: questions,
        inputText: answers,
        aiResponseJson: sample.report,
        totalChars: answers.length,
        modelName: "seed-sample",
        modelProvider: "seed",
      },
      select: { id: true },
    });
    analysisId = analysis.id;
  }

  console.log(JSON.stringify({ database: pathname.slice(1), userId, interviewCredits: credits, analysisId, report: `/report-new?analysisId=${analysisId}` }, null, 2));
} finally {
  await db.$disconnect();
  await pool.end();
}
