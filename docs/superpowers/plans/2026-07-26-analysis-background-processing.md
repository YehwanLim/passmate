# Background Analysis Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return an immediate, authenticated analysis receipt and complete Gemini analysis in a Vercel `waitUntil` task while a protected page polls for the finished report.

**Architecture:** `POST /api/analyze` continues to enforce server-side authentication, idempotency, rate limits, the kill switch, and atomic reservation creation. It returns a 202 receipt after registering a background work callback; that callback owns the only permitted `PENDING → CALLING` claim and completes the existing durable result/entitlement transaction. A new owner-scoped status API returns only state, a completed analysis ID, and a generalized failure code, which a new pending page polls every three seconds.

**Tech Stack:** Vercel Node.js Functions and `@vercel/functions` `waitUntil`, Prisma/PostgreSQL, Supabase Bearer authentication, React 19, Wouter, Vitest, Vite.

## Global Constraints

- Use only the staging security branch and staging Supabase; do not deploy to production.
- Require `Authorization: Bearer <Supabase access token>` for every new user-facing API.
- Use `token.sub` through `requireActiveApplicationUser`; never accept browser-provided user IDs, roles, AI results, or token usage.
- Keep the existing user analysis limit at 3 requests per 15 minutes and the `analysisEnabled` fail-closed switch.
- Preserve the existing RLS default deny and Prisma-only application-data boundary.
- Register no new third-party service, environment variable, or public diagnostic route.
- Set Gemini network timeout to 100 seconds and the `api/analyze.js` Vercel function duration to 120 seconds.
- Do not automatically retry Gemini after a timeout, 429, 500, or 503; a user retry must use a new idempotency key.
- Never log or return access tokens, API keys, resume text, report text, emails, or raw provider error text.
- Do not stage, revert, or commit the user-owned changes in `client/src/components/AuthButton.tsx` and `client/src/components/AuthButton.test.ts`.

---

## Planned File Structure

| File | Responsibility |
| --- | --- |
| `lib/analysis-request-lifecycle.js` | Owns background request state transitions, expiry, safe recovery, result finalization, and cancellation. |
| `api/analyze.js` | Validates an analysis request, creates the atomic allocation, queues lifecycle work with `waitUntil`, and returns a receipt. Keeps Gemini prompt/provider code. |
| `api/analysis-requests/[id].js` | Authenticated, owner-scoped analysis request status endpoint. |
| `client/src/lib/analysisRequest.ts` | Defines and validates the receipt/status JSON contracts and builds the pending-page URL. |
| `client/src/pages/AnalysisPending.tsx` | Renders non-sensitive in-progress UI, polls the status endpoint, and routes success to the report. |
| `client/src/pages/Analyze.tsx` | Treats a 202 receipt as success-to-pending instead of waiting for a report body. |
| `client/src/App.tsx` | Registers `/analysis-pending`. |
| `vercel.json` | Sets only `api/analyze.js` to `maxDuration: 120`. |
| `tests/api/analyze-atomic.test.js` | Verifies queueing, idempotency, one model call, lifecycle failures, reservations, and receipts. |
| `tests/api/analysis-request-status.test.js` | Verifies status authorization, owner scope, expiry, recovery, and safe JSON. |
| `client/src/lib/analysisRequest.test.ts` | Verifies strict client JSON parsing and safe pending URLs. |
| `client/src/pages/analysisPending.test.ts` | Statically verifies the pending page’s polling interval, authenticated status fetch, terminal redirects, and no report-body rendering. |
| `tests/security/deployment-security.test.js` | Verifies the function duration configuration, protected status route source, and no public test/AI proxy route is introduced. |
| `docs/security/2026-07-26-staging-go-no-go-security-audit.md` | Records post-verification evidence and the revised P1/GO-NO-GO status. |

## Public Contracts

### `POST /api/analyze`

Initial accepted request:

```json
{
  "analysis_request_id": "uuid",
  "analysis_id": "uuid",
  "project_id": "uuid",
  "status": "PENDING",
  "requestId": "uuid"
}
```

- Status: `202 Accepted` for a new allocation and an existing in-flight allocation with the same idempotency key and request hash.
- Status: `200 OK` for a previously successful allocation with the same idempotency key and request hash; body remains the receipt and never includes `report`.
- Existing error contracts remain: `401 AUTHENTICATION_REQUIRED`, `400 INVALID_*`, `409 IDEMPOTENCY_KEY_REUSED`, `429 RATE_LIMITED`, `503 ANALYSIS_DISABLED`, and `503 ANALYSIS_PERSISTENCE_PENDING`.

### `GET /api/analysis-requests/:id`

```json
{
  "id": "uuid",
  "status": "PENDING | CALLING | PERSISTENCE_PENDING | SUCCEEDED | FAILED",
  "analysis_id": "uuid or null",
  "error": "ANALYSIS_FAILED or CONTEXT_IRRELEVANT or null",
  "requestId": "uuid"
}
```

- Status: `200 OK` for the authenticated owner.
- Status: `401 AUTHENTICATION_REQUIRED` for no/invalid bearer token.
- Status: `404 NOT_FOUND` for an unknown request or another user’s request.
- The endpoint returns no project input, report JSON, provider metadata, reservation ID, raw error, user ID, or token information.

### Lifecycle interface

```js
// lib/analysis-request-lifecycle.js
export const ANALYSIS_MODEL_TIMEOUT_MS = 100_000;
export const ANALYSIS_REQUEST_TTL_MS = 125_000;

export async function runAllocatedAnalysis({
  allocation, cancelReservation, db, finalizeReservation, model, request, requestId, userId,
}) {}

export async function readOwnedAnalysisRequestStatus({
  analysisRequest, cancelReservation, db, finalizeReservation, requestId, userId,
}) {}

export function analysisReceipt({ analysisId, analysisRequestId, projectId, requestId, status }) {}
```

`runAllocatedAnalysis` catches every provider and persistence error itself, writes an auditable terminal or recoverable state, and resolves without returning a report. `readOwnedAnalysisRequestStatus` checks an expired `PENDING` or `CALLING` state before returning it, and attempts safe recovery for `PERSISTENCE_PENDING` before returning it.

## Task 1: Install the Vercel background-work dependency and configure the bounded runtime

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `vercel.json`
- Modify: `tests/security/deployment-security.test.js`

**Interfaces:**
- Consumes: Vercel Node.js Function invocation lifecycle.
- Produces: `@vercel/functions` availability and `vercel.json.functions["api/analyze.js"].maxDuration === 120`.

- [ ] **Step 1: Write the failing deployment configuration test**

Add a test that parses `vercel.json` and asserts the exact per-function setting and that broad API globs are absent:

```js
const config = JSON.parse(read("vercel.json"));
expect(config.functions).toEqual({
  "api/analyze.js": { maxDuration: 120 },
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm exec vitest run tests/security/deployment-security.test.js`

Expected: FAIL because `functions` is not yet configured.

- [ ] **Step 3: Add the runtime dependency and exact configuration**

Run `pnpm add @vercel/functions`, then add this top-level `functions` field to `vercel.json` without changing the headers, rewrites, or purge Cron:

```json
"functions": {
  "api/analyze.js": { "maxDuration": 120 }
}
```

Keep `@vercel/functions` in `dependencies`, not `devDependencies`, because the deployed function imports it.

- [ ] **Step 4: Run targeted configuration and build checks**

Run:

```bash
pnpm exec vitest run tests/security/deployment-security.test.js
DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/postgres \
SUPABASE_URL=https://example.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=placeholder \
CRON_SECRET=placeholder \
VITE_SUPABASE_URL=https://example.supabase.co \
VITE_SUPABASE_ANON_KEY=placeholder \
pnpm run build
```

Expected: targeted test and build PASS. The placeholder build values must not be deployed.

- [ ] **Step 5: Commit only Task 1 files**

```bash
git add package.json pnpm-lock.yaml vercel.json tests/security/deployment-security.test.js
git commit -m "feat: configure bounded background analysis runtime"
```

## Task 2: Move analysis lifecycle work behind a queueable, atomic background runner

**Files:**
- Create: `lib/analysis-request-lifecycle.js`
- Modify: `api/analyze.js`
- Modify: `tests/api/analyze-atomic.test.js`
- Modify: `tests/api/analyze-error.test.js`

**Interfaces:**
- Consumes: `allocateAnalysisRequest` input data, `AnalysisRequest`, `Analysis`, `AnalysisReservation`, `TokenUsage`, audit log helpers, and an injected `model(request, db)` function.
- Produces: `runAllocatedAnalysis`, `readOwnedAnalysisRequestStatus`, `analysisReceipt`, `ANALYSIS_MODEL_TIMEOUT_MS`, and `ANALYSIS_REQUEST_TTL_MS` from `lib/analysis-request-lifecycle.js`.
- Produces: `createAnalyzeHandler({ cancelReservation, consumeRateLimit, db, enqueueBackgroundWork, finalizeReservation, model, requireUser, reserveAnalysis })`, where `enqueueBackgroundWork(work)` receives a zero-argument async function and production defaults to `work => waitUntil(work())`.

- [ ] **Step 1: Rewrite the direct-result tests as failing receipt/queue tests**

In `tests/api/analyze-atomic.test.js`, add a `queuedWork` array and construct the handler with:

```js
const queuedWork = [];
const handler = createAnalyzeHandler({
  db,
  enqueueBackgroundWork: (work) => queuedWork.push(work),
  model,
  requireUser: activeUser,
  consumeRateLimit: rateAllowed,
});
```

Assert that a new request returns 202 immediately, has no `report` property, and queues exactly one function. Then execute `await queuedWork[0]()` and assert one model call, `PENDING → CALLING → PERSISTENCE_PENDING → SUCCEEDED`, one token-usage record, and one consumed reservation.

Add these failing cases:

```js
expect(res.statusCode).toBe(202);
expect(res.body).toMatchObject({
  analysis_request_id: "request-1",
  analysis_id: "analysis-1",
  project_id: "project-1",
  status: "PENDING",
});
expect(res.body).not.toHaveProperty("report");

await Promise.all(Array.from({ length: 10 }, () => runAllocatedAnalysis({
  allocation,
  cancelReservation,
  db,
  finalizeReservation,
  model,
  request: request().body,
  requestId: "request-id",
  userId: USER_ID,
})));
expect(model).toHaveBeenCalledTimes(1);
```

For model timeout, use `const timeout = Object.assign(new Error("timeout"), { name: "AbortError" });` as the injected model rejection. After the queued function completes, assert `AnalysisRequest` and `Analysis` are failed and the reservation cancellation helper is called once. Do not assert raw provider error text.

- [ ] **Step 2: Run the atomic API tests to verify they fail**

Run: `pnpm exec vitest run tests/api/analyze-atomic.test.js tests/api/analyze-error.test.js`

Expected: FAIL because the current handler waits for Gemini and returns a 200 report body.

- [ ] **Step 3: Create the lifecycle module and refactor the handler**

Move the following durable transitions out of `api/analyze.js` into `lib/analysis-request-lifecycle.js`: beginning a provider call, staging provider output, finalization, safe staged-result recovery, provider failure cancellation, and in-flight expiry. Keep prompt construction and Gemini/OpenAI HTTP request construction in `api/analyze.js`.

Implement the queue boundary as follows:

```js
const enqueue = enqueueBackgroundWork ?? ((work) => waitUntil(work()));

const allocation = await allocateAnalysisRequest({
  db,
  hash,
  idempotencyKey,
  request,
  reserve,
  userId: applicationUser.id,
});
if (allocation.type === "new") {
  try {
    enqueue(() => runAllocatedAnalysis({
      allocation,
      cancelReservation,
      db,
      finalizeReservation,
      model,
      request,
      requestId,
      userId: applicationUser.id,
    }));
  } catch {
    await failUnstartedAnalysis({ allocation, cancelReservation, db, requestId, userId: applicationUser.id });
    return sendError(res, 503, "ANALYSIS_FAILED", requestId);
  }
}
return sendJson(res, allocation.type === "new" ? 202 : 200,
  analysisReceipt({
    analysisId: allocation.analysis.id,
    analysisRequestId: allocation.analysisRequest.id,
    projectId: allocation.project.id,
    requestId,
    status: allocation.analysisRequest.status,
  }),
  requestId,
);
```

Set `expiresAt` during allocation to `new Date(Date.now() + ANALYSIS_REQUEST_TTL_MS)`. Expiry may close only `PENDING` or `CALLING`; it must never cancel a `PERSISTENCE_PENDING` request because a completed provider result may be recoverable.

Set Gemini/OpenAI fetch timeout to `ANALYSIS_MODEL_TIMEOUT_MS` and remove the direct HTTP response paths that return an inline report. Existing completed requests return a 200 receipt; matching unfinished requests return their existing 202 receipt instead of a conflict. A different request hash with the same key remains `409 IDEMPOTENCY_KEY_REUSED`.

- [ ] **Step 4: Run lifecycle tests until they pass**

Run: `pnpm exec vitest run tests/api/analyze-atomic.test.js tests/api/analyze-error.test.js`

Expected: PASS, including immediate 202, exactly-once queued work, timeout cancellation, persistence recovery, kill switch, and rate-limit assertions.

- [ ] **Step 5: Commit only Task 2 files**

```bash
git add lib/analysis-request-lifecycle.js api/analyze.js tests/api/analyze-atomic.test.js tests/api/analyze-error.test.js
git commit -m "feat: queue analysis work after accepted receipt"
```

## Task 3: Add the authenticated analysis request status API

**Files:**
- Create: `api/analysis-requests/[id].js`
- Create: `tests/api/analysis-request-status.test.js`
- Modify: `lib/analysis-request-lifecycle.js`
- Modify: `tests/api/protected-user-routes.test.js`
- Modify: `tests/security/deployment-security.test.js`

**Interfaces:**
- Consumes: `readOwnedAnalysisRequestStatus({ analysisRequest, cancelReservation, db, finalizeReservation, requestId, userId })`.
- Produces: `createAnalysisRequestStatusHandler({ db, requireUser, lifecycle })`.
- Produces: the exact `GET /api/analysis-requests/:id` contract documented above.

- [ ] **Step 1: Write failing authorization, ownership, and state tests**

Create `tests/api/analysis-request-status.test.js` with the existing API response helper shape. Add these assertions:

```js
await unauthenticatedHandler(request({ query: { id: "request-1" } }), res);
expect(res.statusCode).toBe(401);
expect(res.body).toEqual({ error: "AUTHENTICATION_REQUIRED", requestId: expect.any(String) });

await ownerHandler(request({ query: { id: "other-users-request" } }), res);
expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
  where: { id: "other-users-request", userId: USER_ID },
}));
expect(res.statusCode).toBe(404);

expect(res.body).toEqual(expect.objectContaining({
  id: "request-1",
  status: "SUCCEEDED",
  analysis_id: "analysis-1",
  error: null,
}));
expect(JSON.stringify(res.body)).not.toContain("providerResult");
```

Add a stale `CALLING` fixture whose `expiresAt` is in the past. Assert that a conditional update changes it to `FAILED`, the related `Analysis` is failed, the reservation is cancelled, and the returned JSON is `{ status: "FAILED", analysis_id: null, error: "ANALYSIS_FAILED" }`.

Add a `PERSISTENCE_PENDING` fixture with staged values and assert the lifecycle recovery runs before a `SUCCEEDED` response.

In `tests/security/deployment-security.test.js`, add these source-boundary assertions at the same time:

```js
expect(read("api/analysis-requests/[id].js")).toContain("requireActiveApplicationUser");
expect(read("api/analysis-requests/[id].js")).toContain("userId: applicationUser.id");
expect(read("vercel.json")).not.toContain("Access-Control-Allow-Origin");
```

- [ ] **Step 2: Run status and protected-route tests to verify they fail**

Run: `pnpm exec vitest run tests/api/analysis-request-status.test.js tests/api/protected-user-routes.test.js tests/security/deployment-security.test.js`

Expected: FAIL because the dynamic API route and lifecycle status reader do not exist.

- [ ] **Step 3: Implement only the safe status projection**

Implement the route as a GET-only `withApiHandler` handler. Read using this ownership condition. Select `providerResult` and `providerMetadata` only for server-side `PERSISTENCE_PENDING` recovery; never place them in the response:

```js
const stored = await db.analysisRequest.findFirst({
  where: { id, userId: applicationUser.id },
  select: {
    id: true,
    status: true,
    expiresAt: true,
    analysisId: true,
    analysis: { select: { errorCode: true } },
    reservationId: true,
    providerResult: true,
    providerMetadata: true,
  },
});
```

Return `NOT_FOUND` when `stored` is null. Pass the stored record to `readOwnedAnalysisRequestStatus`, then serialize only `id`, `status`, `analysis_id`, and an allowlisted `error` value. Allowlist `CONTEXT_IRRELEVANT`; map every other terminal error to `ANALYSIS_FAILED`.

Reject all non-GET methods with `405 METHOD_NOT_ALLOWED`. Do not add CORS headers or any browser database access.

- [ ] **Step 4: Run the authorization/status tests until they pass**

Run: `pnpm exec vitest run tests/api/analysis-request-status.test.js tests/api/protected-user-routes.test.js tests/security/deployment-security.test.js`

Expected: PASS with unauthenticated 401, foreign 404, stale cancellation, staged recovery, and safe JSON projection.

- [ ] **Step 5: Commit only Task 3 files**

```bash
git add api/analysis-requests/'[id]'.js lib/analysis-request-lifecycle.js tests/api/analysis-request-status.test.js tests/api/protected-user-routes.test.js tests/security/deployment-security.test.js
git commit -m "feat: expose owner-scoped analysis request status"
```

## Task 4: Move the browser to a non-sensitive pending page

**Files:**
- Create: `client/src/lib/analysisRequest.ts`
- Create: `client/src/lib/analysisRequest.test.ts`
- Create: `client/src/pages/AnalysisPending.tsx`
- Create: `client/src/pages/analysisPending.test.ts`
- Modify: `client/src/pages/Analyze.tsx`
- Modify: `client/src/pages/analyzeErrorMessage.test.ts`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: an `AnalysisReceipt` from `POST /api/analyze` and an `AnalysisRequestStatus` from `GET /api/analysis-requests/:id`.
- Produces: `parseAnalysisReceipt`, `parseAnalysisRequestStatus`, and `analysisPendingPath` from `client/src/lib/analysisRequest.ts`.
- Produces: `/analysis-pending?requestId=<encoded UUID>` route.

- [ ] **Step 1: Write failing parser and page-behavior tests**

Create strict pure parsing tests:

```ts
expect(parseAnalysisReceipt({
  analysis_request_id: "request-1",
  analysis_id: "analysis-1",
  project_id: "project-1",
  status: "PENDING",
})).toEqual({
  analysisRequestId: "request-1",
  analysisId: "analysis-1",
  projectId: "project-1",
  status: "PENDING",
});

expect(() => parseAnalysisReceipt({ report: { secret: "do not render" } })).toThrow("INVALID_ANALYSIS_RECEIPT");
expect(analysisPendingPath("request-1")).toBe("/analysis-pending?requestId=request-1");
```

In `client/src/pages/analysisPending.test.ts`, read `AnalysisPending.tsx` and assert all of these source-level behaviors:

```ts
expect(source).toContain('fetch(`/api/analysis-requests/${encodeURIComponent(requestId)}`');
expect(source).toContain("setTimeout(poll, 3000)");
expect(source).toContain('navigate(`/report-new?analysisId=${encodeURIComponent(status.analysisId)}`)');
expect(source).not.toContain("ai_response_json");
expect(source).not.toContain("localStorage");
expect(source).not.toContain("sessionStorage");
```

Update `analyzeErrorMessage.test.ts` to assert the submit page checks `response.status === 202`, calls `analysisPendingPath`, and no longer checks `data.report.questionTabs`.

- [ ] **Step 2: Run client tests to verify they fail**

Run: `pnpm exec vitest run client/src/lib/analysisRequest.test.ts client/src/pages/analysisPending.test.ts client/src/pages/analyzeErrorMessage.test.ts`

Expected: FAIL because the parser module and pending page do not exist and `Analyze.tsx` still expects an inline report.

- [ ] **Step 3: Implement receipt parsing, pending UI, and the route**

Implement `parseAnalysisReceipt` and `parseAnalysisRequestStatus` as structural validators that reject unexpected/missing values and ignore all properties other than the documented contract. Both return camelCase data used by the UI.

In `Analyze.tsx`:

1. Keep the existing auth header, idempotency key, local input validation, rate-limit message, kill-switch message, and generic safe errors.
2. Replace the 120-second `AbortController` and inline report validation with receipt parsing.
3. For 202 or 200 receipt responses, clear `analysisRequestRef` and navigate with `analysisPendingPath(receipt.analysisRequestId)`.
4. Do not put resume text, report data, access tokens, or request IDs in localStorage/sessionStorage.

In `AnalysisPending.tsx`, obtain `requestId` from `window.location.search`. If absent, navigate to `/analyze`. While mounted, call the protected status route immediately and after each 3-second delay using `getAuthorizationHeader()`. On `SUCCEEDED` with a non-empty `analysisId`, call `trackAnalysisComplete("cover_letter", Math.round(performance.now() - mountedAt))` and navigate to the report. On `FAILED`, call `trackAnalysisFailed("cover_letter", "server_error")`, stop polling, and show one retry button that navigates to `/analyze`. For `PENDING`, `CALLING`, and `PERSISTENCE_PENDING`, render only status copy and a cancel-free waiting affordance. Abort the current status fetch and clear the pending timer during effect cleanup.

Register the exact Wouter route before `/report-new`:

```tsx
<Route path={"/analysis-pending"} component={AnalysisPending} />
```

- [ ] **Step 4: Run client checks until they pass**

Run:

```bash
pnpm exec vitest run client/src/lib/analysisRequest.test.ts client/src/pages/analysisPending.test.ts client/src/pages/analyzeErrorMessage.test.ts
pnpm run check
```

Expected: PASS with no TypeScript errors and no client-side report persistence.

- [ ] **Step 5: Commit only Task 4 files**

```bash
git add client/src/lib/analysisRequest.ts client/src/lib/analysisRequest.test.ts client/src/pages/AnalysisPending.tsx client/src/pages/analysisPending.test.ts client/src/pages/Analyze.tsx client/src/pages/analyzeErrorMessage.test.ts client/src/App.tsx
git commit -m "feat: show pending analysis status before report"
```

## Task 5: Run full regression, deploy the security branch, and collect staging evidence

**Files:**
- Modify: `docs/security/2026-07-26-staging-go-no-go-security-audit.md`

**Interfaces:**
- Consumes: all Task 1–4 contracts and the existing staging-only Vercel/Supabase configuration.
- Produces: current test evidence, staging evidence, and an updated P1/GO-NO-GO report.

- [ ] **Step 1: Run the complete local verification suite**

Run:

```bash
pnpm exec vitest run
pnpm run check
DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/postgres \
SUPABASE_URL=https://example.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=placeholder \
CRON_SECRET=placeholder \
VITE_SUPABASE_URL=https://example.supabase.co \
VITE_SUPABASE_ANON_KEY=placeholder \
pnpm run build
git diff --check
```

Expected: all tests, typecheck, build, and whitespace check PASS. Do not run a production dependency audit or send package metadata without the user’s explicit approval.

- [ ] **Step 2: Deploy only after the runtime prerequisite is confirmed**

In Vercel, open the PassMate project, go to **Settings → Functions**, and confirm **Fluid Compute** is enabled. Deploy the `codex/security-remediation` branch preview only. Confirm the deployment contains `api/analyze` and `api/analysis-requests/[id]` functions, and keep `analysisEnabled=true` only for the controlled test window.

- [ ] **Step 3: Perform the staging verification without exposing secrets**

Use the existing A and B test accounts and non-sensitive sample text:

1. A and B each receive an immediate pending page and then a report.
2. In B’s browser session, replace the pending request ID and report ID with A’s values; both must show 404/no content.
3. For the rate-limit check, use an account with no analysis starts in its prior 15-minute window; wait for the window to clear if needed. Set `analysisEnabled=false`, submit four valid requests, and confirm the first three return 503 without a background request while the fourth returns 429. Restore it to true.
4. Run the mocked 10-way concurrent atomic Vitest test from Task 2; it must queue one task for one idempotency key and no duplicate reservation.
5. Inspect Vercel logs only for request ID, safe error code, and provider status code. Do not copy secrets, tokens, resumes, reports, or raw provider response text into the audit report.

- [ ] **Step 4: Update the audit report and commit the evidence**

Record the deployment revision, test commands, A/B ownership results, background completion durations, timeout/failure behavior, and rate-limit result in the audit report. Keep P1-01 or P1-02 open if any required behavior cannot be reproduced. Make the GO/NO-GO decision from the new evidence rather than the intended design.

```bash
git add docs/security/2026-07-26-staging-go-no-go-security-audit.md
git commit -m "docs: verify background analysis security controls"
```

## Plan Self-Review

- **Spec coverage:** Tasks 1–2 cover the Vercel background task, 100/120-second limits, atomic work claim, cost-safe failure, and persistence recovery. Task 3 covers the protected status contract and stalled-request cleanup. Task 4 covers the pending UX with no browser persistence of sensitive data. Task 5 covers rate limit, kill switch, A/B ownership, regression, deployment, and audit evidence.
- **Scope:** The plan uses only Vercel, the existing database, existing auth, and one Vercel runtime package. It excludes payments, production deployment, automatic provider retry, and a new queue vendor.
- **Consistency:** The 202 receipt fields, status path, status names, 100-second model timeout, 120-second function limit, and 125-second in-flight expiry are named identically in every task.
- **Rate-limit correction:** Ten-way concurrency is a mocked lifecycle test. Real staging retains the existing 3-per-15-minute limit and verifies the fourth request receives 429.
