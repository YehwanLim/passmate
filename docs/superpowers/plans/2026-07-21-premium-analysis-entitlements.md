# Premium Analysis Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무료 1회 및 그로블 결제 기반 프리미엄 3회 분석 이용권을 계정 단위로 안전하게 제공한다.

**Architecture:** Prisma/PostgreSQL에 서비스 설정, 사용자 이용권, 결제 이력을 추가한다. 분석 API는 인증된 사용자의 이용권을 서버에서 원자적으로 예약하고, 결과 저장 성공 시에만 차감한다. 그로블 일반결제 완료 웹훅은 결제 ID의 중복 처리를 막은 뒤 연결된 사용자에게 프리미엄 3회를 지급한다. 클라이언트는 서버의 이용권 요약만 표시하고, Premium ON/OFF에 따라 가격 영역과 구매 CTA를 달리 렌더링한다.

**Tech Stack:** React 19, TypeScript, Vite, Wouter, Vercel Serverless Functions, Prisma 7, PostgreSQL/Supabase, Vitest, Groble webhook.

## Global Constraints

- 무료 분석은 계정당 1회다.
- 프리미엄 판매가 켜졌을 때만 프리미엄 3회 플랜과 구매 CTA를 노출한다.
- 결제 성공 웹훅만 이용권을 지급하며, 브라우저 복귀만으로는 지급하지 않는다.
- 동일한 `provider_payment_id`는 한 번만 처리한다.
- 분석 결과 저장이 성공한 경우에만 이용권을 차감한다.
- 민감한 결제 검증 값은 환경 변수로만 보관한다.
- 그로블 실제 웹훅 JSON 키와 서명 헤더는 테스트 발송 payload를 받은 뒤 provider adapter의 단일 함수에만 반영한다.

---

## File Structure

- `prisma/schema.prisma`: 이용권, 설정, 결제, 구매 준비, 분석 예약 모델과 User 관계를 정의한다.
- `prisma/migrations/20260721_add_analysis_entitlements/migration.sql`: 운영 DB에 적용할 테이블, 제약, 함수 및 RLS 정책을 생성한다.
- `lib/auth.js`: Bearer 토큰을 Supabase Auth에 검증해 서버용 사용자 ID를 반환한다.
- `lib/analysis-entitlements.js`: 설정 조회, 잔여 횟수 계산, 예약/확정/취소, 프리미엄 지급을 Prisma transaction으로 제공한다.
- `api/entitlements.js`: 로그인 사용자의 공개 이용권 요약과 구매 준비 토큰을 제공한다.
- `api/admin/entitlements.js`: 관리자 전용 Premium ON/OFF 및 결제/미연결 지급 현황을 제공한다.
- `api/webhooks/groble.js`: 그로블 `일반결제 완료`을 검증·중복 방지·지급 처리한다.
- `api/analyze.js`: 인증과 분석 예약 ID를 요구한다.
- `api/projects.js`: 결과 저장 트랜잭션에서 분석 예약을 확정하고 저장 실패 시 취소한다.
- `vite.config.ts`: 새 API를 로컬 개발 서버에도 연결한다.
- `client/src/lib/apiAuth.ts`: 현재 Supabase access token을 포함하는 API 요청 helper다.
- `client/src/hooks/useAnalysisEntitlement.ts`: UI에서 이용권과 Premium 설정을 조회/갱신한다.
- `client/src/components/PricingSection.tsx`: Premium ON/OFF별 요금 영역을 표시하고 결제 전 구매 준비 요청을 보낸다.
- `client/src/pages/Analyze.tsx`: 잔여 횟수 표시, 소진 차단, 분석 예약 ID 전달을 담당한다.
- `client/src/pages/MyProjects.tsx`: 총/사용/잔여 분석 횟수와 구매 CTA를 표시한다.
- `client/src/pages/admin/settings/SettingsPage.tsx`: localStorage 토글을 서버 기반 Premium 토글로 교체한다.
- `client/src/pages/admin/payments/PaymentsPage.tsx`: 실제 결제와 지급 현황을 표시한다.

### Task 1: Schema and Entitlement Domain

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260721_add_analysis_entitlements/migration.sql`
- Create: `lib/analysis-entitlements.js`
- Test: `lib/analysis-entitlements.test.js`

**Interfaces:**
- Produces `getEntitlementSummary(tx, userId): Promise<{ premiumEnabled: boolean; freeRemaining: number; premiumRemaining: number; remaining: number }>`.
- Produces `reserveAnalysis(tx, userId): Promise<{ reservationId: string; source: "free" | "premium" }>` which throws `EntitlementUnavailableError` when empty.
- Produces `finalizeAnalysisReservation(tx, reservationId, userId): Promise<void>` and `cancelAnalysisReservation(tx, reservationId, userId): Promise<void>`.
- Produces `grantGroblePurchase(tx, input): Promise<{ granted: boolean; credits: number }>` where `input.providerPaymentId` is idempotent.

- [ ] **Step 1: Write the failing domain tests**

```js
it("gives a new account one free analysis and then blocks a second reservation", async () => {
  const first = await reserveAnalysis(db, "user-1");
  await finalizeAnalysisReservation(db, first.reservationId, "user-1");
  await expect(reserveAnalysis(db, "user-1")).rejects.toMatchObject({ code: "ANALYSIS_CREDITS_EXHAUSTED" });
});

it("grants exactly three credits once when Groble retries a paid event", async () => {
  await grantGroblePurchase(db, { providerPaymentId: "pay-1", userId: "user-1", rawEvent: {} });
  const duplicate = await grantGroblePurchase(db, { providerPaymentId: "pay-1", userId: "user-1", rawEvent: {} });
  expect(duplicate).toEqual({ granted: false, credits: 0 });
  await expect(getEntitlementSummary(db, "user-1")).resolves.toMatchObject({ premiumRemaining: 3 });
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `pnpm exec vitest run lib/analysis-entitlements.test.js`

Expected: FAIL because the entitlement module and Prisma models do not exist.

- [ ] **Step 3: Add database types and migration**

Add Prisma models named `EntitlementSetting`, `AnalysisEntitlement`, `AnalysisReservation`, `PurchaseIntent`, and `PaymentEntitlement`. Add a unique constraint on `PaymentEntitlement.providerPaymentId`, a unique `userId` on `AnalysisEntitlement`, and User relations. `PurchaseIntent` owns the authenticated `userId` that a future Groble event must resolve before granting credits. Seed the singleton settings record with `premiumEnabled = false`, `premiumCreditsPerPurchase = 3`, and the supplied Groble URL. The SQL migration must use `INSERT ... ON CONFLICT DO NOTHING` for the singleton setting and indexes for `user_id`, `status`, and `provider_payment_id`.

- [ ] **Step 4: Implement the transactional domain functions**

Use `prisma.$transaction` callers and lock the entitlement row before incrementing counters. `reserveAnalysis` should prefer the unused free credit then premium credits, create a `PENDING` reservation, and calculate availability including pending reservations. `finalizeAnalysisReservation` changes only that user’s `PENDING` reservation to `CONSUMED`; `cancelAnalysisReservation` changes it to `CANCELLED`. `grantGroblePurchase` creates the payment row and increments `premiumCreditsGranted` in the same transaction; a unique collision returns `{ granted: false, credits: 0 }`.

- [ ] **Step 5: Run domain tests**

Run: `pnpm exec vitest run lib/analysis-entitlements.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the domain layer**

```bash
git add prisma/schema.prisma prisma/migrations/20260721_add_analysis_entitlements/migration.sql lib/analysis-entitlements.js lib/analysis-entitlements.test.js
git commit -m "feat: add analysis entitlement domain"
```

### Task 2: Authenticated Entitlement and Admin APIs

**Files:**
- Create: `lib/auth.js`
- Create: `api/entitlements.js`
- Create: `api/admin/entitlements.js`
- Modify: `vite.config.ts`
- Test: `api/entitlements.test.js`

**Interfaces:**
- Consumes `getEntitlementSummary`, `reserveAnalysis` from Task 1.
- Produces `GET /api/entitlements` returning `{ premiumEnabled, freeRemaining, premiumRemaining, remaining, groblePaymentUrl }`.
- Produces `POST /api/entitlements/purchase-intents` returning `{ purchaseIntentId, checkoutUrl }` for an authenticated user.
- Produces `GET|PATCH /api/admin/entitlements` for verified administrators only.

- [ ] **Step 1: Write failing API tests**

```js
it("returns an entitlement summary for the verified token user, never body.userId", async () => {
  const response = await invokeEntitlements({ authorization: "Bearer valid-token" });
  expect(response.statusCode).toBe(200);
  expect(response.body.remaining).toBe(1);
});

it("rejects a non-admin attempt to enable premium", async () => {
  const response = await invokeAdminEntitlements({ authorization: "Bearer member-token", body: { premiumEnabled: true } });
  expect(response.statusCode).toBe(403);
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `pnpm exec vitest run api/entitlements.test.js`

Expected: FAIL because routes and token verification are absent.

- [ ] **Step 3: Implement token verification and public summary route**

Use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only on the server to resolve the Bearer access token into a Supabase user. Never trust `userId` from JSON. Implement GET summary, and return 401 without a valid token. Configure matching Vite development middleware that forwards request headers and bodies to the same handlers.

- [ ] **Step 4: Implement admin settings and purchase intent**

Check the authenticated user's `users.role === "admin"` before reading or updating the singleton. `PATCH` accepts only `{ premiumEnabled: boolean }`. A purchase intent stores the authenticated `userId`, `PENDING` status, and an unguessable ID before returning the configured Groble URL. Do not add a credit here.

- [ ] **Step 5: Run API tests**

Run: `pnpm exec vitest run api/entitlements.test.js`

Expected: PASS.

- [ ] **Step 6: Commit API work**

```bash
git add lib/auth.js api/entitlements.js api/admin/entitlements.js vite.config.ts api/entitlements.test.js
git commit -m "feat: expose authenticated entitlement APIs"
```

### Task 3: Groble Webhook Granting

**Files:**
- Create: `api/webhooks/groble.js`
- Modify: `vite.config.ts`
- Test: `api/webhooks/groble.test.js`
- Modify: `.env.example`

**Interfaces:**
- Consumes `grantGroblePurchase` from Task 1.
- Produces `POST /api/webhooks/groble` accepting only a verified `일반결제 완료` payload.
- Uses `GROBLE_WEBHOOK_SECRET` when the provider exposes a signed request header.

- [ ] **Step 1: Write failing webhook tests**

```js
it("grants three credits for one verified paid event", async () => {
  const response = await invokeGrobleWebhook(paidEvent({ paymentId: "groble-100", purchaseIntentId: "intent-1" }));
  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({ ok: true, grantedCredits: 3 });
});

it("does not grant a second time for the same payment id", async () => {
  await invokeGrobleWebhook(paidEvent({ paymentId: "groble-100", purchaseIntentId: "intent-1" }));
  const retry = await invokeGrobleWebhook(paidEvent({ paymentId: "groble-100", purchaseIntentId: "intent-1" }));
  expect(retry.body).toEqual({ ok: true, grantedCredits: 0 });
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `pnpm exec vitest run api/webhooks/groble.test.js`

Expected: FAIL because the webhook handler does not exist.

- [ ] **Step 3: Implement a provider adapter and webhook handler**

Keep `parseGroblePaidEvent(body, headers)` as the only provider-specific function. It must return `{ providerPaymentId, purchaseIntentId, amount, rawEvent }` only for `일반결제 완료`. Verify the configured signature header before parsing when Groble exposes one. Resolve `purchaseIntentId` to its user, call `grantGroblePurchase`, mark the purchase intent paid, and return the number of newly granted credits. Unknown events return 204; malformed, unsigned, or unlinked paid events return 400/401/422 and are logged without granting credits.

- [ ] **Step 4: Add environment documentation**

Document `SUPABASE_SERVICE_ROLE_KEY`, `GROBLE_WEBHOOK_SECRET`, and `GROBLE_PAYMENT_URL=https://www.groble.im/payment/4SGBV5` in `.env.example` without real secret values. Add the deployed webhook URL to the project setup notes.

- [ ] **Step 5: Run webhook tests**

Run: `pnpm exec vitest run api/webhooks/groble.test.js`

Expected: PASS.

- [ ] **Step 6: Commit webhook support**

```bash
git add api/webhooks/groble.js api/webhooks/groble.test.js vite.config.ts .env.example
git commit -m "feat: grant premium credits from Groble payments"
```

### Task 4: Reserve and Consume Credits in the Analysis Flow

**Files:**
- Modify: `api/analyze.js`
- Modify: `api/projects.js`
- Modify: `client/src/pages/Analyze.tsx`
- Create: `client/src/lib/apiAuth.ts`
- Test: `api/analyze.entitlement.test.js`
- Test: `client/src/pages/Analyze.entitlement.test.ts`

**Interfaces:**
- Consumes authenticated API helper from Task 2.
- `POST /api/analyze` requires `Authorization` and returns `{ ...report, analysisReservationId }`.
- `POST /api/projects` requires `analysisReservationId` and finalizes the reservation atomically with project/analysis persistence.

- [ ] **Step 1: Write failing analysis-flow tests**

```js
it("returns 402 before calling the AI provider when no analysis credits remain", async () => {
  const response = await invokeAnalyze({ token: "empty-credit-user", questions: validQuestions });
  expect(response.statusCode).toBe(402);
  expect(callActiveModelOnce).not.toHaveBeenCalled();
});

it("does not consume a reservation when result persistence fails", async () => {
  const reservation = await reserveFor("user-1");
  await expect(saveProjectWithReservation({ reservationId: reservation.id, failInsert: true })).rejects.toThrow();
  expect(await getEntitlementSummary(db, "user-1")).toMatchObject({ remaining: 1 });
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `pnpm exec vitest run api/analyze.entitlement.test.js client/src/pages/Analyze.entitlement.test.ts`

Expected: FAIL because analysis endpoints do not reserve credits and the client sends no bearer token.

- [ ] **Step 3: Add server-side reservation before AI invocation**

Authenticate the request, call `reserveAnalysis`, and only then invoke the model. On any model exception, cancel the reservation before returning the original failure. Return the opaque reservation ID with the successful analysis result. Use status 402 and `{ error: "ANALYSIS_CREDITS_EXHAUSTED" }` when no credit remains.

- [ ] **Step 4: Atomically persist result and finalize reservation**

Require a matching, pending reservation owned by the authenticated user in `api/projects.js`. Within the existing Prisma transaction, create the project and analysis then finalize the reservation. If any create operation fails, transaction rollback leaves the reservation pending; catch that failure and explicitly cancel it before responding. Reject a client-supplied `user` whose ID differs from the authenticated token.

- [ ] **Step 5: Update the analysis page**

Create `apiAuth.ts` to retrieve the current Supabase session token and use it for `/api/analyze` and `/api/projects`. Query `useAnalysisEntitlement` before enabling submission; display `남은 분석 n회`; map 402 to a clear exhausted-credit modal. When Premium is enabled, show a `프리미엄 3회 이용권 구매` action that starts a purchase intent and opens the returned checkout URL.

- [ ] **Step 6: Run analysis-flow tests**

Run: `pnpm exec vitest run api/analyze.entitlement.test.js client/src/pages/Analyze.entitlement.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit protected analysis flow**

```bash
git add api/analyze.js api/projects.js client/src/pages/Analyze.tsx client/src/lib/apiAuth.ts api/analyze.entitlement.test.js client/src/pages/Analyze.entitlement.test.ts
git commit -m "feat: enforce analysis credits in analysis flow"
```

### Task 5: Premium-aware Landing, My Page, and Admin UI

**Files:**
- Create: `client/src/hooks/useAnalysisEntitlement.ts`
- Modify: `client/src/components/PricingSection.tsx`
- Modify: `client/src/pages/MyProjects.tsx`
- Modify: `client/src/pages/admin/settings/SettingsPage.tsx`
- Modify: `client/src/pages/admin/payments/PaymentsPage.tsx`
- Test: `client/src/components/PricingSection.test.tsx`
- Test: `client/src/pages/MyProjects.entitlement.test.tsx`
- Test: `client/src/pages/admin/settings/SettingsPage.entitlement.test.tsx`

**Interfaces:**
- Consumes `GET /api/entitlements` and `PATCH /api/admin/entitlements`.
- `useAnalysisEntitlement()` returns `{ data, isLoading, refresh, startPremiumCheckout }`.

- [ ] **Step 1: Write failing UI tests**

```tsx
it("shows only the free card when premium sales are disabled", async () => {
  render(<PricingSection />, { entitlement: { premiumEnabled: false, remaining: 1 } });
  expect(screen.getByText("첫 분석 1회 무료")).toBeVisible();
  expect(screen.queryByText("프리미엄 분석 3회")).not.toBeInTheDocument();
});

it("shows remaining analysis credits on My page", async () => {
  render(<MyProjects />, { entitlement: { premiumEnabled: true, freeRemaining: 0, premiumRemaining: 2, remaining: 2 } });
  expect(await screen.findByText("남은 분석 2회")).toBeVisible();
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `pnpm exec vitest run client/src/components/PricingSection.test.tsx client/src/pages/MyProjects.entitlement.test.tsx client/src/pages/admin/settings/SettingsPage.entitlement.test.tsx`

Expected: FAIL because no entitlement hook or conditional price UI exists.

- [ ] **Step 3: Implement the client hook and checkout action**

Fetch the authenticated summary once after the auth session resolves. `startPremiumCheckout` must POST a purchase intent and set `window.location.href` to the returned Groble URL; it should redirect unauthenticated users to Google login with the original return URL.

- [ ] **Step 4: Render the conditional customer UI**

Change `PricingSection` to render one free plan when Premium is off, and a restrained two-plan layout when on. Update current hard-coded 2회권 copy to `프리미엄 분석 3회`. In `Analyze` and `MyProjects`, display the same server-provided remaining count. Avoid neon effects and preserve reduced-motion behavior already present in the landing page.

- [ ] **Step 5: Replace the local admin toggle and payment placeholder**

Keep unrelated settings in localStorage, but source `paymentModule` from `/api/admin/entitlements`. Rename the control to `프리미엄 판매 활성화`, persist it through PATCH, and show its saving/error state. Replace the payment placeholder with a table of provider payment ID, user email, credits granted, status, and timestamp; display unlinked events for manual review only.

- [ ] **Step 6: Run UI tests**

Run: `pnpm exec vitest run client/src/components/PricingSection.test.tsx client/src/pages/MyProjects.entitlement.test.tsx client/src/pages/admin/settings/SettingsPage.entitlement.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit customer and admin UI**

```bash
git add client/src/hooks/useAnalysisEntitlement.ts client/src/components/PricingSection.tsx client/src/pages/MyProjects.tsx client/src/pages/admin/settings/SettingsPage.tsx client/src/pages/admin/payments/PaymentsPage.tsx client/src/components/PricingSection.test.tsx client/src/pages/MyProjects.entitlement.test.tsx client/src/pages/admin/settings/SettingsPage.entitlement.test.tsx
git commit -m "feat: show premium plans and remaining analysis credits"
```

### Task 6: End-to-End Verification and Deployment Setup

**Files:**
- Modify: `README.md`
- Test: `api/webhooks/groble.test.js`

- [ ] **Step 1: Add deployment runbook**

Document the Prisma migration command, Vercel environment variables, and the exact Groble configuration: webhook URL `https://passmate-gamma.vercel.app/api/webhooks/groble`, event `일반결제 완료`, and test-send verification before enabling Premium sales.

- [ ] **Step 2: Run focused tests**

Run: `pnpm exec vitest run lib/analysis-entitlements.test.js api/entitlements.test.js api/webhooks/groble.test.js api/analyze.entitlement.test.js client/src/pages/Analyze.entitlement.test.ts client/src/components/PricingSection.test.tsx client/src/pages/MyProjects.entitlement.test.tsx client/src/pages/admin/settings/SettingsPage.entitlement.test.tsx`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `pnpm run build`

Expected: exit code 0.

- [ ] **Step 4: Validate manually**

1. Login as a new account, run one successful analysis, and verify the second is blocked.
2. Turn on Premium in admin and verify both plans appear on the landing page.
3. Create a purchase intent, use the Groble test delivery for one paid event, and verify 3 credits appear on Analyze and My.
4. Send the same event again and verify no second grant occurs.
5. Start a failed analysis and verify the credit remains available.

- [ ] **Step 5: Commit runbook**

```bash
git add README.md
git commit -m "docs: add Groble premium setup runbook"
```
