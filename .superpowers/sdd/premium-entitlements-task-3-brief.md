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

