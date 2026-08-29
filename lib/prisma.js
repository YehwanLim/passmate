// =============================================================================
// Prisma Client 싱글톤 (Prisma 7 + Supabase/Vercel Serverless 대응)
// =============================================================================
// Prisma 7에서는 Driver Adapter가 필수입니다.
// PgBouncer(pooler) 경유 DATABASE_URL로 연결합니다.
// =============================================================================

import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// 로컬 dev(Vite 미들웨어)에서는 이 모듈이 dotenv.config()를 호출하는 lib/auth.js보다
// 먼저 평가될 수 있다. DATABASE_URL이 로드되기 전에 Pool을 만들면 pg가 localhost
// 기본값으로 붙어 P1003이 나므로, Pool 생성 전에 반드시 .env를 로드한다.
dotenv.config({ quiet: true });

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5, // Serverless 환경에서는 커넥션 풀 크기를 작게 유지
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/** @type {import('@prisma/client').PrismaClient} */
let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = createPrismaClient();
} else {
  // 개발 환경: Hot Reload 시에도 싱글톤 유지
  if (!globalThis.__prisma) {
    globalThis.__prisma = createPrismaClient();
  }
  prisma = globalThis.__prisma;
}

export { prisma };
export default prisma;
