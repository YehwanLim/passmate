// =============================================================================
// Prisma Client 싱글톤 (Prisma 7 + Supabase/Vercel Serverless 대응)
// =============================================================================
// Prisma 7에서는 Driver Adapter가 필수입니다.
// PgBouncer(pooler) 경유 DATABASE_URL로 연결합니다.
// =============================================================================

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5, // Serverless 환경에서는 커넥션 풀 크기를 작게 유지
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/** @type {import('../generated/prisma/client.js').PrismaClient} */
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
