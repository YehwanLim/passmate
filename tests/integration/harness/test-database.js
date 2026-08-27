import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

/**
 * Homebrew 로 설치한 PostgreSQL 은 OS 사용자와 같은 이름의 슈퍼유저를 만든다.
 * node-postgres 는 사용자를 생략하면 OS 사용자로 채우지만 Prisma 는 그러지 않고
 * P1010 으로 거부하므로, 기본 URL 에 사용자명을 명시한다.
 */
function defaultTestDatabaseUrl() {
  return `postgresql://${userInfo().username}@localhost:5432/passmate_test`;
}

export function testDatabaseUrl() {
  return process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl();
}

export function assertLocalDatabase(url) {
  const { hostname } = new URL(url);
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error(
      `통합 테스트는 로컬 데이터베이스에서만 실행한다. 대상 호스트: ${hostname}`,
    );
  }
}

function maintenanceUrl(url) {
  const admin = new URL(url);
  admin.pathname = "/postgres";
  return admin.toString();
}

function databaseName(url) {
  return new URL(url).pathname.replace(/^\//, "");
}

async function ensureDatabaseExists(url) {
  const pool = new pg.Pool({ connectionString: maintenanceUrl(url), max: 1 });
  const name = databaseName(url);
  try {
    const { rows } = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rows.length === 0) {
      await pool.query(`CREATE DATABASE "${name}"`);
    }
  } catch (error) {
    throw new Error(
      `로컬 PostgreSQL 에 연결할 수 없다. 먼저 실행하라: brew services start postgresql@17\n원인: ${error.message}`,
    );
  } finally {
    await pool.end();
  }
}

/**
 * `migrate deploy` 가 아니라 `db push` 를 쓰는 이유:
 * 마이그레이션 이력은 이미 존재하는 기본 스키마를 전제한다. 가장 오래된 마이그레이션이
 * `prompt_templates` 를 변경하는데 그 테이블을 만드는 마이그레이션은 없다 — 원래
 * `prisma db push` 로 만들어진 스키마이기 때문이다 (`scripts/bootstrap-empty-staging-db.mjs`
 * 도 같은 이유로 db push 를 먼저 돌린다).
 *
 * 빈 테스트 데이터베이스에는 db push 하나로 충분하다. 마이그레이션이 추가로 하는 일은
 * RLS 활성화, anon/authenticated 권한 회수, auth.users 트리거, 데이터 백필인데
 * 로컬에는 그 역할도 auth 스키마도 없고 백필할 데이터도 없다.
 */
function applySchema(url) {
  execFileSync("pnpm", ["exec", "prisma", "db", "push"], {
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: "pipe",
  });
}

let prepared = false;

export async function prepareTestDatabase() {
  if (prepared) return;
  const url = testDatabaseUrl();
  assertLocalDatabase(url);
  await ensureDatabaseExists(url);
  applySchema(url);
  prepared = true;
}

export function createTestPrismaClient() {
  const url = testDatabaseUrl();
  assertLocalDatabase(url);
  const pool = new pg.Pool({ connectionString: url, max: 20 });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export async function resetTables(db) {
  const rows = await db.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
  `;
  if (rows.length === 0) return;
  const list = rows.map((row) => `public."${row.table_name}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
