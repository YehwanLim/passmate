// =============================================================================
// Prisma DB 연결 테스트 스크립트 (Prisma 7 + Driver Adapter)
// 실행: npx tsx scripts/test-db.ts
// =============================================================================

import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔌 Supabase DB 연결 테스트 시작...\n");

  try {
    // 1. 테이블 목록 조회
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    console.log("✅ DB 연결 성공!\n");
    console.log("📋 생성된 테이블 목록:");
    tables.forEach((t, i) => console.log(`   ${i + 1}. ${t.table_name}`));
    console.log();

    // 2. 각 테이블 카운트
    const userCount = await prisma.user.count();
    const projectCount = await prisma.project.count();
    const analysisCount = await prisma.analysis.count();
    const tokenUsageCount = await prisma.tokenUsage.count();
    const feedbackCount = await prisma.feedback.count();
    const promptTemplateCount = await prisma.promptTemplate.count();

    console.log("📊 레코드 수:");
    console.log(`   users:            ${userCount}`);
    console.log(`   projects:         ${projectCount}`);
    console.log(`   analyses:         ${analysisCount}`);
    console.log(`   token_usages:     ${tokenUsageCount}`);
    console.log(`   feedbacks:        ${feedbackCount}`);
    console.log(`   prompt_templates: ${promptTemplateCount}`);
    console.log();

    console.log("🎉 모든 테스트 통과!");
  } catch (error: any) {
    console.error("❌ DB 연결 실패:", error.message);
    console.error("   코드:", error.code);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
