# 격리된 provider fixture / 통합 테스트 러너 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 AI 호출과 실제 크레딧 소모 없이 분석 파이프라인의 성공·타임아웃·429·500·파싱 실패·동시 요청을 명령 하나로 반복 검증할 수 있게 한다.

**Architecture:** 진짜 로컬 Postgres 에 테스트 전용 DB 를 두고, provider 로 나가는 `fetch` 만 러너 프로세스 안에서 가로챈다. `createAnalyzeHandler` 의 기존 의존성 주입 지점만 사용하므로 제품 코드는 바뀌지 않는다. 기존 단위 테스트 스위트와는 별도 vitest 설정으로 분리한다.

**Tech Stack:** Node ESM, Vitest 2, Prisma 7 + `@prisma/adapter-pg`, `pg`, Homebrew `postgresql@17`

**Spec:** `docs/superpowers/specs/2026-08-27-provider-fixture-test-runner-design.md`

## Global Constraints

- 패키지 매니저는 **pnpm 전용**. npm/yarn 사용 금지, 락파일 변경 금지.
- **제품 코드(`api/`, `lib/`, `client/`, `shared/`) 수정 0줄.** 기존 주입 지점만 사용한다.
- **기존 `pnpm exec vitest run` 은 73파일 328테스트 통과를 유지해야 한다.** 새 테스트가 기본 스위트에 포함되면 안 된다.
- 테스트 DB 접속 호스트가 `localhost`/`127.0.0.1` 이 아니면 **거부하고 종료**한다.
- provider 호스트 외의 외부 호출이 발생하면 **에러로 즉시 실패**시킨다.
- 러너는 `GEMINI_API_KEY`/`OPENAI_API_KEY` 를 가짜 값으로 덮어쓴다.
- 서버 코드는 ESM JavaScript. `lib/prisma.js` 싱글턴은 테스트에서 쓰지 않고 테스트 전용 클라이언트를 만든다 (운영 `DATABASE_URL` 오염 방지).
- 포맷은 전역 `pnpm format` 금지. 필요하면 `pnpm exec prettier --write <파일>` 만.
- 새 문서는 한국어.

**사전 준비 (1회, 사람이 실행):**

```bash
brew services start postgresql@17
```

---

### Task 1: 테스트 DB 하네스와 분리된 실행 경로

**Files:**
- Create: `tests/integration/harness/test-database.js`
- Create: `tests/integration/harness/test-database.test.js`
- Create: `tests/integration/harness/setup.js`
- Create: `vitest.integration.config.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces:
  - `testDatabaseUrl(): string`
  - `assertLocalDatabase(url: string): void` — 비로컬이면 throw
  - `prepareTestDatabase(): Promise<void>` — DB 생성 + 마이그레이션 적용 (프로세스당 1회)
  - `createTestPrismaClient(): PrismaClient`
  - `resetTables(db: PrismaClient): Promise<void>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/integration/harness/test-database.test.js`:

```js
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
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm exec vitest run --config vitest.integration.config.ts`
Expected: FAIL — `vitest.integration.config.ts` 도 `test-database.js` 도 없다.

- [ ] **Step 3: 하네스를 구현한다**

`tests/integration/harness/test-database.js`:

```js
import { execFileSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const DEFAULT_TEST_DATABASE_URL = "postgresql://localhost:5432/passmate_test";

export function testDatabaseUrl() {
  return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
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

function applyMigrations(url) {
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
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
  applyMigrations(url);
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
```

- [ ] **Step 4: 가짜 API 키 가드를 만든다**

스펙은 "러너가 API 키를 가짜 값으로 덮어쓴다"를 코드가 강제하는 가드로 규정한다.
각 테스트가 기억해서 설정하면 새 테스트를 쓸 때 빠지므로, setup 파일에서 **자동으로** 적용한다.

`tests/integration/harness/setup.js`:

```js
// 통합 테스트는 실제 provider 를 절대 호출하지 않는다.
// fixture 가 네트워크를 가로채지만, 진짜 키가 프로세스에 남아 있으면
// 가로채기가 빠진 경로에서 실제 호출이 나갈 수 있다. 키 자체를 무력화한다.
process.env.GEMINI_API_KEY = "integration-fake-key";
process.env.OPENAI_API_KEY = "integration-fake-key";
process.env.OPEN_API_KEY = "integration-fake-key";
```

- [ ] **Step 5: 분리된 vitest 설정을 만든다**

`vitest.integration.config.ts`:

```ts
import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ["tests/integration/**/*.test.js"],
      setupFiles: ["tests/integration/harness/setup.js"],
      // 통합 테스트는 하나의 로컬 데이터베이스를 공유하므로 파일 간 병렬 실행을 끈다.
      // 동시성 검증은 파일 안에서 Promise.all 로 만든다.
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 120_000,
    },
  }),
);
```

- [ ] **Step 6: 기본 스위트에서 제외하고 스크립트를 추가한다**

`vitest.config.ts` 의 `exclude` 를 다음으로 바꾼다:

```ts
exclude: [...configDefaults.exclude, "**/.worktrees/**", "tests/integration/**"],
```

`package.json` 의 `scripts` 에 추가한다:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

`.gitignore` 에 추가한다:

```
# 통합 테스트 로컬 산출물
tests/integration/.tmp/
```

- [ ] **Step 7: 통과를 확인한다**

Run: `pnpm test:integration`
Expected: PASS — 4개 테스트 통과.

- [ ] **Step 8: 기존 스위트가 그대로인지 확인한다**

Run: `pnpm exec vitest run`
Expected: PASS — **73파일 328테스트**. 숫자가 달라지면 `exclude` 설정이 잘못된 것이다.

- [ ] **Step 9: 커밋한다**

```bash
git add tests/integration/harness/test-database.js tests/integration/harness/test-database.test.js tests/integration/harness/setup.js vitest.integration.config.ts vitest.config.ts package.json .gitignore
git commit -m "test: add a local-only integration database harness"
```

---

### Task 2: provider fixture

**Files:**
- Create: `tests/integration/harness/provider-fixture.js`
- Create: `tests/integration/harness/provider-fixture.test.js`

**Interfaces:**
- Consumes: 없음 (독립)
- Produces:
  - `installProviderFixture(): { calls, respondWith(scenario), restore() }`
  - `calls: Array<{ provider: "gemini" | "openai", modelName: string }>`
  - `respondWith(scenario)` — `scenario` 는 단일 응답 또는 배열
  - 응답 형태: `{ text: string }` | `{ status: number }` | `{ abort: true }`
  - `UnexpectedNetworkCallError`
  - `SUCCESS_REPORT_TEXT: string` — 파싱 가능한 성공 리포트 JSON 문자열

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/integration/harness/provider-fixture.test.js`:

```js
import { afterEach, describe, expect, it } from "vitest";

import {
  SUCCESS_REPORT_TEXT,
  UnexpectedNetworkCallError,
  installProviderFixture,
} from "./provider-fixture.js";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=fake";

describe("provider fixture", () => {
  let fixture;

  afterEach(() => {
    fixture?.restore();
    fixture = undefined;
  });

  it("gemini 성공 응답을 봉투 형태로 돌려주고 호출을 센다", async () => {
    fixture = installProviderFixture();
    fixture.respondWith({ text: SUCCESS_REPORT_TEXT });

    const response = await fetch(GEMINI_URL, { method: "POST" });
    const body = await response.json();

    expect(response.ok).toBe(true);
    expect(body.candidates[0].content.parts[0].text).toBe(SUCCESS_REPORT_TEXT);
    expect(fixture.calls).toEqual([{ provider: "gemini", modelName: "gemini-2.5-flash-lite" }]);
  });

  it("HTTP 오류 상태를 그대로 돌려준다", async () => {
    fixture = installProviderFixture();
    fixture.respondWith({ status: 429 });

    const response = await fetch(GEMINI_URL, { method: "POST" });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(429);
  });

  it("abort 시나리오는 AbortError 를 던진다", async () => {
    fixture = installProviderFixture();
    fixture.respondWith({ abort: true });

    await expect(fetch(GEMINI_URL, { method: "POST" })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("배열 시나리오를 호출 순서대로 소비하고 마지막 응답을 유지한다", async () => {
    fixture = installProviderFixture();
    fixture.respondWith([{ status: 429 }, { text: SUCCESS_REPORT_TEXT }]);

    expect((await fetch(GEMINI_URL, { method: "POST" })).status).toBe(429);
    expect((await fetch(GEMINI_URL, { method: "POST" })).status).toBe(200);
    expect((await fetch(GEMINI_URL, { method: "POST" })).status).toBe(200);
    expect(fixture.calls).toHaveLength(3);
  });

  it("provider 가 아닌 호스트로 나가는 호출은 실패시킨다", async () => {
    fixture = installProviderFixture();
    fixture.respondWith({ text: SUCCESS_REPORT_TEXT });

    await expect(fetch("https://example.invalid/anything")).rejects.toBeInstanceOf(
      UnexpectedNetworkCallError,
    );
  });

  it("restore 후에는 원래 fetch 가 돌아온다", async () => {
    const before = globalThis.fetch;
    fixture = installProviderFixture();
    fixture.restore();
    expect(globalThis.fetch).toBe(before);
    fixture = undefined;
  });

  it("성공 리포트 텍스트는 파싱 가능한 JSON 이다", () => {
    expect(() => JSON.parse(SUCCESS_REPORT_TEXT)).not.toThrow();
    expect(JSON.parse(SUCCESS_REPORT_TEXT).questionTabs).toBeInstanceOf(Array);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test:integration -- provider-fixture`
Expected: FAIL — `provider-fixture.js` 가 없다.

- [ ] **Step 3: fixture 를 구현한다**

`tests/integration/harness/provider-fixture.js`:

```js
const GEMINI_HOST = "generativelanguage.googleapis.com";
const OPENAI_HOST = "api.openai.com";
const PROVIDER_HOSTS = new Set([GEMINI_HOST, OPENAI_HOST]);

/** 파싱 가능한 최소 리포트. attachRequestAnswers 가 questionTabs 를 채운다. */
export const SUCCESS_REPORT_TEXT = JSON.stringify({
  firstImpression: { summary: "통합 테스트용 리포트" },
  questionTabs: [{ prompt: "", fullAnswer: "", review: "통합 테스트용 문항 평가" }],
});

export class UnexpectedNetworkCallError extends Error {
  constructor(hostname) {
    super(`통합 테스트에서 예상하지 못한 외부 호출이 발생했다: ${hostname}`);
    this.name = "UnexpectedNetworkCallError";
  }
}

function geminiEnvelope(text) {
  return {
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 22, totalTokenCount: 33 },
  };
}

function openAiEnvelope(text) {
  return {
    output_text: text,
    usage: { input_tokens: 11, output_tokens: 22, total_tokens: 33 },
  };
}

function fakeResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function modelNameFrom(url, provider) {
  if (provider === "openai") return "openai-model";
  const match = url.pathname.match(/\/models\/([^:]+):generateContent$/);
  return match?.[1] ?? "unknown";
}

export function installProviderFixture() {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let steps = [];

  globalThis.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input?.url;
    const url = new URL(raw);
    if (!PROVIDER_HOSTS.has(url.hostname)) {
      throw new UnexpectedNetworkCallError(url.hostname);
    }

    const provider = url.hostname === OPENAI_HOST ? "openai" : "gemini";
    calls.push({ provider, modelName: modelNameFrom(url, provider) });

    if (steps.length === 0) {
      throw new Error("provider fixture: respondWith 로 응답 시나리오를 먼저 설정해야 한다");
    }
    const step = steps.length > 1 ? steps.shift() : steps[0];

    if (step.abort) {
      throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    }
    if (typeof step.status === "number" && step.status !== 200) {
      return fakeResponse(step.status, {});
    }
    const envelope = provider === "openai" ? openAiEnvelope(step.text) : geminiEnvelope(step.text);
    return fakeResponse(200, envelope);
  };

  return {
    calls,
    respondWith(scenario) {
      steps = Array.isArray(scenario) ? [...scenario] : [scenario];
    },
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm test:integration -- provider-fixture`
Expected: PASS — 7개 테스트 통과.

- [ ] **Step 5: 커밋한다**

```bash
git add tests/integration/harness/provider-fixture.js tests/integration/harness/provider-fixture.test.js
git commit -m "test: add a network-level provider fixture with call counting"
```

---

### Task 3: 시드 헬퍼

**Files:**
- Create: `tests/integration/harness/seed.js`
- Create: `tests/integration/harness/seed.test.js`

**Interfaces:**
- Consumes: `createTestPrismaClient`, `prepareTestDatabase`, `resetTables` (Task 1)
- Produces:
  - `seedEntitlementSettings(db, { premiumEnabled?, analysisEnabled? }): Promise<void>`
  - `seedUser(db, { premiumCredits?, email? }): Promise<string>` — 생성된 userId 반환
  - `unlimitedThroughputPolicy(): { concurrencyLimit: number, rateLimit: { route, limit, windowMs } }`

`unlimitedThroughputPolicy` 가 필요한 이유: 무료 정책은 15분에 3회, 동시 1건이다. 동시 10건 시나리오에서 그 제한이 먼저 걸리면 정작 확인하려는 크레딧 락 직렬화에 도달하지 못한다. 락을 볼 때는 이 정책을 주입하고, 제한 자체를 볼 때는 실제 정책을 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/integration/harness/seed.test.js`:

```js
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getEntitlementSummary } from "../../../lib/analysis-entitlements.js";
import {
  createTestPrismaClient,
  prepareTestDatabase,
  resetTables,
} from "./test-database.js";
import { seedEntitlementSettings, seedUser, unlimitedThroughputPolicy } from "./seed.js";

describe("시드 헬퍼", () => {
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

  it("무료 크레딧 1개를 가진 사용자를 만든다", async () => {
    await seedEntitlementSettings(db);
    const userId = await seedUser(db);

    const summary = await db.$transaction((tx) => getEntitlementSummary(tx, userId));

    expect(summary).toMatchObject({ freeRemaining: 1, premiumRemaining: 0, remaining: 1 });
  });

  it("프리미엄이 켜져 있으면 지급한 만큼 프리미엄 크레딧을 갖는다", async () => {
    await seedEntitlementSettings(db, { premiumEnabled: true });
    const userId = await seedUser(db, { premiumCredits: 5 });

    const summary = await db.$transaction((tx) => getEntitlementSummary(tx, userId));

    expect(summary).toMatchObject({ premiumEnabled: true, freeRemaining: 1, premiumRemaining: 5, remaining: 6 });
  });

  it("사용자마다 다른 식별자와 이메일을 만든다", async () => {
    await seedEntitlementSettings(db);
    const first = await seedUser(db);
    const second = await seedUser(db);

    expect(first).not.toBe(second);
    expect(await db.user.count()).toBe(2);
  });

  it("무제한 처리량 정책은 레이트리밋과 동시성 제한을 사실상 없앤다", () => {
    const policy = unlimitedThroughputPolicy();

    expect(policy.concurrencyLimit).toBeGreaterThanOrEqual(1000);
    expect(policy.rateLimit.limit).toBeGreaterThanOrEqual(1000);
    expect(policy.rateLimit.route).toBe("analysis");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test:integration -- seed`
Expected: FAIL — `seed.js` 가 없다.

- [ ] **Step 3: 시드를 구현한다**

`tests/integration/harness/seed.js`:

```js
import { randomUUID } from "node:crypto";

/**
 * EntitlementSetting 은 groblePaymentUrl 이 필수라 기본값을 넣어 준다.
 * 결제는 이 러너의 범위 밖이므로 도달하지 않는 더미 주소를 쓴다.
 */
export async function seedEntitlementSettings(db, { premiumEnabled = false, analysisEnabled = true } = {}) {
  await db.entitlementSetting.upsert({
    where: { id: "singleton" },
    update: { premiumEnabled, analysisEnabled },
    create: {
      id: "singleton",
      premiumEnabled,
      analysisEnabled,
      groblePaymentUrl: "https://payments.invalid/checkout",
    },
  });
}

export async function seedUser(db, { premiumCredits = 0, email } = {}) {
  const id = randomUUID();
  await db.user.create({
    data: { id, email: email ?? `integration-${id}@example.invalid` },
  });
  await db.analysisEntitlement.create({
    data: { userId: id, premiumCreditsGranted: premiumCredits },
  });
  return id;
}

/**
 * 크레딧 락 직렬화를 관찰하려면 레이트리밋과 동시성 제한이 먼저 걸리면 안 된다.
 * 제한 자체를 검증하는 테스트에서는 이것을 쓰지 말고 실제 정책을 쓴다.
 */
export function unlimitedThroughputPolicy() {
  return {
    concurrencyLimit: 100_000,
    rateLimit: { route: "analysis", limit: 100_000, windowMs: 15 * 60 * 1000 },
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm test:integration -- seed`
Expected: PASS — 4개 테스트 통과.

- [ ] **Step 5: 커밋한다**

```bash
git add tests/integration/harness/seed.js tests/integration/harness/seed.test.js
git commit -m "test: add integration seed helpers for users and entitlements"
```

---

### Task 4: provider 시나리오 5종

**Files:**
- Create: `tests/integration/analyze-provider-scenarios.test.js`

**Interfaces:**
- Consumes: Task 1·2·3 전부
- Produces: `buildHandler`, `postAnalyze` — Task 5 가 같은 형태를 다시 정의해 쓰므로 공유하지 않는다 (파일 안에서만 쓴다)

체크리스트 3번이 요구하는 다섯 시나리오를 **진짜 DB 상태로** 검증한다. 실패 시 크레딧이 소모되지 않는 것(예약이 `CANCELLED`)이 핵심 판정이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/integration/analyze-provider-scenarios.test.js`:

```js
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAnalyzeHandler } from "../../api/analyze.js";
import { SUCCESS_REPORT_TEXT, installProviderFixture } from "./harness/provider-fixture.js";
import { seedEntitlementSettings, seedUser, unlimitedThroughputPolicy } from "./harness/seed.js";
import { createTestPrismaClient, prepareTestDatabase, resetTables } from "./harness/test-database.js";

function response() {
  return {
    body: undefined,
    statusCode: 200,
    json(payload) { this.body = payload; return this; },
    status(code) { this.statusCode = code; return this; },
  };
}

function request(userId, idempotencyKey) {
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

  beforeAll(async () => {
    await prepareTestDatabase();
    db = createTestPrismaClient();
    // API 키는 setup.js 가 이미 가짜 값으로 덮어썼다.
  }, 120_000);

  beforeEach(async () => {
    await resetTables(db);
    await seedEntitlementSettings(db);
    fixture = installProviderFixture();
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
      // 배경 작업을 즉시 await 해서 테스트가 결과를 관찰할 수 있게 한다.
      enqueueBackgroundWork: (work) => work(),
      getAnalysisThroughputPolicy: () => unlimitedThroughputPolicy(),
      requireUser: async () => ({ applicationUser: { id: userId, role: "user" } }),
    });
  }

  async function postAnalyze(userId, key = "scenario-key-0001") {
    const res = response();
    await buildHandler(userId)(request(userId, key), res);
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

  it("429: 폴백까지 시도한 뒤 실패하면 크레딧이 소모되지 않는다", async () => {
    fixture.respondWith({ status: 429 });
    const userId = await seedUser(db);

    await postAnalyze(userId);

    expect(fixture.calls.length).toBeGreaterThanOrEqual(1);
    expect(await reservationStatuses(userId)).toEqual(["CANCELLED"]);
  });

  it("429 뒤 성공: 재시도로 회복되면 크레딧이 한 번만 소모된다", async () => {
    fixture.respondWith([{ status: 429 }, { text: SUCCESS_REPORT_TEXT }]);
    const userId = await seedUser(db);

    await postAnalyze(userId);

    expect(fixture.calls.length).toBeGreaterThanOrEqual(2);
    expect(await reservationStatuses(userId)).toEqual(["CONSUMED"]);
  });

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

    const { getEntitlementSummary } = await import("../../lib/analysis-entitlements.js");
    const summary = await db.$transaction((tx) => getEntitlementSummary(tx, userId));
    expect(summary.freeRemaining).toBe(1);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test:integration -- analyze-provider-scenarios`
Expected: FAIL — 테스트 파일이 없거나, 있어도 하네스 연결이 안 되어 실패한다.

- [ ] **Step 3: 실패를 읽고 맞춘다**

이 태스크에는 새 제품 코드가 없다. 실패하면 **테스트의 기대값이 실제 동작과 다른 것이므로,
제품 코드를 고치지 말고 무엇이 실제로 일어나는지 확인한 뒤 기대값을 사실에 맞춘다.**

확인 순서:

1. 응답 상태 코드가 202 가 아니면 `res.body` 를 출력해 에러 코드를 본다.
2. 예약 상태가 비어 있으면 `enqueueBackgroundWork` 가 실제로 await 되는지 확인한다.
3. 호출 횟수가 예상과 다르면 `readAiModelSettings` 가 폴백 모델을 설정했는지 확인한다
   (`ai_model_settings` 의 `fallback_provider_key` 가 비어 있으면 폴백 호출이 없다).

**기대값을 사실에 맞추는 것은 허용되지만, 검증의 취지를 없애면 안 된다.**
"크레딧이 소모되지 않는다"는 판정은 어떤 경우에도 유지한다.

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm test:integration -- analyze-provider-scenarios`
Expected: PASS — 7개 테스트 통과.

- [ ] **Step 5: 커밋한다**

```bash
git add tests/integration/analyze-provider-scenarios.test.js
git commit -m "test: verify provider success, timeout, 429, 500 and parse failure against a real database"
```

---

### Task 5: 동시성과 중복 멱등키

**Files:**
- Create: `tests/integration/analyze-concurrency.test.js`

**Interfaces:**
- Consumes: Task 1·2·3 전부

체크리스트 4번의 핵심이다. **진짜 Postgres 이므로 `getLockedEntitlement` 의 `SELECT ... FOR UPDATE` 직렬화가 실제로 작동하며, 그것을 관찰하는 것이 이 러너의 존재 이유다.**

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/integration/analyze-concurrency.test.js`:

```js
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAnalyzeHandler } from "../../api/analyze.js";
import { SUCCESS_REPORT_TEXT, installProviderFixture } from "./harness/provider-fixture.js";
import { seedEntitlementSettings, seedUser, unlimitedThroughputPolicy } from "./harness/seed.js";
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

describe("동시 요청과 멱등키", () => {
  let db;
  let fixture;

  beforeAll(async () => {
    await prepareTestDatabase();
    db = createTestPrismaClient();
    // API 키는 setup.js 가 이미 가짜 값으로 덮어썼다.
  }, 120_000);

  beforeEach(async () => {
    await resetTables(db);
    await seedEntitlementSettings(db);
    fixture = installProviderFixture();
    fixture.respondWith({ text: SUCCESS_REPORT_TEXT });
  });

  afterEach(() => {
    fixture.restore();
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  function handlerFor(userId) {
    return createAnalyzeHandler({
      db,
      enqueueBackgroundWork: (work) => work(),
      getAnalysisThroughputPolicy: () => unlimitedThroughputPolicy(),
      requireUser: async () => ({ applicationUser: { id: userId, role: "user" } }),
    });
  }

  async function fire(userId, key) {
    const res = response();
    await handlerFor(userId)(request(key), res);
    return res;
  }

  async function countByStatus(userId) {
    const rows = await db.analysisReservation.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
  }

  it("무료 1건 사용자에게 동시 10건이 들어와도 크레딧은 정확히 한 번만 소모된다", async () => {
    const userId = await seedUser(db);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => fire(userId, `concurrent-key-${index}`)),
    );

    const accepted = results.filter((res) => res.statusCode === 202);
    expect(accepted).toHaveLength(1);

    const counts = await countByStatus(userId);
    expect(counts.CONSUMED ?? 0).toBe(1);
    expect(counts.PENDING ?? 0).toBe(0);
    expect(fixture.calls).toHaveLength(1);
  });

  it("같은 멱등키로 동시 요청해도 분석 요청은 하나만 생긴다", async () => {
    const userId = await seedUser(db, { premiumCredits: 0 });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => fire(userId, "same-idempotency-key")),
    );

    const requests = await db.analysisRequest.findMany({ where: { userId } });
    expect(requests).toHaveLength(1);
    expect(fixture.calls).toHaveLength(1);

    const ok = results.filter((res) => res.statusCode === 202 || res.statusCode === 200);
    expect(ok.length).toBeGreaterThanOrEqual(1);

    const counts = await countByStatus(userId);
    expect(counts.CONSUMED ?? 0).toBe(1);
  });

  it("프리미엄 크레딧 3개 사용자에게 동시 10건이 들어오면 4건만 통과한다", async () => {
    await seedEntitlementSettings(db, { premiumEnabled: true });
    const userId = await seedUser(db, { premiumCredits: 3 });

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => fire(userId, `premium-key-${index}`)),
    );

    // 무료 1 + 프리미엄 3 = 4
    expect(results.filter((res) => res.statusCode === 202)).toHaveLength(4);

    const counts = await countByStatus(userId);
    expect(counts.CONSUMED ?? 0).toBe(4);
    expect(counts.PENDING ?? 0).toBe(0);
    expect(fixture.calls).toHaveLength(4);
  });

  it("동시 요청 중 provider 가 전부 실패하면 크레딧이 하나도 소모되지 않는다", async () => {
    fixture.respondWith({ status: 500 });
    await seedEntitlementSettings(db, { premiumEnabled: true });
    const userId = await seedUser(db, { premiumCredits: 3 });

    await Promise.all(
      Array.from({ length: 4 }, (_, index) => fire(userId, `failing-key-${index}`)),
    );

    const counts = await countByStatus(userId);
    expect(counts.CONSUMED ?? 0).toBe(0);
    expect(counts.PENDING ?? 0).toBe(0);
    expect(counts.CANCELLED ?? 0).toBe(4);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test:integration -- analyze-concurrency`
Expected: FAIL — 테스트 파일이 없다.

- [ ] **Step 3: 실패를 읽고 맞춘다**

Task 4 와 같다. **제품 코드를 고치지 않는다.** 기대값이 실제와 다르면 무엇이 실제로 일어나는지
확인하고 사실에 맞춘다. 다만 다음 판정은 어떤 경우에도 유지한다:

- 크레딧은 **정확히 한 번만** 처리된다 (중복 소모 없음).
- 실패한 요청은 크레딧을 소모하지 않는다.
- `PENDING` 으로 남는 예약이 없다 (전부 CONSUMED 또는 CANCELLED 로 정리된다).

**이 판정 중 하나라도 깨진다면 그것은 테스트의 문제가 아니라 제품의 결함이다.**
그 경우 기대값을 낮추지 말고, 발견 내용을 `docs/security/2026-08-26-release-gate-checklist.md`
4번 항목에 기록하고 사용자에게 보고한다.

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm test:integration -- analyze-concurrency`
Expected: PASS — 4개 테스트 통과.

- [ ] **Step 5: 전체를 확인한다**

Run: `pnpm test:integration`
Expected: PASS — Task 1·2·3·4·5 의 모든 테스트.

Run: `pnpm exec vitest run`
Expected: PASS — **73파일 328테스트** (변화 없음).

- [ ] **Step 6: 커밋한다**

```bash
git add tests/integration/analyze-concurrency.test.js
git commit -m "test: verify credit accounting under concurrent and duplicate-key requests"
```

---

## 완료 후

체크리스트 3번의 완료 조건을 채웠는지 확인하고 문서를 갱신한다:

- 한 번의 명령(`pnpm test:integration`)으로 다섯 시나리오를 반복 실행할 수 있다.
- 실행해도 실제 provider 비용과 사용자 이용권이 소모되지 않는다.
- 동시 요청을 원하는 수만큼 발생시킬 수 있다.

`docs/security/2026-08-26-release-gate-checklist.md` 의 3번 항목 체크박스를 채우고,
4번 항목 중 이 러너로 이미 검증된 것(동시 10건, 같은 멱등키, provider 429/500/timeout,
예약 상태 개수, 크레딧 차감)을 함께 표시한다.
