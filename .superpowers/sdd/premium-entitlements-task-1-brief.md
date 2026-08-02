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

