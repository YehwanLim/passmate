// =============================================================================
// DB CRUD 통합 테스트 스크립트 (로컬 실행)
// 실행: npx tsx scripts/test-crud.ts
// =============================================================================

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  PassMate DB CRUD 통합 테스트");
  console.log("═══════════════════════════════════════\n");

  try {
    // ── 1. User 생성/조회 ──
    console.log("🔹 Step 1: User 생성...");
    const testEmail = "test@passmate.kr";
    let user = await prisma.user.findUnique({ where: { email: testEmail } });

    if (!user) {
      user = await prisma.user.create({
        data: { email: testEmail, name: "테스트 유저" },
      });
      console.log(`   ✅ User 생성 완료: ${user.id}`);
    } else {
      console.log(`   ℹ️ 기존 User 사용: ${user.id}`);
    }

    // ── 2. Project 생성 ──
    console.log("\n🔹 Step 2: Project 생성...");
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        title: "삼성전자 PM 지원서 (테스트)",
        company: "삼성전자",
        jobKeyword: "PM",
      },
    });
    console.log(`   ✅ Project 생성 완료: ${project.id}`);
    console.log(`   📁 ${project.title}`);

    // ── 3. Analysis + TokenUsage 동시 생성 ──
    console.log("\n🔹 Step 3: Analysis + TokenUsage 생성...");
    const analysis = await prisma.analysis.create({
      data: {
        userId: user.id,
        projectId: project.id,
        questionText: "본인의 강점을 설명해 주세요.",
        inputText: "저는 데이터 기반 의사결정을 중시하는 PM입니다.",
        aiResponseJson: {
          score: 80,
          summary: "데이터 중심 사고가 돋보이는 답변입니다.",
        },
        aiScore: 80,
        status: "SUCCESS",
        modelName: "gemini-1.5-flash",
        modelProvider: "gemini",
        totalChars: 28,
        responseTime: 3200,
        tokenUsages: {
          create: {
            modelName: "gemini-1.5-flash",
            modelProvider: "gemini",
            promptTokens: 850,
            completionTokens: 320,
            totalTokens: 1170,
            cost: 0.001,
            callType: "ANALYSIS",
            latencyMs: 3200,
            httpStatus: 200,
            isSuccess: true,
          },
        },
      },
      include: { tokenUsages: true },
    });
    console.log(`   ✅ Analysis 생성 완료: ${analysis.id}`);
    console.log(`   📊 TokenUsage: ${analysis.tokenUsages.length}개`);
    console.log(
      `   🔢 총 토큰: ${analysis.tokenUsages[0]?.totalTokens || 0}`
    );

    // ── 4. 전체 조회 (relations 포함) ──
    console.log("\n🔹 Step 4: 전체 Analysis 조회...");
    const list = await prisma.analysis.findMany({
      include: {
        tokenUsages: true,
        user: { select: { email: true, name: true } },
        project: { select: { title: true, company: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    console.log(`   ✅ 조회 완료: ${list.length}건\n`);
    list.forEach((a, i) => {
      console.log(`   [${i + 1}] ${a.questionText}`);
      console.log(`       상태: ${a.status} | 모델: ${a.modelName}`);
      console.log(
        `       유저: ${a.user.name} | 프로젝트: ${a.project.title}`
      );
      console.log(`       토큰 사용 기록: ${a.tokenUsages.length}건`);
    });

    // ── 5. 카운트 요약 ──
    console.log("\n═══════════════════════════════════════");
    console.log("  📊 테이블별 레코드 수");
    console.log("═══════════════════════════════════════");
    console.log(`   users:            ${await prisma.user.count()}`);
    console.log(`   projects:         ${await prisma.project.count()}`);
    console.log(`   analyses:         ${await prisma.analysis.count()}`);
    console.log(`   token_usages:     ${await prisma.tokenUsage.count()}`);
    console.log(`   feedbacks:        ${await prisma.feedback.count()}`);
    console.log(`   prompt_templates: ${await prisma.promptTemplate.count()}`);

    console.log("\n🎉 모든 CRUD 테스트 통과!\n");
  } catch (error: any) {
    console.error("\n❌ 테스트 실패:", error.message);
    console.error("   코드:", error.code);
    if (error.meta) console.error("   메타:", error.meta);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
