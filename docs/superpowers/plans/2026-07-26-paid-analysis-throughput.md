# 결제 이용권 분석 처리량 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무료 사용자는 15분 3회·동시 1개, 활성화된 결제 이용권이 남은 사용자는 15분 10회·동시 2개의 분석을 서버에서 원자적으로 적용한다.

**Architecture:** 이용권 요약은 서버 트랜잭션에서 사용자별 entitlement 행을 잠근 뒤 계산한다. 같은 잠금 안에서 처리량 정책 선택, 미완료 요청 수 확인, shared Postgres rate-limit bucket 증가, 이용권 예약, 분석 생성 순서를 실행한다. idempotent 재전송은 이 흐름보다 먼저 반환되어 quota·이용권·동시성 자리를 소비하지 않는다.

**Tech Stack:** Node.js ESM, Vercel serverless functions, Prisma/Postgres, Vitest, React/TypeScript.

## Global Constraints

- `premiumEnabled=false`인 베타에서는 모든 사용자가 무료 정책을 사용한다.
- 결제 CTA, 구매 의도 변경, Groble 웹훅, 실제 과금은 수정하거나 활성화하지 않는다.
- 정책·이용권·동시성은 인증된 사용자 ID와 서버 DB로만 판정한다. 브라우저 입력은 사용하지 않는다.
- 무료 정책은 15분 3회·동시 1개, 결제 이용권 보유 정책은 15분 10회·동시 2개다.
- idempotency 재전송, 실패·취소 예약 처리, kill switch, RLS와 객체 소유권 계약을 유지한다.
- 오류 응답에는 allowlist된 오류 코드와 request ID만 넣는다. 이용권 수·원문·공급자 오류를 노출하거나 로그에 남기지 않는다.
- Prisma schema migration은 추가하지 않는다.

---

## 파일 구조

- `lib/rate-limit.js`: 무료/결제 분석 처리량 상수와 서버 전용 정책 선택 함수.
- `lib/rate-limit.test.js`: 3회와 10회 fixed-window bucket, 정책 선택 단위 테스트.
- `lib/analysis-entitlements.js`: 활성 설정·예약 사용량으로 무료/결제 잔여 이용권을 계산하고, 예약 source를 서버에서 선택.
- `lib/analysis-entitlements.test.js`: 베타 fail-closed, 활성 결제 이용권 잔여 계산·예약 source 테스트.
- `api/analyze.js`: entitlement 행 잠금이 유지되는 트랜잭션에서 동시성·rate-limit·예약·생성을 수행하고 안전한 오류를 매핑.
- `tests/api/analyze-atomic.test.js`: 무료/결제 동시성, rate-limit 정책, idempotent bypass, 모델 미호출 회귀 테스트.
- `client/src/pages/Analyze.tsx`: allowlist된 동시성 오류를 사용자 안내로 변환.
- `client/src/pages/analyzeErrorMessage.test.ts`: 동시성 오류 제목·본문 회귀 테스트.
- `docs/security/2026-07-26-staging-go-no-go-security-audit.md`: 구현 및 스테이징 검증 후 처리량 정책 증적·제한사항 갱신.

## 인터페이스

`lib/rate-limit.js`가 제공한다.

```js
export const ANALYSIS_THROUGHPUT = Object.freeze({
  free: Object.freeze({
    concurrencyLimit: 1,
    rateLimit: Object.freeze({ route: "analysis", limit: 3, windowMs: 15 * 60 * 1000 }),
  }),
  premium: Object.freeze({
    concurrencyLimit: 2,
    rateLimit: Object.freeze({ route: "analysis", limit: 10, windowMs: 15 * 60 * 1000 }),
  }),
});

export function getAnalysisThroughputPolicy(summary) {
  return summary?.premiumEnabled === true && summary.premiumRemaining > 0
    ? ANALYSIS_THROUGHPUT.premium
    : ANALYSIS_THROUGHPUT.free;
}
```

`lib/analysis-entitlements.js`의 `getEntitlementSummary(tx, userId)`는 다음 shape을 반환한다.

```js
{
  premiumEnabled: boolean,
  freeRemaining: number,
  premiumRemaining: number,
  remaining: number,
}
```

`api/analyze.js` 내부 allocation 결과는 다음 세 타입 중 하나다.

```js
{ type: "stored", analysisId, analysisRequestId, projectId, status }
{ type: "rate_limited", rate: { retryAfterSeconds: number } }
{ type: "new", analysis, analysisRequest, project, reservation }
```

동시성 한도 초과에는 `AnalysisConcurrencyLimitError`를 던지고 API 경계에서 `409 ANALYSIS_CONCURRENCY_LIMITED`로 바꾼다.

## Task 1: 서버 이용권 요약과 처리량 정책을 준비한다

**Files:**
- Modify: `lib/rate-limit.js:1-61`
- Modify: `lib/rate-limit.test.js:1-104`
- Modify: `lib/analysis-entitlements.js:1-106`
- Modify: `lib/analysis-entitlements.test.js:1-140`

**Consumes:** 기존 `ApiRateLimitBucket` compound upsert와 `AnalysisReservation` 상태 `PENDING`·`CONSUMED`.

**Produces:** `ANALYSIS_THROUGHPUT`, `getAnalysisThroughputPolicy(summary)`, 활성 설정을 반영한 entitlement summary, `PREMIUM` 또는 `FREE` source 예약.

- [ ] **Step 1: 처리량 정책 선택 실패 테스트를 작성한다.**

`lib/rate-limit.test.js`에 다음 테스트를 추가한다.

```js
it("selects the premium throughput only for an enabled setting with remaining premium credits", async () => {
  const rateLimit = await import("./rate-limit.js");

  expect(rateLimit.getAnalysisThroughputPolicy({ premiumEnabled: false, premiumRemaining: 9 }))
    .toBe(rateLimit.ANALYSIS_THROUGHPUT.free);
  expect(rateLimit.getAnalysisThroughputPolicy({ premiumEnabled: true, premiumRemaining: 0 }))
    .toBe(rateLimit.ANALYSIS_THROUGHPUT.free);
  expect(rateLimit.getAnalysisThroughputPolicy({ premiumEnabled: true, premiumRemaining: 1 }))
    .toBe(rateLimit.ANALYSIS_THROUGHPUT.premium);
});

it("allows ten premium analysis starts in one 15-minute bucket then limits the eleventh", async () => {
  const { db } = createMemoryDatabase();
  const rateLimit = await import("./rate-limit.js");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await expect(rateLimit.consumeUserRateLimit(db, {
      userId: USER_ID,
      policy: rateLimit.ANALYSIS_THROUGHPUT.premium.rateLimit,
      now: NOW,
    })).resolves.toMatchObject({ allowed: true, limit: 10 });
  }
  await expect(rateLimit.consumeUserRateLimit(db, {
    userId: USER_ID,
    policy: rateLimit.ANALYSIS_THROUGHPUT.premium.rateLimit,
    now: NOW,
  })).resolves.toMatchObject({ allowed: false, code: "RATE_LIMITED", limit: 10 });
});
```

`lib/analysis-entitlements.test.js`의 in-memory DB에 `entitlementSetting.findUnique`를 추가하고, 다음 테스트를 추가한다.

```js
it("uses remaining premium credits only when premium is explicitly enabled", async () => {
  const { db, state } = createMemoryDatabase({ premiumEnabled: true });
  state.entitlements.set(USER_ID, {
    id: `entitlement-${USER_ID}`,
    premiumCreditsGranted: 2,
    userId: USER_ID,
  });
  const firstFree = await reserveAnalysis(db, USER_ID);
  await finalizeAnalysisReservation(db, firstFree.reservationId, USER_ID);

  await expect(reserveAnalysis(db, USER_ID)).resolves.toMatchObject({ source: "premium" });
  await expect(getEntitlementSummary(db, USER_ID)).resolves.toMatchObject({
    premiumEnabled: true,
    premiumRemaining: 1,
    remaining: 1,
  });
});
```

- [ ] **Step 2: 새 테스트가 의도대로 실패하는지 확인한다.**

Run: `pnpm vitest run lib/rate-limit.test.js lib/analysis-entitlements.test.js`

Expected: `getAnalysisThroughputPolicy is not a function`과 활성 결제 잔여/`premium` reservation 기대 실패.

- [ ] **Step 3: 최소 서버 구현을 작성한다.**

`lib/rate-limit.js`에서 기존 `USER_RATE_LIMITS.analysis`의 값은 무료 rate-limit을 가리키게 유지하고, 다음을 추가한다.

```js
export const ANALYSIS_THROUGHPUT = Object.freeze({
  free: Object.freeze({
    concurrencyLimit: 1,
    rateLimit: USER_RATE_LIMITS.analysis,
  }),
  premium: Object.freeze({
    concurrencyLimit: 2,
    rateLimit: Object.freeze({ route: "analysis", limit: 10, windowMs: 15 * 60 * 1000 }),
  }),
});

export function getAnalysisThroughputPolicy(summary) {
  return summary?.premiumEnabled === true && Number(summary.premiumRemaining) > 0
    ? ANALYSIS_THROUGHPUT.premium
    : ANALYSIS_THROUGHPUT.free;
}
```

`lib/analysis-entitlements.js`에서 `getSummaryForEntitlement`가 `tx.entitlementSetting.findUnique({ where: { id: "singleton" }, select: { premiumEnabled: true } })`를 읽게 한다. `premiumEnabled !== true`이면 premium remaining은 반드시 `0`으로 둔다. 활성화된 경우에는 `premiumCreditsGranted - getUsage(tx, userId, "PREMIUM")`을 0 이상으로 계산한다. `reserveAnalysis`는 free remaining이 있으면 `FREE`, 없고 premium remaining이 있으면 `PREMIUM`, 둘 다 없으면 `EntitlementUnavailableError`를 던지게 한다.

- [ ] **Step 4: 단위 테스트가 통과하는지 확인한다.**

Run: `pnpm vitest run lib/rate-limit.test.js lib/analysis-entitlements.test.js`

Expected: 모든 테스트 통과. beta fixture는 `premiumEnabled: false`, `premiumRemaining: 0`을 계속 검증한다.

- [ ] **Step 5: Task 1만 커밋한다.**

```bash
git add lib/rate-limit.js lib/rate-limit.test.js lib/analysis-entitlements.js lib/analysis-entitlements.test.js
git commit -m "feat: add entitlement-aware analysis throughput policies"
```

## Task 2: 분석 접수를 원자적으로 제한한다

**Files:**
- Modify: `api/analyze.js:1-520`
- Modify: `tests/api/analyze-atomic.test.js:1-620`

**Consumes:** Task 1의 `getAnalysisThroughputPolicy`, `ANALYSIS_THROUGHPUT`, 활성 entitlement summary.

**Produces:** 사용자별 잠금 아래의 동시성 제한, 10회 premium policy 선택, `ANALYSIS_CONCURRENCY_LIMITED` API 계약.

- [ ] **Step 1: API 실패 테스트를 작성한다.**

`tests/api/analyze-atomic.test.js`의 `createDatabase`에 `analysisRequest.count` mock을 넣고, handler dependency로 `getEntitlementSummary`와 `getAnalysisThroughputPolicy`를 주입할 수 있게 기대하는 테스트를 추가한다.

같은 파일에 `createSerializedDatabase` test helper를 추가한다. helper의 `$transaction`은 Promise tail mutex로 하나씩만 work를 실행하고, `analysisRequest.create`는 `state.activeRequests`에 새 요청을 넣으며, `analysisRequest.count`는 `state.activeRequests` 중 `PENDING`·`CALLING`·`PERSISTENCE_PENDING` 수를 반환한다. 이 helper는 실제 entitlement row lock처럼 같은 사용자 allocation이 직렬화되는지 확인하는 테스트 전용 구현이다.

```js
it("rejects a second distinct free analysis without consuming a rate slot or calling the model", async () => {
  const db = createDatabase();
  db.analysisRequest.count = vi.fn(async () => 1);
  const consumeRateLimit = vi.fn(rateAllowed);
  const reserveAnalysis = vi.fn(async () => ({ reservationId: "reservation-1" }));
  const handler = createAnalyzeHandler({
    db,
    model: vi.fn(),
    requireUser: activeUser,
    consumeRateLimit,
    reserveAnalysis,
    getEntitlementSummary: async () => ({ premiumEnabled: false, premiumRemaining: 0 }),
  });
  const res = response();

  await handler(request({ headers: { "idempotency-key": "second-free-request-key-1234" } }), res);

  expect(res.statusCode).toBe(409);
  expect(res.body.error).toBe("ANALYSIS_CONCURRENCY_LIMITED");
  expect(consumeRateLimit).not.toHaveBeenCalled();
  expect(reserveAnalysis).not.toHaveBeenCalled();
});

it("allows a second premium analysis but rejects a third", async () => {
  const premiumSummary = { premiumEnabled: true, premiumRemaining: 2 };
  const allowedDb = createDatabase();
  allowedDb.analysisRequest.count = vi.fn(async () => 1);
  const allowedHandler = createAnalyzeHandler({
    db: allowedDb,
    enqueueBackgroundWork: () => undefined,
    requireUser: activeUser,
    reserveAnalysis: async () => ({ reservationId: "reservation-1" }),
    getEntitlementSummary: async () => premiumSummary,
  });
  const allowedRes = response();
  await allowedHandler(request(), allowedRes);
  expect(allowedRes.statusCode).toBe(202);

  const limitedDb = createDatabase();
  limitedDb.analysisRequest.count = vi.fn(async () => 2);
  const limitedHandler = createAnalyzeHandler({
    db: limitedDb,
    requireUser: activeUser,
    getEntitlementSummary: async () => premiumSummary,
  });
  const limitedRes = response();
  await limitedHandler(request(), limitedRes);
  expect(limitedRes.body.error).toBe("ANALYSIS_CONCURRENCY_LIMITED");
});

it("uses the ten-start premium policy for a user with remaining premium credits", async () => {
  const consumeRateLimit = vi.fn(rateAllowed);
  const handler = createAnalyzeHandler({
    db: createDatabase(),
    enqueueBackgroundWork: () => undefined,
    requireUser: activeUser,
    reserveAnalysis: async () => ({ reservationId: "reservation-1" }),
    consumeRateLimit,
    getEntitlementSummary: async () => ({ premiumEnabled: true, premiumRemaining: 1 }),
  });
  await handler(request(), response());
  expect(consumeRateLimit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    policy: expect.objectContaining({ limit: 10, route: "analysis" }),
  }));
});

it("serializes two simultaneous free requests so exactly one is accepted", async () => {
  const db = createSerializedDatabase();
  let nextReservation = 1;
  const handler = createAnalyzeHandler({
    db,
    enqueueBackgroundWork: () => undefined,
    requireUser: activeUser,
    reserveAnalysis: async () => ({ reservationId: `reservation-${nextReservation++}` }),
    getEntitlementSummary: async () => ({ premiumEnabled: false, premiumRemaining: 0 }),
  });
  const first = response();
  const second = response();

  await Promise.all([
    handler(request({ headers: { "idempotency-key": "concurrent-free-request-0001" } }), first),
    handler(request({ headers: { "idempotency-key": "concurrent-free-request-0002" } }), second),
  ]);

  expect([first.statusCode, second.statusCode].sort()).toEqual([202, 409]);
  expect(db.state.activeRequests).toHaveLength(1);
});
```

- [ ] **Step 2: 새 API 테스트가 실패하는지 확인한다.**

Run: `pnpm vitest run tests/api/analyze-atomic.test.js`

Expected: free 동시성 요청이 202이거나 summary injection이 무시되어 새 기대가 실패한다.

- [ ] **Step 3: 원자적 allocation을 구현한다.**

`api/analyze.js`에서 `getEntitlementSummary`와 `getAnalysisThroughputPolicy`를 import하고 handler dependency defaults로 추가한다. `allocateAnalysisRequest`에 이 dependency들과 `consumeRateLimit`을 전달한다. `db.$transaction` 안에서 아래 순서를 유지한다.

```js
const summary = await getEntitlementSummary(tx, userId); // entitlement row lock
const policy = getAnalysisThroughputPolicy(summary);
const activeCount = await tx.analysisRequest.count({
  where: {
    userId,
    status: { in: ["PENDING", "CALLING", "PERSISTENCE_PENDING"] },
  },
});
if (activeCount >= policy.concurrencyLimit) {
  throw new AnalysisConcurrencyLimitError();
}

const rate = await consumeRateLimit(tx, { userId, policy: policy.rateLimit });
if (!rate.allowed) return { type: "rate_limited", rate };

const reservation = await reserve(tx, userId);
```

`AnalysisConcurrencyLimitError`는 `code = "ANALYSIS_CONCURRENCY_LIMITED"`만 가진 error class로 만들고, handler catch에서 `new ApiError(error.code, 409)`로 매핑한다. allocation 결과가 `rate_limited`면 `Retry-After`를 set하고 `429 RATE_LIMITED`를 반환한다. 기존 handler의 트랜잭션 밖 `consumeRateLimit` 호출은 제거한다. kill switch는 allocation 이전에 유지한다.

`createDatabase` fixture에는 기본 `analysisRequest.count: vi.fn(async () => 0)`을 추가해 기존 테스트가 모두 명시적으로 빈 자리를 갖게 한다.

- [ ] **Step 4: API 회귀 테스트가 통과하는지 확인한다.**

Run: `pnpm vitest run tests/api/analyze-atomic.test.js tests/api/analysis-request-status.test.js tests/api/analyze-error.test.js`

Expected: 새 동시성·premium 정책 테스트와 기존 idempotency, kill switch, credit 취소, owner-only status 테스트가 모두 통과한다.

- [ ] **Step 5: Task 2만 커밋한다.**

```bash
git add api/analyze.js tests/api/analyze-atomic.test.js
git commit -m "feat: enforce atomic analysis throughput limits"
```

## Task 3: 동시성 제한을 안전하게 안내한다

**Files:**
- Modify: `client/src/pages/Analyze.tsx:65-90, 670-710`
- Modify: `client/src/pages/analyzeErrorMessage.test.ts:1-60`

**Consumes:** API opaque error `ANALYSIS_CONCURRENCY_LIMITED`.

**Produces:** 제목 `분석 진행 중`과 민감 정보 없는 재시도 안내.

- [ ] **Step 1: UI 실패 테스트를 작성한다.**

`client/src/pages/analyzeErrorMessage.test.ts`에 다음 테스트를 추가한다.

```ts
it("explains the concurrency limit without exposing entitlement details", () => {
  const error = { error: "ANALYSIS_CONCURRENCY_LIMITED" };
  expect(getAnalyzeErrorTitle(error)).toBe("분석 진행 중");
  expect(getAnalyzeErrorMessage(error)).toContain("진행 중인 분석");
  expect(getAnalyzeErrorMessage(error)).not.toMatch(/이용권|premium|\d+회/i);
});
```

- [ ] **Step 2: 새 UI 테스트가 실패하는지 확인한다.**

Run: `pnpm vitest run client/src/pages/analyzeErrorMessage.test.ts`

Expected: 기존 generic `분석 실패` 제목과 본문 때문에 실패.

- [ ] **Step 3: allowlist된 제목과 본문을 추가한다.**

`getAnalyzeErrorMessage`에 다음 분기를 추가한다.

```ts
if (error === "ANALYSIS_CONCURRENCY_LIMITED") {
  return "진행 중인 분석이 끝난 뒤 다시 시도해 주세요.";
}
```

`getAnalyzeErrorTitle`에 다음 분기를 `RATE_LIMITED` 검사 다음에 추가한다.

```ts
if (error === "ANALYSIS_CONCURRENCY_LIMITED") return "분석 진행 중";
```

실패 analytics는 기존 `server_error` 값을 유지하지 않고 `analysis_concurrency_limited`으로 명시한다. `trackAnalysisFailed`의 타입 또는 JSDoc이 허용하는 값 목록에도 이 문자열을 추가한다.

- [ ] **Step 4: UI 테스트가 통과하는지 확인한다.**

Run: `pnpm vitest run client/src/pages/analyzeErrorMessage.test.ts client/src/lib/analysisRequest.test.ts`

Expected: 동시성 안내가 opaque error code에서만 나타나고 기존 receipt parsing 테스트가 통과.

- [ ] **Step 5: Task 3만 커밋한다.**

```bash
git add client/src/pages/Analyze.tsx client/src/pages/analyzeErrorMessage.test.ts client/src/lib/analytics.ts
git commit -m "feat: explain concurrent analysis limits safely"
```

## Task 4: 전체 검증, 스테이징 증적, 감사 문서를 갱신한다

**Files:**
- Modify: `docs/security/2026-07-26-staging-go-no-go-security-audit.md`

**Consumes:** Tasks 1-3의 테스트와 Preview deployment.

**Produces:** 처리량 정책·베타 제한·검증 범위를 반영한 감사 기록. GO/NO-GO는 실제 동적 검증 범위에 따라 갱신하며 추정으로 GO를 선언하지 않는다.

- [ ] **Step 1: 전체 자동 검증을 실행한다.**

Run: `pnpm vitest run && pnpm run check`

Expected: 모든 test file과 TypeScript check 통과.

- [ ] **Step 2: 비밀값 없이 production build를 검증한다.**

Run:

```bash
DATABASE_URL='postgresql://postgres:placeholder@db.example.com:5432/postgres' \
SUPABASE_URL='https://example.supabase.co' \
SUPABASE_SERVICE_ROLE_KEY='placeholder-service-role-key' \
CRON_SECRET='placeholder-cron-secret' \
VITE_SUPABASE_URL='https://example.supabase.co' \
VITE_SUPABASE_ANON_KEY='placeholder-anon-key' \
pnpm run build
```

Expected: build exit code 0. 기존 Vite chunk-size warning은 실패가 아니며 감사 문서의 P2 운영 개선 항목으로만 유지한다.

- [ ] **Step 3: 구현 커밋을 검토하고 브랜치에 푸시한다.**

```bash
git diff --check
git status --short
git push origin codex/security-remediation
```

`client/src/components/AuthButton.tsx`와 `client/src/components/AuthButton.test.ts`는 사용자 작업 파일이므로 stage하지 않는다.

- [ ] **Step 4: Preview에서 베타 경계를 확인한다.**

1. Preview 배포가 Ready인 revision을 기록한다.
2. 무료 테스트 계정으로 서로 다른 분석을 겹쳐 제출해 두 번째가 `409 ANALYSIS_CONCURRENCY_LIMITED`이고 Gemini 호출이 없는지 런타임 로그로 확인한다.
3. 동일 idempotency key 재전송은 같은 receipt를 반환하고, 새 rate-limit bucket·예약·모델 호출이 생기지 않는지 확인한다.
4. `premiumEnabled=false` 상태에서 결제 UI·웹훅이 노출되지 않고 무료 정책이 유지되는지 확인한다.
5. 결제 이용권 10회·동시 2개 정책은 실제 결제 활성화 없이 DB fixture와 자동 테스트로만 검증했음을 감사 문서에 명시한다.

- [ ] **Step 5: 감사 문서를 실제 결과만으로 갱신하고 커밋한다.**

감사 문서에 다음을 기록한다.

```markdown
- 무료 처리량: 15분 3회, 동시 1개. Preview에서 확인.
- 결제 이용권 처리량: 15분 10회, 동시 2개. premiumEnabled=false인 베타에서는 자동 테스트로만 확인.
- 결제·웹훅 재도입은 별도 서명·금액·통화·replay 검증 release가 필요.
```

Run:

```bash
git add docs/security/2026-07-26-staging-go-no-go-security-audit.md
git commit -m "docs: update throughput audit evidence"
git push origin codex/security-remediation
```
