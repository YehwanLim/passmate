# 관리자 사용자별 분석 이용권 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 Users 영역에서 사용자별 남은 분석 이용권을 확인하고, 무료 이용권을 직접 지급하거나 쿠폰으로 지급할 수 있게 만든다.

**Architecture:** 기존 분석 이용권 집계에 `BONUS` 출처를 추가해 관리자 지급분을 기본 무료·결제 이용권과 분리한다. 관리자 전용 API가 모든 조회·지급·쿠폰 상태 변경을 인증된 트랜잭션으로 처리하고, React 관리 화면은 해당 API만 사용한다. 각 지급은 변경 불가능한 이력 행으로 남겨 잔액과 쿠폰 사용 수를 검증할 수 있게 한다.

**Tech Stack:** React 19, TypeScript, Vite, Supabase Auth, Vercel Node handlers, Prisma 7, PostgreSQL, Vitest, Tailwind/shadcn UI.

## Global Constraints

- 할인율 쿠폰과 그로블 결제 할인 연동은 구현하지 않는다. 쿠폰은 무료 분석 횟수만 지급한다.
- 잔액·쿠폰·지급 이력의 생성과 변경은 서버에서만 수행한다. 브라우저에서 Supabase 테이블을 직접 수정하지 않는다.
- 기본 무료 → 관리자 지급 → 결제 이용권(`FREE → BONUS → PREMIUM`) 순서로 분석 예약을 생성한다.
- 직접 지급 수와 쿠폰 지급 수는 1 이상 10,000 이하의 정수만 허용한다.
- 동일 쿠폰을 동일 사용자에게 두 번 지급하지 않으며, 쿠폰 사용 한도 초과도 데이터베이스 트랜잭션에서 막는다.
- 기존 `freeRemaining`, `premiumRemaining`, `remaining`, `premiumEnabled` 응답 필드는 호환성을 위해 유지하고 `bonusRemaining`만 추가한다.
- 작업 중 이미 존재하는 사용자 변경 파일은 되돌리거나 스테이징하지 않는다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `prisma/schema.prisma` | BONUS 예약 출처, 관리자 지급 잔액, 쿠폰·지급 이력 Prisma 모델과 User 관계를 선언한다. |
| `prisma/migrations/20260726_add_admin_credit_management/migration.sql` | 운영 DB에 컬럼·enum 값·테이블·제약·인덱스를 안전하게 추가한다. |
| `lib/analysis-entitlements.js` | 무료/보너스/프리미엄 잔액 계산, 예약, 직접 지급, 쿠폰 적용의 트랜잭션 도메인 함수를 제공한다. |
| `lib/admin-auth.js` | Supabase 세션과 DB 역할을 함께 검증하는 공통 관리자 인증 함수다. |
| `api/admin/user-credits.js` | 관리자별 사용자 잔액 목록·상세·직접 지급·쿠폰 적용 HTTP 경계다. |
| `api/admin/credit-coupons.js` | 무료 이용권 쿠폰의 조회·생성·수정·비활성화 HTTP 경계다. |
| `client/src/lib/admin-credits.ts` | 관리자 API의 타입, bearer 토큰 부착, JSON 오류 변환을 한 곳에 둔다. |
| `client/src/hooks/admin/useUsersData.ts` | 기존 사용자 목록 행에 서버 계산 잔여 이용권을 합친다. |
| `client/src/hooks/admin/useUserCredits.ts` | 한 사용자 이용권 상세·지급 이력·쿠폰 적용·직접 지급 상태를 관리한다. |
| `client/src/components/admin/users/UserCreditManagementCard.tsx` | 사용자 상세의 잔액·직접 지급·쿠폰 적용·지급 이력 UI를 담당한다. |
| `client/src/components/admin/users/CreditCouponsDialog.tsx` | Users 페이지의 쿠폰 생성·수정·비활성화 UI를 담당한다. |
| `client/src/pages/admin/users/UsersPage.tsx` | 쿠폰 관리 대화상자를 열고 기존 목록을 유지한다. |
| `client/src/components/admin/users/UsersTable.tsx` | Users 테이블의 `잔여 이용권` 열을 렌더링한다. |
| `client/src/pages/admin/users/UserDetailPage.tsx` | 사용자 상세에 이용권 관리 카드를 배치한다. |
| `client/src/pages/admin/settings/SettingsPage.tsx` | 실제 기능과 연결되지 않은 localStorage 할인 쿠폰 탭과 상태를 제거한다. |

## HTTP and Domain Interfaces

```ts
// lib/analysis-entitlements.js
type EntitlementSummary = {
  premiumEnabled: boolean;
  freeRemaining: number;
  bonusRemaining: number;
  premiumRemaining: number;
  remaining: number;
};

export async function getEntitlementSummaries(
  tx: Prisma.TransactionClient,
  userIds: string[],
): Promise<Array<{ userId: string } & EntitlementSummary>>;

export async function grantAdminCredits(tx, input: {
  userId: string;
  credits: number;
  grantedByUserId: string;
  note?: string | null;
}): Promise<EntitlementSummary>;

export async function applyCreditCoupon(tx, input: {
  userId: string;
  couponId: string;
  grantedByUserId: string;
}): Promise<EntitlementSummary>;
```

```ts
// POST /api/admin/user-credits
type UserCreditsMutation =
  | { action: "grant"; userId: string; credits: number; note?: string }
  | { action: "applyCoupon"; userId: string; couponId: string };

// GET /api/admin/user-credits?userIds=<comma-separated UUIDs>
// -> { summaries: Array<{ userId: string } & EntitlementSummary> }
// GET /api/admin/user-credits?userId=<UUID>
// -> { summary: EntitlementSummary; grants: AdminCreditGrant[] }

// GET /api/admin/credit-coupons -> { coupons: CreditCoupon[] }
// POST /api/admin/credit-coupons -> { coupon: CreditCoupon }
// PATCH /api/admin/credit-coupons -> { coupon: CreditCoupon }
```

### Task 1: Persist and calculate administrator-issued credits

**Files:**

- Create: `prisma/migrations/20260726_add_admin_credit_management/migration.sql`
- Modify: `prisma/schema.prisma:27-137`
- Modify: `lib/analysis-entitlements.js:1-145`
- Modify: `lib/analysis-entitlements.test.js:1-178`

**Interfaces:**

- Consumes: existing `AnalysisEntitlement`, `AnalysisReservation`, and `PaymentEntitlement` models plus `getLockedEntitlement(tx, userId)`.
- Produces: `getEntitlementSummary` with `bonusRemaining`; `getEntitlementSummaries`, `grantAdminCredits`, `applyCreditCoupon`; reservation source string `"bonus"`.

- [ ] **Step 1: Add failing in-memory entitlement tests for the new source and grant invariants.**

  Extend `createMemoryDatabase()` with `bonusCreditsGranted`, `creditCoupons`, and `adminCreditGrants`. Add tests that first exhaust the free credit, then assert bonus credit is reserved before premium, and that a direct grant adds `bonusRemaining` without changing `premiumRemaining`.

  ```js
  it("spends administrator-issued credits before paid credits", async () => {
    const { db } = createMemoryDatabase();
    await grantGroblePurchase(db, { providerPaymentId: "pay-1", rawEvent: {}, userId: USER_ID });
    await grantAdminCredits(db, { credits: 2, grantedByUserId: ADMIN_ID, userId: USER_ID });

    const free = await reserveAnalysis(db, USER_ID);
    await finalizeAnalysisReservation(db, free.reservationId, USER_ID);
    await expect(reserveAnalysis(db, USER_ID)).resolves.toMatchObject({ source: "bonus" });
  });

  it("adds a manual grant only to the bonus balance and audit log", async () => {
    const { db, state } = createMemoryDatabase();
    const summary = await grantAdminCredits(db, {
      credits: 3, grantedByUserId: ADMIN_ID, note: "support", userId: USER_ID,
    });

    expect(summary).toMatchObject({ bonusRemaining: 3, premiumRemaining: 0, remaining: 4 });
    expect(state.adminCreditGrants).toEqual([
      expect.objectContaining({ creditsGranted: 3, note: "support", source: "MANUAL" }),
    ]);
  });
  ```

- [ ] **Step 2: Run the entitlement unit test and confirm the new exports fail.**

  Run: `pnpm exec vitest run lib/analysis-entitlements.test.js`

  Expected: FAIL because `grantAdminCredits` does not exist and the current summary lacks `bonusRemaining`.

- [ ] **Step 3: Add the database schema, migration, and minimal domain implementation.**

  In Prisma, add `BONUS` to `AnalysisReservationSource`; add `bonusCreditsGranted Int @default(0) @map("bonus_credits_granted")` to `AnalysisEntitlement`; add `CreditCoupon` and `AdminCreditGrant` models plus `AdminCreditGrantSource { MANUAL COUPON }`; relate grants both to their recipient `User` and granting administrator `User` with explicit relation names. Use the database names `credit_coupons` and `admin_credit_grants`.

  The migration must be idempotent where PostgreSQL permits it and include all database guarantees below.

  ```sql
  ALTER TYPE analysis_reservation_source ADD VALUE IF NOT EXISTS 'BONUS';
  ALTER TABLE analysis_entitlements
    ADD COLUMN IF NOT EXISTS bonus_credits_granted INTEGER NOT NULL DEFAULT 0;
  CREATE UNIQUE INDEX IF NOT EXISTS admin_credit_grants_one_coupon_per_user
    ON admin_credit_grants (coupon_id, user_id)
    WHERE coupon_id IS NOT NULL;
  ```

  In `lib/analysis-entitlements.js`, count `BONUS` reservations alongside `FREE` and `PREMIUM`, return `bonusRemaining`, select `BONUS` after FREE in `reserveAnalysis`, and implement these transaction functions:

  ```js
  export async function grantAdminCredits(tx, { userId, credits, grantedByUserId, note = null }) {
    const entitlement = await getLockedEntitlement(tx, userId);
    await tx.analysisEntitlement.update({
      where: { userId: entitlement.userId },
      data: { bonusCreditsGranted: { increment: credits } },
    });
    await tx.adminCreditGrant.create({
      data: { userId, grantedByUserId, creditsGranted: credits, source: "MANUAL", note },
    });
    return getEntitlementSummary(tx, userId);
  }
  ```

  `applyCreditCoupon` must lock the coupon row with `FOR UPDATE`, reject inactive/expired/exhausted/redeemed coupons with named error codes, increment `usedCount`, increment the target entitlement's bonus total, create a `COUPON` grant row, and return the updated summary. `getEntitlementSummaries` must accept an empty list and otherwise bulk-read entitlements and grouped active reservations without creating or locking missing entitlement rows.

- [ ] **Step 4: Regenerate Prisma Client and run entitlement tests.**

  Run: `pnpm exec prisma generate && pnpm exec vitest run lib/analysis-entitlements.test.js`

  Expected: PASS. The test verifies `FREE → BONUS → PREMIUM`, bonus summary accounting, direct-grant auditing, and existing Groble duplicate-payment behavior.

- [ ] **Step 5: Commit the persisted entitlement domain change.**

  ```bash
  git add prisma/schema.prisma prisma/migrations/20260726_add_admin_credit_management/migration.sql lib/analysis-entitlements.js lib/analysis-entitlements.test.js
  git commit -m "feat: add administrator credit grants"
  ```

### Task 2: Expose authenticated administrator credit and coupon APIs

**Files:**

- Create: `lib/admin-auth.js`
- Create: `api/admin/user-credits.js`
- Create: `api/admin/credit-coupons.js`
- Create: `tests/api/admin/user-credits.test.js`
- Create: `tests/api/admin/credit-coupons.test.js`
- Modify: `api/admin/entitlements.js:1-62`
- Modify: `tests/api/entitlements.test.js:1-210`
- Modify: `vite.config.ts:260-300`

**Interfaces:**

- Consumes: Task 1 domain exports and `requireAuthenticatedUser(req)`.
- Produces: `requireAdministrator(req, res)`, user credit list/detail/mutation endpoints, and coupon list/create/update endpoints.

- [ ] **Step 1: Write handler tests for authorization, payload validation, and successful mutations.**

  Follow `tests/api/entitlements.test.js`'s mocked response harness. Mock `requireAdministrator`, `prisma.$transaction`, and Task 1 domain functions. Cover a non-administrator, malformed mutations, manual grants, coupon application conflict, and coupon lifecycle validation.

  ```js
  it("writes a manual grant for the verified administrator only", async () => {
    mocks.requireAdministrator.mockResolvedValue({ id: ADMIN_ID });
    mocks.grantAdminCredits.mockResolvedValue(SUMMARY);

    const response = await invokeUserCredits({
      body: { action: "grant", userId: USER_ID, credits: 2, note: "CS" },
      method: "POST",
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.grantAdminCredits).toHaveBeenCalledWith(mocks.transaction, {
      userId: USER_ID, credits: 2, note: "CS", grantedByUserId: ADMIN_ID,
    });
  });

  it("returns 409 when a coupon cannot be applied", async () => {
    mocks.applyCreditCoupon.mockRejectedValue(Object.assign(new Error("used"), { code: "COUPON_ALREADY_APPLIED" }));
    const response = await invokeUserCredits({
      body: { action: "applyCoupon", userId: USER_ID, couponId: COUPON_ID }, method: "POST",
    });
    expect(response).toMatchObject({ statusCode: 409, body: { error: "COUPON_ALREADY_APPLIED" } });
  });
  ```

- [ ] **Step 2: Run the two new handler test files and confirm they fail.**

  Run: `pnpm exec vitest run tests/api/admin/user-credits.test.js tests/api/admin/credit-coupons.test.js`

  Expected: FAIL because the handlers and shared administrator guard do not exist.

- [ ] **Step 3: Implement the administrator guard and two strict JSON handlers.**

  `lib/admin-auth.js` must return the authenticated Supabase user only after querying `prisma.user.findUnique({ select: { role: true } })`; it must send exactly 401 for no session and 403 for a non-admin role. Refactor `api/admin/entitlements.js` to use this shared helper without changing its public response shapes.

  `api/admin/user-credits.js` must parse query values from `req.query` when present or `new URL(req.url, "http://localhost")` otherwise. Implement only:

  ```js
  // GET with exactly one of userIds or userId
  // POST { action: "grant", userId, credits, note? }
  // POST { action: "applyCoupon", userId, couponId }
  ```

  Validate UUID-shaped identifiers, trim notes to 500 characters, require `Number.isInteger(credits) && credits >= 1 && credits <= 10000`, and reject extra action fields. For `userId`, select the recipient before mutation and return 404 when absent. Map the coupon domain errors `COUPON_INACTIVE`, `COUPON_EXPIRED`, `COUPON_USAGE_LIMIT_REACHED`, and `COUPON_ALREADY_APPLIED` to 409; all other unexpected errors return the existing safe 500 shape.

  `api/admin/credit-coupons.js` must normalize a new code with `trim().toUpperCase()`, enforce a 3–64 character `A-Z0-9_-` code, validate credits and optional positive `maxUses`, parse an optional ISO date, and return 409 for a unique code collision. PATCH accepts `{ id, creditsGranted?, isActive?, maxUses?, expiresAt? }`; it must reject code changes and reject a `creditsGranted` change after `usedCount > 0`.

- [ ] **Step 4: Register both handlers in the local Vite API middleware and make bearer authentication work in development.**

  Add explicit middleware entries for `/api/admin/user-credits` and `/api/admin/credit-coupons`, accepting `GET`, `POST`, and `PATCH`. Preserve the incoming query string in `request.url`, parse a JSON body only when non-empty, forward headers unchanged, and use the existing `{ status, json }` response adapter. Do not add a `vercel.json` rewrite because each endpoint maps to its own Vercel handler file.

- [ ] **Step 5: Run all affected API tests, then commit the HTTP boundary.**

  Run: `pnpm exec vitest run tests/api/entitlements.test.js tests/api/admin/user-credits.test.js tests/api/admin/credit-coupons.test.js`

  Expected: PASS. Existing entitlement responses include `bonusRemaining`; non-admin requests are rejected before any credit or coupon write is attempted.

  ```bash
  git add lib/admin-auth.js api/admin/entitlements.js api/admin/user-credits.js api/admin/credit-coupons.js vite.config.ts tests/api/entitlements.test.js tests/api/admin/user-credits.test.js tests/api/admin/credit-coupons.test.js
  git commit -m "feat: add admin credit management APIs"
  ```

### Task 3: Add a typed, authenticated browser client for the credit APIs

**Files:**

- Create: `client/src/lib/admin-credits.ts`
- Create: `client/src/lib/admin-credits.test.ts`

**Interfaces:**

- Consumes: Supabase browser session from `client/src/lib/supabase.ts` and the Task 2 API response contracts.
- Produces: `fetchUserCreditSummaries`, `fetchUserCreditDetail`, `grantUserCredits`, `applyCouponToUser`, `fetchCreditCoupons`, `createCreditCoupon`, and `updateCreditCoupon`.

- [ ] **Step 1: Write a failing client-library test for bearer headers and API errors.**

  Mock `supabase.auth.getSession` to return an access token and mock `global.fetch`. Assert that mutations use the expected path, JSON body, and `Authorization: Bearer session-token`; assert a missing session and a non-OK JSON response become readable errors.

  ```ts
  it("posts a direct grant with the active Supabase bearer token", async () => {
    mockedGetSession.mockResolvedValue({ data: { session: { access_token: "session-token" } } });
    mockedFetch.mockResolvedValue(jsonResponse({ summary: SUMMARY }));

    await grantUserCredits({ userId: USER_ID, credits: 2, note: "support" });

    expect(mockedFetch).toHaveBeenCalledWith("/api/admin/user-credits", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer session-token", "Content-Type": "application/json" }),
      body: JSON.stringify({ action: "grant", userId: USER_ID, credits: 2, note: "support" }),
    }));
  });
  ```

- [ ] **Step 2: Run the client-library test and confirm it fails before the module exists.**

  Run: `pnpm exec vitest run client/src/lib/admin-credits.test.ts`

  Expected: FAIL with a module-not-found error for `admin-credits`.

- [ ] **Step 3: Implement the API types and one authenticated JSON request helper.**

  Define `CreditSummary`, `CreditCoupon`, `AdminCreditGrant`, and `UserCreditDetail` with the snake_case fields returned by the server converted once to camelCase. `adminCreditsRequest<T>(path, init)` must obtain `session.access_token`, throw `"관리자 세션이 만료되었습니다. 다시 로그인해 주세요."` when absent, set the bearer and JSON headers, parse JSON only after checking the content type, and throw the server `error` value or a supplied Korean fallback on non-OK responses.

  Implement the exported functions with these exact request shapes:

  ```ts
  fetchUserCreditSummaries(userIds) // GET /api/admin/user-credits?userIds=<encoded comma list>
  fetchUserCreditDetail(userId)     // GET /api/admin/user-credits?userId=<encoded UUID>
  grantUserCredits({ userId, credits, note })
  applyCouponToUser({ userId, couponId })
  fetchCreditCoupons()              // GET /api/admin/credit-coupons
  createCreditCoupon(input)         // POST /api/admin/credit-coupons
  updateCreditCoupon(input)         // PATCH /api/admin/credit-coupons
  ```

- [ ] **Step 4: Run the client-library test and type-check it.**

  Run: `pnpm exec vitest run client/src/lib/admin-credits.test.ts && pnpm check`

  Expected: PASS. No request path omits the Supabase bearer token.

- [ ] **Step 5: Commit the browser API client.**

  ```bash
  git add client/src/lib/admin-credits.ts client/src/lib/admin-credits.test.ts
  git commit -m "feat: add admin credit API client"
  ```

### Task 4: Show server-calculated remaining credits in the Users table

**Files:**

- Modify: `client/src/hooks/admin/useUsersData.ts:1-151`
- Modify: `client/src/components/admin/users/UsersTable.tsx:1-201`
- Modify: `client/src/hooks/admin/adminUsersSchema.test.ts:1-25`
- Create: `client/src/hooks/admin/useUsersData.credits.test.ts`

**Interfaces:**

- Consumes: `fetchUserCreditSummaries(userIds)` from Task 3.
- Produces: `AdminUserRow.remaining_credits: number | null` and `mergeUserCreditSummaries(users, summaries)` for deterministic list mapping.

- [ ] **Step 1: Write a failing pure mapping test for missing and loaded credit summaries.**

  Export the small mapping function from `useUsersData.ts` so it can be tested without mounting React or Supabase.

  ```ts
  it("adds server totals by user ID and leaves unavailable summaries null", () => {
    expect(mergeUserCreditSummaries([baseUser(USER_ID), baseUser(SECOND_USER_ID)], [
      { userId: USER_ID, freeRemaining: 1, bonusRemaining: 2, premiumRemaining: 0, remaining: 3, premiumEnabled: false },
    ])).toEqual([
      expect.objectContaining({ id: USER_ID, remaining_credits: 3 }),
      expect.objectContaining({ id: SECOND_USER_ID, remaining_credits: null }),
    ]);
  });
  ```

- [ ] **Step 2: Run the new mapping test and confirm it fails.**

  Run: `pnpm exec vitest run client/src/hooks/admin/useUsersData.credits.test.ts`

  Expected: FAIL because `mergeUserCreditSummaries` and `remaining_credits` do not exist.

- [ ] **Step 3: Merge summaries after the existing paged Users query and render the new column.**

  Keep the existing Supabase user search, sorting, paging, analysis count, and project count queries intact. After converting the current page into `AdminUserRow[]`, call `fetchUserCreditSummaries(rows.map((row) => row.id))`; use the exported mapper to attach each `remaining_credits`. If this secured secondary request fails, preserve the loaded user rows, set the hook error to the API message, and render `–` for the unavailable balance rather than inventing a value.

  In `UsersTable`, add the header `잔여 이용권`, a right-aligned count with the `Ticket` icon, and a skeleton cell. Render the new column on `xl` and wider screens so the existing responsive columns and `colSpan={7}` become `colSpan={8}`.

- [ ] **Step 4: Update the schema-usage regression check and run list tests.**

  Extend `adminUsersSchema.test.ts` to assert the list hook imports `fetchUserCreditSummaries` and continues to select the real `avatar_url` column. Do not replace the existing client-side `users` query with a client write.

  Run: `pnpm exec vitest run client/src/hooks/admin/useUsersData.credits.test.ts client/src/hooks/admin/adminUsersSchema.test.ts`

  Expected: PASS. One API summary row changes only its matching table row.

- [ ] **Step 5: Commit the Users list balance display.**

  ```bash
  git add client/src/hooks/admin/useUsersData.ts client/src/hooks/admin/useUsersData.credits.test.ts client/src/hooks/admin/adminUsersSchema.test.ts client/src/components/admin/users/UsersTable.tsx
  git commit -m "feat: show user credit balances in admin"
  ```

### Task 5: Manage direct grants and free-credit coupons from Users

**Files:**

- Create: `client/src/hooks/admin/useUserCredits.ts`
- Create: `client/src/components/admin/users/UserCreditManagementCard.tsx`
- Create: `client/src/components/admin/users/CreditCouponsDialog.tsx`
- Create: `client/src/pages/admin/users/UserCredits.ui.test.ts`
- Modify: `client/src/pages/admin/users/UserDetailPage.tsx:1-420`
- Modify: `client/src/pages/admin/users/UsersPage.tsx:1-164`
- Modify: `client/src/pages/admin/settings/SettingsPage.tsx:1-640`

**Interfaces:**

- Consumes: Task 3 typed client functions and `UserCreditDetail`/`CreditCoupon` types.
- Produces: a detail-page `분석 이용권 관리` card and a Users-page `무료 이용권 쿠폰 관리` dialog.

- [ ] **Step 1: Write failing source-level UI regression tests for the required controls.**

  The project does not include a DOM testing library for these admin pages, so keep these tests focused on externally visible component contracts and use `readFileSync` like the existing admin tests.

  ```ts
  it("keeps credit granting and coupon application in the user detail page", () => {
    const page = read("client/src/pages/admin/users/UserDetailPage.tsx");
    const card = read("client/src/components/admin/users/UserCreditManagementCard.tsx");
    expect(page).toContain("UserCreditManagementCard");
    expect(card).toContain("직접 지급");
    expect(card).toContain("쿠폰 적용");
    expect(card).toContain("지급 이력");
  });

  it("moves coupon management out of Settings into Users", () => {
    expect(read("client/src/pages/admin/users/UsersPage.tsx")).toContain("무료 이용권 쿠폰 관리");
    expect(read("client/src/pages/admin/settings/SettingsPage.tsx")).not.toContain("passmate_admin_coupons");
  });
  ```

- [ ] **Step 2: Run the UI contract test and confirm it fails.**

  Run: `pnpm exec vitest run client/src/pages/admin/users/UserCredits.ui.test.ts`

  Expected: FAIL because the card, dialog, and Users header action do not exist.

- [ ] **Step 3: Implement the focused hook and two components.**

  `useUserCredits(userId)` loads `fetchUserCreditDetail(userId)` and `fetchCreditCoupons()` in parallel, returns `{ detail, coupons, isLoading, error, refresh, grant, applyCoupon }`, prevents an operation from leaving stale detail data by calling `refresh()` after a successful mutation, and exposes the server error text without catching it as a success.

  `UserCreditManagementCard` receives that hook result and renders the total and three named balances. Its direct grant form uses a number input with `min={1}` and `max={10000}`, optional 500-character memo, a submitting-disabled button labelled `직접 지급`, and a confirmation dialog before calling `grant`. Its coupon selector excludes inactive, expired, and exhausted coupons; applying a selection also asks for confirmation before calling `applyCoupon`. Below it, render the latest grants with source, credits, coupon code, memo, manager email, and timestamp. Display a loading skeleton, an empty-history state, and the API error state separately.

  `CreditCouponsDialog` receives `coupons`, `onCreate`, and `onUpdate`. It provides controlled fields for code, free analysis count, optional max uses, optional expiry, and active state. The list includes code, credits, `usedCount / maxUses` (or `무제한`), expiry, and an active toggle; disable the credits field for coupons whose `usedCount` is nonzero. It must not display a discount percentage field.

- [ ] **Step 4: Wire the components into Users pages and remove the obsolete mock discount coupon tab.**

  In `UserDetailPage`, render the credit management card immediately after the four statistics cards so it is within the existing Users detail flow. In `UsersPage`, add an `AdminPageHeader.actions` button labelled `무료 이용권 쿠폰 관리`; use `CreditCouponsDialog` to create/update coupons and reload its list after successful changes.

  In `SettingsPage`, remove `CouponItem`, `COUPONS_KEY`, defaults, coupon state, localStorage load/save handlers, the coupon tab trigger/content, and the unused `Ticket` import. Change the tab layout from five to four columns without altering general, notices, feature flag, or administrator controls.

- [ ] **Step 5: Run UI checks, type-check, and commit the Users management flow.**

  Run: `pnpm exec vitest run client/src/pages/admin/users/UserCredits.ui.test.ts client/src/hooks/admin/useUsersData.credits.test.ts client/src/hooks/admin/adminUsersSchema.test.ts && pnpm check`

  Expected: PASS. The only coupon UI is the free-credit Users flow; no Settings localStorage discount coupon remains.

  ```bash
  git add client/src/hooks/admin/useUserCredits.ts client/src/components/admin/users/UserCreditManagementCard.tsx client/src/components/admin/users/CreditCouponsDialog.tsx client/src/pages/admin/users/UserCredits.ui.test.ts client/src/pages/admin/users/UserDetailPage.tsx client/src/pages/admin/users/UsersPage.tsx client/src/pages/admin/settings/SettingsPage.tsx
  git commit -m "feat: manage user credits and coupons in admin"
  ```

### Task 6: Verify the completed feature without touching unrelated work

**Files:**

- Modify only if a verification failure proves a defect in the files from Tasks 1–5.

**Interfaces:**

- Consumes: all completed feature files and their test suites.
- Produces: evidence that the schema, server, list, and management UI compile and satisfy the agreed constraints.

- [ ] **Step 1: Run the full focused regression suite.**

  Run:

  ```bash
  pnpm exec vitest run \
    lib/analysis-entitlements.test.js \
    tests/api/entitlements.test.js \
    tests/api/admin/user-credits.test.js \
    tests/api/admin/credit-coupons.test.js \
    client/src/lib/admin-credits.test.ts \
    client/src/hooks/admin/useUsersData.credits.test.ts \
    client/src/hooks/admin/adminUsersSchema.test.ts \
    client/src/pages/admin/users/UserCredits.ui.test.ts
  ```

  Expected: PASS. This confirms payment credits remain idempotent, bonus credits are reserved in the correct order, and every grant/coupon endpoint is administrator-only.

- [ ] **Step 2: Run project type and production-build verification.**

  Run: `pnpm check && pnpm build`

  Expected: PASS. Resolve only failures caused by this feature; report pre-existing unrelated failures with their command output.

- [ ] **Step 3: Inspect the working tree before the final handoff.**

  Run: `git status --short && git log --oneline -5`

  Expected: feature commits are present; no unrelated existing modification has been staged, reverted, or included in a feature commit.
