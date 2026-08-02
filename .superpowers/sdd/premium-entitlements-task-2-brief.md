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

