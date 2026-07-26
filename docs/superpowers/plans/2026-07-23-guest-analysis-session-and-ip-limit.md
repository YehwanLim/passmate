# 게스트 분석 세션 및 IP 제한 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게스트 분석 중 남은 인증 세션의 자동 복원을 차단하고, 같은 공인 IP에서 성공한 게스트 분석은 1년 동안 1회만 허용한다.

**Architecture:** `AuthContext`는 게스트 분석 의도가 발생하면 이후에 도착하는 Supabase 세션을 무시하고 로컬 세션을 폐기한다. 서버는 게스트 요청의 신뢰할 수 있는 IP를 HMAC-SHA-256으로 변환해 PostgreSQL에 예약·확정하며, 분석 실패 시 예약을 해제한다. Vercel 함수와 Vite 개발 미들웨어는 같은 API 핸들러를 실행한다.

**Tech Stack:** React 19, TypeScript, Express-compatible Vercel functions, Vite, Prisma 7, PostgreSQL, Vitest, Node `crypto`

## Global Constraints

- 게스트 분석 시작 시점에 사용자 정보가 없으면 로컬 인증 세션을 폐기하고 이후 늦게 도착하는 세션도 비로그인으로 처리한다.
- Google 로그인 버튼을 명시적으로 누른 경우에만 게스트 잠금을 해제한다.
- 게스트 분석은 공인 IP별 성공 1회만 1년 동안 허용한다.
- 원문 IP는 DB·로그·응답에 저장하지 않는다. `GUEST_ANALYSIS_IP_HASH_SECRET`으로 계산한 64자리 HMAC-SHA-256만 저장한다.
- 게스트 예약은 15분 후 만료되고, AI 분석 오류 시 즉시 삭제한다. 성공 시 만료 시점은 성공 시점으로부터 1년이다.
- IP 식별 또는 HMAC 비밀키가 없으면 게스트 분석은 실패 닫힘 방식으로 거절한다.
- 서버가 검증한 Bearer 토큰 사용자는 게스트 IP 제한을 소비하지 않는다.
- 게스트 리포트의 첫인상 공개와 핵심 진단부터의 로그인 버튼은 그대로 유지한다.
- `GUEST_ANALYSIS_IP_HASH_SECRET`는 Vercel과 로컬 환경에 32바이트 이상의 무작위 값으로 설정한다.

---

### Task 1: 게스트 IP 예약 도메인과 스키마 추가

**Files:**
- Create: `lib/guest-analysis-limit.js`
- Create: `lib/guest-analysis-limit.test.js`
- Modify: `prisma/schema.prisma:41-137`
- Create: `prisma/migrations/20260723_add_guest_analysis_ip_limit/migration.sql`

**Interfaces:**
- Produces: `GuestAnalysisLimitError`, `getGuestClientIp(req)`, `reserveGuestAnalysis({ prisma, ipHash, now })`, `consumeGuestAnalysis({ prisma, reservationId, now })`, `releaseGuestAnalysis({ prisma, reservationId })`, `createGuestAnalysisIpHash(ip, secret)`.
- Consumes: Prisma `guestAnalysisUsage` delegate with `deleteMany`, `create`, `updateMany`.

- [ ] **Step 1: 예약·확정·해제의 실패 테스트를 작성한다.**

Create `lib/guest-analysis-limit.test.js`:

```js
import { describe, expect, it } from "vitest";
import {
  GuestAnalysisLimitError,
  consumeGuestAnalysis,
  createGuestAnalysisIpHash,
  getGuestClientIp,
  releaseGuestAnalysis,
  reserveGuestAnalysis,
} from "./guest-analysis-limit.js";

function createPrisma(records = []) {
  const rows = [...records];
  return {
    guestAnalysisUsage: {
      async deleteMany({ where }) {
        const before = rows.length;
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          const row = rows[index];
          if (row.ipHash === where.ipHash && row.expiresAt <= where.expiresAt.lte) rows.splice(index, 1);
          if (row.id === where.id && row.status === where.status) rows.splice(index, 1);
        }
        return { count: before - rows.length };
      },
      async create({ data }) {
        if (rows.some((row) => row.ipHash === data.ipHash)) {
          const error = new Error("duplicate");
          error.code = "P2002";
          throw error;
        }
        const row = { id: `usage-${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      },
      async updateMany({ where, data }) {
        const row = rows.find((candidate) => candidate.id === where.id && candidate.status === where.status && candidate.expiresAt > where.expiresAt.gt);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    rows,
  };
}

describe("guest analysis IP limit", () => {
  it("allows one reservation, consumes it for a year, and rejects a second request", async () => {
    const prisma = createPrisma();
    const now = new Date("2026-07-23T00:00:00.000Z");
    const reservation = await reserveGuestAnalysis({ prisma, ipHash: "a".repeat(64), now });

    await consumeGuestAnalysis({ prisma, reservationId: reservation.id, now });

    await expect(reserveGuestAnalysis({ prisma, ipHash: "a".repeat(64), now })).rejects.toBeInstanceOf(GuestAnalysisLimitError);
    expect(prisma.rows[0]).toMatchObject({ status: "CONSUMED", usedAt: now });
    expect(prisma.rows[0].expiresAt).toEqual(new Date("2027-07-23T00:00:00.000Z"));
  });

  it("releases a failed analysis reservation and clears an expired reservation before retrying", async () => {
    const now = new Date("2026-07-23T00:00:00.000Z");
    const prisma = createPrisma();
    const reservation = await reserveGuestAnalysis({ prisma, ipHash: "b".repeat(64), now });
    await releaseGuestAnalysis({ prisma, reservationId: reservation.id });
    await expect(reserveGuestAnalysis({ prisma, ipHash: "b".repeat(64), now })).resolves.toMatchObject({ status: "PENDING" });
  });

  it("uses Vercel's protected header, hashes without retaining the source IP, and falls back to a direct local connection", () => {
    expect(getGuestClientIp({ headers: { "x-vercel-forwarded-for": "203.0.113.10" }, socket: {} })).toBe("203.0.113.10");
    expect(getGuestClientIp({ headers: {}, socket: { remoteAddress: "::1" } })).toBe("::1");
    expect(createGuestAnalysisIpHash("203.0.113.10", "test-secret")).toHaveLength(64);
    expect(createGuestAnalysisIpHash("203.0.113.10", "test-secret")).not.toContain("203.0.113.10");
  });
});
```

- [ ] **Step 2: 테스트가 구현 부재로 실패하는지 확인한다.**

Run: `pnpm exec vitest run lib/guest-analysis-limit.test.js`

Expected: FAIL because `lib/guest-analysis-limit.js` does not exist.

- [ ] **Step 3: 최소 예약 도메인을 구현한다.**

Create `lib/guest-analysis-limit.js` with the following API. `PENDING` records expire after `15 * 60 * 1000`; `CONSUMED` records expire after `365 * 24 * 60 * 60 * 1000`.

```js
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const RESERVATION_TTL_MS = 15 * 60 * 1000;
const USAGE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export class GuestAnalysisLimitError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function firstHeaderValue(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.split(",")[0].trim() : "";
}

export function getGuestClientIp(req) {
  const forwardedIp = firstHeaderValue(req.headers?.["x-vercel-forwarded-for"]);
  if (isIP(forwardedIp)) return forwardedIp;
  const socketIp = req.socket?.remoteAddress?.trim();
  return isIP(socketIp) ? socketIp : null;
}

export function createGuestAnalysisIpHash(ip, secret) {
  if (!ip || !secret) throw new GuestAnalysisLimitError("GUEST_ANALYSIS_LIMIT_UNAVAILABLE", "게스트 분석 제한 설정을 확인할 수 없습니다.");
  return createHmac("sha256", secret).update(`guest-analysis-ip:v1:${ip}`).digest("hex");
}

export async function reserveGuestAnalysis({ prisma, ipHash, now = new Date() }) {
  await prisma.guestAnalysisUsage.deleteMany({ where: { ipHash, expiresAt: { lte: now } } });
  try {
    return await prisma.guestAnalysisUsage.create({ data: { ipHash, status: "PENDING", expiresAt: new Date(now.getTime() + RESERVATION_TTL_MS) } });
  } catch (error) {
    if (error?.code === "P2002") throw new GuestAnalysisLimitError("GUEST_ANALYSIS_LIMIT_REACHED", "이 네트워크에서는 1년에 한 번만 게스트 분석을 할 수 있어요. 로그인 후 전체 기능을 이용해 주세요.");
    throw error;
  }
}

export async function consumeGuestAnalysis({ prisma, reservationId, now = new Date() }) {
  const result = await prisma.guestAnalysisUsage.updateMany({
    where: { id: reservationId, status: "PENDING", expiresAt: { gt: now } },
    data: { status: "CONSUMED", usedAt: now, expiresAt: new Date(now.getTime() + USAGE_TTL_MS) },
  });
  if (result.count !== 1) throw new GuestAnalysisLimitError("GUEST_ANALYSIS_LIMIT_REACHED", "게스트 분석 예약이 만료되었습니다. 다시 시도해 주세요.");
}

export async function releaseGuestAnalysis({ prisma, reservationId }) {
  await prisma.guestAnalysisUsage.deleteMany({ where: { id: reservationId, status: "PENDING" } });
}
```

- [ ] **Step 4: Prisma 모델과 재실행 가능한 마이그레이션을 추가한다.**

Add this schema after `AnalysisReservation` in `prisma/schema.prisma`:

```prisma
enum GuestAnalysisUsageStatus {
  PENDING
  CONSUMED

  @@map("guest_analysis_usage_status")
}

model GuestAnalysisUsage {
  id        String                   @id @default(uuid()) @db.Uuid
  ipHash    String                   @unique @map("ip_hash") @db.Char(64)
  status    GuestAnalysisUsageStatus @default(PENDING)
  usedAt    DateTime?                @map("used_at") @db.Timestamptz
  expiresAt DateTime                 @map("expires_at") @db.Timestamptz
  createdAt DateTime                 @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime                 @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@index([expiresAt])
  @@map("guest_analysis_usages")
}
```

Create `prisma/migrations/20260723_add_guest_analysis_ip_limit/migration.sql`:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'guest_analysis_usage_status') THEN
    CREATE TYPE guest_analysis_usage_status AS ENUM ('PENDING', 'CONSUMED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS guest_analysis_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash CHAR(64) NOT NULL UNIQUE,
  status guest_analysis_usage_status NOT NULL DEFAULT 'PENDING',
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_analysis_usages_expires_at
  ON guest_analysis_usages (expires_at);
```

- [ ] **Step 5: 테스트가 통과하고 Prisma 클라이언트가 새 모델을 생성하는지 확인한다.**

Run: `pnpm exec vitest run lib/guest-analysis-limit.test.js && pnpm exec prisma generate`

Expected: three passing tests and a successful Prisma Client generation.

- [ ] **Step 6: 이 작업만 커밋한다.**

```bash
git add lib/guest-analysis-limit.js lib/guest-analysis-limit.test.js prisma/schema.prisma prisma/migrations/20260723_add_guest_analysis_ip_limit/migration.sql
git commit -m "feat: add guest analysis IP limit"
```

### Task 2: 분석 API에서 검증된 사용자와 게스트 예약을 구분

**Files:**
- Modify: `api/analyze.js:1-500`
- Modify: `vite.config.ts:501-535`
- Create: `tests/api/analyze-guest-limit.test.js`

**Interfaces:**
- Consumes: `requireAuthenticatedUser(req)`, Prisma singleton, Task 1 reservation functions.
- Produces: unauthenticated duplicate requests return `429 { error: "GUEST_ANALYSIS_LIMIT_REACHED" }`; authenticated requests do not call guest limiter functions.

- [ ] **Step 1: API 경계의 실패 테스트를 작성한다.**

Create `tests/api/analyze-guest-limit.test.js` with hoisted mocks for `../../lib/auth.js`, `../../lib/prisma.js`, and `../../lib/guest-analysis-limit.js`. Import the named `handleAnalyzeRequest` from `../../api/analyze.js` and test the injected `analyze` function:

```js
it("rejects a second guest request before invoking the AI model", async () => {
  mocks.requireAuthenticatedUser.mockResolvedValue(null);
  mocks.reserveGuestAnalysis.mockRejectedValue(new GuestAnalysisLimitError("GUEST_ANALYSIS_LIMIT_REACHED", "limit"));
  const analyze = vi.fn();
  const response = createResponse();

  await handleAnalyzeRequest(validGuestRequest(), response, { analyze });

  expect(response.statusCode).toBe(429);
  expect(response.body).toEqual({ error: "GUEST_ANALYSIS_LIMIT_REACHED", message: "limit" });
  expect(analyze).not.toHaveBeenCalled();
});

it("fails closed with 503 when guest IP limiting cannot be applied", async () => {
  mocks.requireAuthenticatedUser.mockResolvedValue(null);
  mocks.createGuestAnalysisIpHash.mockImplementation(() => {
    throw new GuestAnalysisLimitError("GUEST_ANALYSIS_LIMIT_UNAVAILABLE", "configuration missing");
  });
  const response = createResponse();

  await handleAnalyzeRequest(validGuestRequest(), response, { analyze: vi.fn() });

  expect(response.statusCode).toBe(503);
  expect(response.body).toEqual({ error: "GUEST_ANALYSIS_LIMIT_UNAVAILABLE", message: "configuration missing" });
});

it("consumes a successful guest reservation and releases it when analysis fails", async () => {
  mocks.requireAuthenticatedUser.mockResolvedValue(null);
  mocks.reserveGuestAnalysis.mockResolvedValue({ id: "reservation-1" });
  await handleAnalyzeRequest(validGuestRequest(), createResponse(), { analyze: vi.fn().mockResolvedValue({ questionTabs: [{}] }) });
  expect(mocks.consumeGuestAnalysis).toHaveBeenCalledWith(expect.objectContaining({ reservationId: "reservation-1" }));

  mocks.consumeGuestAnalysis.mockClear();
  mocks.releaseGuestAnalysis.mockClear();
  await handleAnalyzeRequest(validGuestRequest(), createResponse(), { analyze: vi.fn().mockRejectedValue(new Error("provider down")) });
  expect(mocks.releaseGuestAnalysis).toHaveBeenCalledWith(expect.objectContaining({ reservationId: "reservation-1" }));
});

it("skips guest IP reservation for a server-verified authenticated request", async () => {
  mocks.requireAuthenticatedUser.mockResolvedValue({ id: "verified-user" });
  const response = createResponse();
  await handleAnalyzeRequest(validGuestRequest({ authorization: "Bearer verified" }), response, { analyze: vi.fn().mockResolvedValue({ questionTabs: [{}] }) });
  expect(response.statusCode).toBe(200);
  expect(mocks.reserveGuestAnalysis).not.toHaveBeenCalled();
});
```

`validGuestRequest` must supply a `POST` request, valid 200-character `questions`, a `headers` object containing `x-vercel-forwarded-for`, and a socket. `createResponse` must implement `setHeader`, `status`, `json`, and `end`.

- [ ] **Step 2: 테스트가 새 핸들러 export 부재로 실패하는지 확인한다.**

Run: `pnpm exec vitest run tests/api/analyze-guest-limit.test.js`

Expected: FAIL because `handleAnalyzeRequest` is not exported.

- [ ] **Step 3: API 핸들러를 예약 수명과 연결한다.**

In `api/analyze.js`, import `prisma`, `requireAuthenticatedUser`, and Task 1 functions. Export `handleAnalyzeRequest(req, res, { analyze = analyzeCoverLetter } = {})`. Keep all current payload sanitization and validation. After validation:

```js
const authenticatedUser = await requireAuthenticatedUser(req);
let reservation = null;

try {
  if (!authenticatedUser) {
    const clientIp = getGuestClientIp(req);
    const ipHash = createGuestAnalysisIpHash(clientIp, process.env.GUEST_ANALYSIS_IP_HASH_SECRET);
    reservation = await reserveGuestAnalysis({ prisma, ipHash });
  }

  const result = await analyze(input);
  if (result.error === "CONTEXT_IRRELEVANT") {
    if (reservation) await releaseGuestAnalysis({ prisma, reservationId: reservation.id });
    return res.status(400).json(result);
  }
  if (result.error === "RATE_LIMIT") {
    if (reservation) await releaseGuestAnalysis({ prisma, reservationId: reservation.id });
    return res.status(429).json(result);
  }
  if (reservation) await consumeGuestAnalysis({ prisma, reservationId: reservation.id });
  return res.status(200).json(result);
} catch (error) {
  if (reservation) await releaseGuestAnalysis({ prisma, reservationId: reservation.id });
  if (error instanceof GuestAnalysisLimitError) {
    const status = error.code === "GUEST_ANALYSIS_LIMIT_REACHED" ? 429 : 503;
    return res.status(status).json({ error: error.code, message: error.message });
  }
  const errorResponse = getAnalyzeApiErrorResponse(error);
  return res.status(errorResponse.status).json(errorResponse.body);
}
```

Keep the default export as the CORS/method wrapper and delegate its `POST` branch to `handleAnalyzeRequest`. Include `Authorization` in `Access-Control-Allow-Headers`.

Replace Vite's bespoke call to `server/api/analyze` with an adapter that parses the request body once and delegates to the default `api/analyze.js` handler:

```ts
const { default: analyzeHandler } = await import("./api/analyze.js");
const adaptedResponse = {
  setHeader: (name: string, value: string) => res.setHeader(name, value),
  status(code: number) { res.statusCode = code; return this; },
  json(payload: unknown) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(payload)); return this; },
  end() { res.end(); return this; },
};
(req as typeof req & { body?: unknown }).body = JSON.parse(body);
await analyzeHandler(req, adaptedResponse);
```

Allow the middleware to pass both `POST` and `OPTIONS` requests to this adapter, while all other methods continue to `next()`.

- [ ] **Step 4: API 테스트가 통과하는지 확인한다.**

Run: `pnpm exec vitest run tests/api/analyze-error.test.js tests/api/analyze-guest-limit.test.js`

Expected: all analysis API tests pass; duplicate guest calls never invoke the injected AI function.

- [ ] **Step 5: 이 작업만 커밋한다.**

```bash
git add api/analyze.js vite.config.ts tests/api/analyze-guest-limit.test.js
git commit -m "feat: enforce guest analysis IP limit"
```

### Task 3: 게스트 인증 잠금과 검증 토큰 전송

**Files:**
- Create: `client/src/contexts/authSessionPolicy.ts`
- Create: `client/src/contexts/authSessionPolicy.test.ts`
- Modify: `client/src/contexts/AuthContext.tsx:1-170`
- Modify: `client/src/types/auth.ts:18-29`
- Modify: `client/src/pages/Analyze.tsx:1-780`
- Modify: `client/src/pages/analyzeErrorMessage.test.ts`

**Interfaces:**
- Produces: `resolveAuthSession(session, isGuestSessionLocked)`, `lockGuestSession(): Promise<void>` on `AuthState`.
- Consumes: `supabase.auth.signOut({ scope: "local" })` and `supabase.auth.getSession()`.

- [ ] **Step 1: 지연 세션 차단의 실패 테스트를 작성한다.**

Create `client/src/contexts/authSessionPolicy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveAuthSession } from "./authSessionPolicy";

describe("guest session policy", () => {
  it("discards a late Supabase session after a guest analysis has locked auth", () => {
    const session = { user: { id: "previous-user" } } as never;
    expect(resolveAuthSession(session, true)).toBeNull();
    expect(resolveAuthSession(session, false)).toBe(session);
  });
});
```

Append this test to `client/src/pages/analyzeErrorMessage.test.ts`:

```ts
it("locks an unauthenticated analysis before sending it and forwards a verified session token", () => {
  expect(analyzeSource).toContain("await lockGuestSession()");
  expect(analyzeSource).toContain("supabase.auth.getSession()");
  expect(analyzeSource).toContain("Authorization: `Bearer ${session.access_token}`");
});
```

- [ ] **Step 2: 테스트가 정책 모듈 부재로 실패하는지 확인한다.**

Run: `pnpm exec vitest run client/src/contexts/authSessionPolicy.test.ts client/src/pages/analyzeErrorMessage.test.ts`

Expected: FAIL because `authSessionPolicy.ts` does not exist.

- [ ] **Step 3: 인증 잠금 정책과 분석 요청 헤더를 최소 구현한다.**

Create `client/src/contexts/authSessionPolicy.ts`:

```ts
import type { Session } from "@supabase/supabase-js";

export function resolveAuthSession(session: Session | null, isGuestSessionLocked: boolean) {
  return isGuestSessionLocked ? null : session;
}
```

In `AuthContext.tsx`, add a `useRef(false)` guest lock. Pass every session from `onAuthStateChange` and `getSession()` through `resolveAuthSession`. If a non-null session is discarded, trigger `supabase.auth.signOut({ scope: "local" })` without awaiting it in the event callback. Add:

```ts
const lockGuestSession = useCallback(async () => {
  guestSessionLockedRef.current = true;
  setUser(null);
  setIsLoading(false);
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.warn("[AuthContext] 게스트 세션 정리 실패:", error.message);
}, []);
```

Set `guestSessionLockedRef.current = false` as the first line of `signInWithGoogle`, and also before the normal `signOut` request. Add `lockGuestSession` to the provider value and this field to `AuthState`:

```ts
/** 게스트 분석 중 늦게 도착하는 저장 세션을 차단한다. */
lockGuestSession: () => Promise<void>;
```

In `Analyze.tsx`, import `supabase`, destructure `lockGuestSession`, and make `executeSubmit` begin with:

```ts
if (!user) await lockGuestSession();
```

Immediately before the `/api/analyze` fetch, read the current token and add it only when available:

```ts
const { data: { session } } = await supabase.auth.getSession();
const headers: Record<string, string> = { "Content-Type": "application/json" };
if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
```

Use `headers` in the existing fetch. Do not alter the existing `user?.id && user.email` persistence guard.

- [ ] **Step 4: 게스트 잠금과 분석 헤더 테스트가 통과하는지 확인한다.**

Run: `pnpm exec vitest run client/src/contexts/authSessionPolicy.test.ts client/src/pages/analyzeErrorMessage.test.ts`

Expected: both files pass, including late-session rejection and the pre-request guest lock assertion.

- [ ] **Step 5: 이 작업만 커밋한다.**

```bash
git add client/src/contexts/authSessionPolicy.ts client/src/contexts/authSessionPolicy.test.ts client/src/contexts/AuthContext.tsx client/src/types/auth.ts client/src/pages/Analyze.tsx client/src/pages/analyzeErrorMessage.test.ts
git commit -m "fix: lock auth during guest analysis"
```

### Task 4: 운영 설정·개인정보 고지·리포트 게이트 검증

**Files:**
- Modify: `.env.example:1-8`
- Modify: `client/src/pages/Privacy.tsx:15-90`
- Modify: `client/src/utils/reportAccess.test.ts`

**Interfaces:**
- Consumes: `GUEST_ANALYSIS_IP_HASH_SECRET` from deployment and local environment.
- Produces: documented 1-year HMAC IP usage policy and a regression assertion for the existing mid-report login gate.

- [ ] **Step 1: 고지와 게이트의 실패 테스트를 작성한다.**

Append to `client/src/utils/reportAccess.test.ts`:

```ts
it("locks the core diagnosis immediately after the public first-impression sections", () => {
  expect(PUBLIC_REPORT_SECTION_COUNT).toBe(2);
  expect(isReportSectionLocked({ sectionIndex: 2, isAuthenticated: false })).toBe(true);
});
```

Add a source-inspection test in a new `client/src/pages/privacyGuestLimit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Privacy.tsx", import.meta.url), "utf8");

describe("guest IP usage privacy notice", () => {
  it("discloses the HMAC usage record, fraud-prevention purpose, and one-year retention", () => {
    expect(source).toContain("해시된 IP 이용 이력");
    expect(source).toContain("부정 이용 방지");
    expect(source).toContain("최대 1년");
  });
});
```

- [ ] **Step 2: 테스트가 개인정보 고지 부재로 실패하는지 확인한다.**

Run: `pnpm exec vitest run client/src/utils/reportAccess.test.ts client/src/pages/privacyGuestLimit.test.ts`

Expected: FAIL because `Privacy.tsx` does not yet name the hashed IP usage record.

- [ ] **Step 3: 배포 설정과 개인정보 고지를 추가한다.**

Prepend this to `.env.example` without a real value:

```dotenv
# Required server-only HMAC key for one guest analysis per public IP per year.
# Generate once with: openssl rand -hex 32
GUEST_ANALYSIS_IP_HASH_SECRET=<at-least-32-byte-random-secret>

```

In `Privacy.tsx`, add `해시된 IP 이용 이력` to the service-generated information list, add `게스트 분석의 중복·부정 이용 방지` to the purpose list, and add this row to the retention table:

```ts
["해시된 IP 이용 이력", "최대 1년"],
```

- [ ] **Step 4: 개인정보 고지와 리포트 게이트 회귀 테스트가 통과하는지 확인한다.**

Run: `pnpm exec vitest run client/src/utils/reportAccess.test.ts client/src/pages/privacyGuestLimit.test.ts`

Expected: both files pass and section index `2` remains the first guest-locked report section.

- [ ] **Step 5: 이 작업만 커밋한다.**

```bash
git add .env.example client/src/pages/Privacy.tsx client/src/pages/privacyGuestLimit.test.ts client/src/utils/reportAccess.test.ts
git commit -m "docs: disclose guest analysis IP limit"
```

### Task 5: 통합 검증과 배포 전 설정 확인

**Files:**
- Verify only: all files above

- [ ] **Step 1: 관련 전체 테스트를 실행한다.**

Run:

```bash
pnpm exec vitest run lib/guest-analysis-limit.test.js tests/api/analyze-error.test.js tests/api/analyze-guest-limit.test.js client/src/contexts/authSessionPolicy.test.ts client/src/pages/analyzeErrorMessage.test.ts client/src/utils/reportAccess.test.ts client/src/pages/privacyGuestLimit.test.ts
```

Expected: every listed test passes.

- [ ] **Step 2: 타입 검사와 프로덕션 빌드를 실행한다.**

Run: `pnpm check && pnpm build`

Expected: both commands exit with status `0` after the local `.env` includes `GUEST_ANALYSIS_IP_HASH_SECRET`.

- [ ] **Step 3: 배포 환경의 필수 비밀키를 확인한다.**

Confirm that Vercel Production and Preview have the same stable `GUEST_ANALYSIS_IP_HASH_SECRET` value generated with `openssl rand -hex 32`. Do not rotate this value during ordinary deployments because a new key intentionally cannot match existing one-year HMAC records.

- [ ] **Step 4: 최종 변경을 확인한다.**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only this plan's intended changes remain in the working tree.
