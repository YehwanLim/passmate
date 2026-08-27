import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  assertLocalDatabase,
  createTestPrismaClient,
  prepareTestDatabase,
  resetTables,
  testDatabaseUrl,
} from "./test-database.js";

describe("통합 테스트 데이터베이스 하네스", () => {
  let db;

  beforeAll(async () => {
    await prepareTestDatabase();
    db = createTestPrismaClient();
  }, 120_000);

  beforeEach(async () => {
    await resetTables(db);
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("비로컬 데이터베이스를 거부한다", () => {
    expect(() => assertLocalDatabase("postgresql://user@db.example.com:5432/postgres"))
      .toThrowError(/로컬 데이터베이스에서만/);
    expect(() => assertLocalDatabase("postgresql://localhost:5432/passmate_test")).not.toThrow();
  });

  it("기본 대상이 로컬이다", () => {
    expect(() => assertLocalDatabase(testDatabaseUrl())).not.toThrow();
  });

  it("마이그레이션이 적용되어 스키마의 테이블이 존재한다", async () => {
    const rows = await db.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN
        ('users', 'analysis_requests', 'analysis_reservations', 'api_rate_limit_buckets', 'audit_events')
    `;
    expect(rows).toHaveLength(5);
  });

  it("resetTables 가 데이터를 비운다", async () => {
    await db.user.create({ data: { id: "11111111-1111-4111-8111-111111111111", email: "a@example.invalid" } });
    expect(await db.user.count()).toBe(1);
    await resetTables(db);
    expect(await db.user.count()).toBe(0);
  });
});
