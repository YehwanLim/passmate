import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // 마이그레이션/db push 시: DIRECT_URL 사용 (PgBouncer는 DDL 미지원)
    // 런타임 쿼리 시: Prisma Client에서 DATABASE_URL 사용
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
    directUrl: process.env["DIRECT_URL"],
  },
});
