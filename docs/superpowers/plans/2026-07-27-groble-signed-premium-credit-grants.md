# Groble Signed Premium-Credit Grants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grant a verified Groble premium payment's buyer exactly three analysis credits, once, through a signed webhook and an opaque purchase reference.

**Architecture:** The authenticated purchase-intent API appends its newly created UUID to the configured Groble checkout URL as `ref`. The Vercel webhook reads the exact raw request body, verifies Groble's timestamped HMAC before parsing JSON, validates the product/reference, and atomically claims the pending intent before delegating the one-time credit grant to the existing entitlement service. The existing unique `PaymentEntitlement.providerPaymentId` remains the durable retry guard.

**Tech Stack:** Vercel Node serverless API, ESM JavaScript, Node `crypto`, Prisma/PostgreSQL, Vite development middleware, Vitest, pnpm.

## Global Constraints

- Use pnpm; do not add dependencies or alter `pnpm-lock.yaml`.
- `GROBLE_WEBHOOK_SECRET` is server-only, must never be logged or exposed through a `VITE_` variable.
- Verify `X-Groble-Signature` over the exact `"{timestamp}.{raw_body}"` before JSON parsing; accept timestamps only within five minutes.
- Accept only `payment.completed` with an exact `GROBLE_PREMIUM_CONTENT_ID`; never infer payment success from similarly named fields.
- Link a webhook only through the opaque, authenticated `PurchaseIntent.id` passed as Groble `ref`; do not accept a user ID from the provider payload.
- Return 200 for a newly granted payment and a known duplicate; return 401 for signature/timestamp failure, 400 for signed malformed/unsupported payloads, 422 for signed unlinked/wrong-product/invalid-state events, and 500 for unexpected failures.
- Do not log or persist buyer email, phone number, raw request body, or webhook secrets.
- Preserve unrelated working-tree changes; implementation runs only in the isolated `codex/groble-signed-credits` worktree.

---

## File structure

| File | Responsibility |
| --- | --- |
| `api/entitlements.js` | Creates an authenticated pending intent and returns a Groble checkout URL that contains that intent as `ref`. |
| `tests/api/entitlements.test.js` | Verifies checkout URL reference insertion while preserving existing URL query parameters. |
| `lib/groble-webhook.js` | Parses only verified raw Groble deliveries and exposes webhook errors plus a raw request-body reader. |
| `lib/groble-webhook.test.js` | Exercises HMAC, timestamp, malformed JSON, and raw-stream behavior without any network call. |
| `api/webhooks/groble.js` | Validates product/reference, atomically claims the purchase intent, calls the existing entitlement grant, and emits privacy-safe diagnostics. |
| `tests/api/webhooks/groble.test.js` | Covers signed success, invalid signature/timestamp, payload/product/reference rejection, and duplicate delivery behavior. |
| `vite.config.ts` | Supplies the unmodified webhook request text to the same handler during local development. |
| `.env.example` | Documents the non-secret name of the required product-ID setting and the active webhook secret placeholder. |

## Task 1: Bind each checkout session to its authenticated purchase intent

**Files:**
- Modify: `tests/api/entitlements.test.js:131-157`
- Modify: `api/entitlements.js:45-70`

**Interfaces:**
- Consumes: a successful `prisma.purchaseIntent.create()` result containing `id` and `settings.groblePaymentUrl`.
- Produces: `POST /api/entitlements/purchase-intents` response `{ purchaseIntentId, checkoutUrl }`, where `checkoutUrl` contains exactly one `ref=<purchaseIntentId>` query parameter.

- [x] **Step 1: Write the failing checkout-reference test**

Replace the successful intent fixture URL with a URL that already has a query parameter, then assert that the response preserves it and adds the intent reference:

```js
mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
  groblePaymentUrl: "https://payments.groble.example/checkout?campaign=summer",
  premiumEnabled: true,
});

expect(response.body).toEqual({
  checkoutUrl: "https://payments.groble.example/checkout?campaign=summer&ref=purchase-intent-1",
  purchaseIntentId: "purchase-intent-1",
});
```

- [x] **Step 2: Run the targeted test and verify RED**

Run: `pnpm exec vitest run tests/api/entitlements.test.js`

Expected: the purchase-intent test fails because `checkoutUrl` is still the configured URL without `ref`.

- [x] **Step 3: Build the checkout URL from the created intent**

In `createPurchaseIntent`, construct a `URL` from `settings.groblePaymentUrl`, set the reference after `purchaseIntent` is created, and return the serialized URL:

```js
const checkoutUrl = new URL(settings.groblePaymentUrl);
checkoutUrl.searchParams.set("ref", purchaseIntent.id);

return res.status(201).json({
  purchaseIntentId: purchaseIntent.id,
  checkoutUrl: checkoutUrl.toString(),
});
```

If the configured URL is invalid, let the existing top-level error path return 500 rather than creating an unlinked purchase intent response.

- [x] **Step 4: Run the targeted test and verify GREEN**

Run: `pnpm exec vitest run tests/api/entitlements.test.js`

Expected: all entitlement API tests pass, including the URL-reference assertion.

- [x] **Step 5: Commit the self-contained checkout binding**

```bash
git add api/entitlements.js tests/api/entitlements.test.js
git commit -m "feat: reference Groble checkout purchase intents"
```

## Task 2: Create a raw-body Groble signature boundary

**Files:**
- Create: `lib/groble-webhook.js`
- Create: `lib/groble-webhook.test.js`

**Interfaces:**
- Produces `GrobleWebhookError(code, statusCode)` for known request failures.
- Produces `parseVerifiedGrobleWebhook({ headers, now, rawBody, secret })`, which returns a parsed object only after HMAC and timestamp verification.
- Produces `readGrobleRawBody(req)`, which returns the original UTF-8 byte sequence as a string from either a test/local `req.rawBody` value or a Node request stream.

- [x] **Step 1: Write failing HMAC, timestamp, and raw-stream tests**

Create a fixture helper that creates the documented Groble signature, then test all boundaries with real `node:crypto` HMAC output:

```js
const rawBody = JSON.stringify({ data: { object: {} }, type: "payment.completed" });
const timestamp = "1785091200";
const signature = createHmac("sha256", "webhook-secret")
  .update(`${timestamp}.${rawBody}`)
  .digest("hex");

expect(parseVerifiedGrobleWebhook({
  headers: { "x-groble-signature": signature, "x-groble-timestamp": timestamp },
  now: Number(timestamp) * 1000,
  rawBody,
  secret: "webhook-secret",
})).toEqual(JSON.parse(rawBody));

expect(() => parseVerifiedGrobleWebhook({
  headers: { "x-groble-signature": "not-a-signature", "x-groble-timestamp": timestamp },
  now: Number(timestamp) * 1000,
  rawBody,
  secret: "webhook-secret",
})).toThrowObject({ code: "GROBLE_WEBHOOK_SIGNATURE_INVALID", statusCode: 401 });
```

Add cases for a timestamp more than 300 seconds old, a missing secret, malformed JSON after a valid signature, and a `Readable.from([rawBody])` request that returns the same raw text.

- [x] **Step 2: Run the utility test and verify RED**

Run: `pnpm exec vitest run lib/groble-webhook.test.js`

Expected: the test fails because `lib/groble-webhook.js` does not yet exist.

- [x] **Step 3: Implement strict verification before JSON parsing**

Implement the module with the following essential behavior:

```js
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

export function parseVerifiedGrobleWebhook({ headers, now = Date.now(), rawBody, secret }) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new GrobleWebhookError("GROBLE_WEBHOOK_NOT_CONFIGURED", 500);
  }

  const timestamp = getSingleHeader(headers, "x-groble-timestamp");
  const signature = getSingleHeader(headers, "x-groble-signature");
  if (!isUnixSeconds(timestamp) || typeof signature !== "string") {
    throw new GrobleWebhookError("GROBLE_WEBHOOK_SIGNATURE_INVALID", 401);
  }
  if (Math.abs(now - Number(timestamp) * 1000) > MAX_TIMESTAMP_SKEW_MS) {
    throw new GrobleWebhookError("GROBLE_WEBHOOK_TIMESTAMP_INVALID", 401);
  }
  assertTimingSafeSignature(secret, `${timestamp}.${rawBody}`, signature);
  return parseObjectJson(rawBody);
}
```

`assertTimingSafeSignature` must compare same-length Buffers with `timingSafeEqual`; a mismatch throws `GROBLE_WEBHOOK_SIGNATURE_INVALID` (401). `parseObjectJson` must reject invalid JSON, arrays, and primitive JSON with `MALFORMED_GROBLE_PAYLOAD` (400). `readGrobleRawBody` must concatenate stream chunks without normalizing whitespace or reparsing JSON.

- [x] **Step 4: Run the utility test and verify GREEN**

Run: `pnpm exec vitest run lib/groble-webhook.test.js`

Expected: all signature, timestamp, malformed payload, and stream tests pass.

- [x] **Step 5: Commit the verified parsing boundary**

```bash
git add lib/groble-webhook.js lib/groble-webhook.test.js
git commit -m "feat: verify signed Groble webhook bodies"
```

## Task 3: Grant credits only for a claimed, configured Groble payment

**Files:**
- Modify: `tests/api/webhooks/groble.test.js:1-230`
- Modify: `api/webhooks/groble.js:1-188`

**Interfaces:**
- Consumes: `readGrobleRawBody` and `parseVerifiedGrobleWebhook` from `lib/groble-webhook.js`; `GROBLE_WEBHOOK_SECRET`; `GROBLE_PREMIUM_CONTENT_ID`; `grantGroblePurchase(tx, { providerPaymentId, rawEvent, userId })`.
- Produces: `POST /api/webhooks/groble` responses as specified in Global Constraints, and only sanitized provider metadata is stored in `PaymentEntitlement.rawEvent`.

- [x] **Step 1: Write failing signed-handler tests**

Replace the parser-injection fixture with a signed raw Groble event fixture:

```js
const payload = {
  id: "evt_123",
  type: "payment.completed",
  data: {
    object: {
      buyer: { email: "buyer@example.com", phoneNumber: "010-1234-5678" },
      content: { id: "premium-product-id" },
      merchantUid: "merchant-123",
      payment: { purchasedAt: "2026-07-27T00:00:00.000Z" },
      sellerReference: "11111111-1111-4111-8111-111111111111",
    },
  },
};
```

Inject a fixed `now`, webhook secret, product ID, and raw-body reader into `createGrobleWebhookHandler`. Assert 200 with `{ ok: true, grantedCredits: 3 }`, an atomic pending-intent claim, and an entitlement call whose `rawEvent` contains only event ID/type/content ID/merchant UID/purchase time — never `buyer` or `sellerReference`.

Add independent tests that assert no grant for: altered signature (401), stale timestamp (401), a signed unsupported type (400), a signed malformed paid event (400), a signed wrong product (422), an unknown reference (422), and a cancelled intent (422). Add two duplicate tests: the same merchant UID returns 200 with zero credits, while a new merchant UID for an already-paid intent returns 422 without calling `grantGroblePurchase`.

- [x] **Step 2: Run the webhook test and verify RED**

Run: `pnpm exec vitest run tests/api/webhooks/groble.test.js`

Expected: the signed happy-path test fails because the current parser intentionally returns `null` and no signature verification exists.

- [x] **Step 3: Replace the fail-closed placeholder with the documented event mapping**

Make the handler read the raw request first, verify and parse it through the new library, then accept only the exact provider shape:

```js
const body = parseVerifiedGrobleWebhook({ headers: req.headers, now: now(), rawBody, secret: webhookSecret });
if (body.type !== "payment.completed") {
  throw new GrobleWebhookError("UNSUPPORTED_GROBLE_EVENT", 400);
}
const object = body.data?.object;
if (!isRecord(object) || !nonEmptyString(object.content?.id) ||
    !nonEmptyString(object.merchantUid) || !nonEmptyString(object.sellerReference)) {
  throw new GrobleWebhookError("MALFORMED_GROBLE_PAID_EVENT", 400);
}
if (object.content.id !== premiumContentId) {
  throw new GrobleWebhookError("UNEXPECTED_GROBLE_PRODUCT", 422);
}
```

Keep malformed fields and wrong products distinct: malformed/missing `content.id` is 400; a present but non-matching product is 422. Preserve the existing privacy-safe diagnostic helpers, but pass the parsed body only after verification.

Inside one Prisma transaction, read the intent owner/status, reject `CANCELLED`, then claim a pending intent with:

```js
const claim = await tx.purchaseIntent.updateMany({
  where: { id: purchaseIntent.id, status: "PENDING" },
  data: { status: "PAID" },
});
```

When `claim.count` is zero, look up `tx.paymentEntitlement.findUnique({ where: { providerPaymentId } })`. A known payment ID is a 200 duplicate with zero credits; an unknown ID is `PURCHASE_INTENT_ALREADY_PAID` (422). When the claim succeeds, call `grantGroblePurchase` with sanitized event metadata. Any error rolls back the prior status update. Remove the old 204 unrecognized-event success path so unsigned payloads can never receive a success acknowledgment.

- [x] **Step 4: Run the webhook test and verify GREEN**

Run: `pnpm exec vitest run tests/api/webhooks/groble.test.js`

Expected: all signed happy-path, rejection, safe-diagnostic, and duplicate-delivery cases pass.

- [x] **Step 5: Commit the credit-grant integration**

```bash
git add api/webhooks/groble.js tests/api/webhooks/groble.test.js
git commit -m "feat: grant credits from verified Groble payments"
```

## Task 4: Preserve raw delivery bytes in deployed and local routes

**Files:**
- Modify: `vite.config.ts:163-216`
- Modify: `.env.example:5-10`
- Test: `lib/groble-webhook.test.js`

**Interfaces:**
- Consumes: Vercel's unparsed Node request and Vite's captured string.
- Produces: a request object for the shared handler with `rawBody` exactly equal to the delivered UTF-8 request text.

- [x] **Step 1: Write the failing raw-body integration assertion**

Extend the stream test to prove its returned raw text is signature-sensitive rather than reconstructed JSON:

```js
const rawBody = '{"type":"payment.completed", "data": {"object": {}}}';
const request = Readable.from([Buffer.from(rawBody)]);
await expect(readGrobleRawBody(request)).resolves.toBe(rawBody);
```

Use this whitespace-preserving string with a valid HMAC in `parseVerifiedGrobleWebhook`; replacing it with `JSON.stringify(JSON.parse(rawBody))` must produce `GROBLE_WEBHOOK_SIGNATURE_INVALID`.

- [x] **Step 2: Run the utility test and verify RED**

Run: `pnpm exec vitest run lib/groble-webhook.test.js`

Expected: the new whitespace/signature regression fails until the raw reader preserves the exact body.

- [x] **Step 3: Wire raw bytes through Vercel and Vite**

Export Vercel configuration from `api/webhooks/groble.js`:

```js
export const config = {
  api: { bodyParser: false },
};
```

In the Vite Groble middleware, keep the existing collected `rawBody`, but pass it directly as `rawBody` to the handler and remove the pre-parsed `body` argument. This makes local testing use the same verification order as Vercel. Update `.env.example` to keep the secret placeholder and add:

```dotenv
# Exact data.object.content.id permitted to grant premium analysis credits.
GROBLE_PREMIUM_CONTENT_ID=<groble-premium-content-id>
```

- [x] **Step 4: Run focused tests and static checking**

Run: `pnpm exec vitest run lib/groble-webhook.test.js tests/api/webhooks/groble.test.js tests/api/entitlements.test.js && pnpm check`

Expected: all focused tests and TypeScript checking pass. Do not run `pnpm build` unless `DATABASE_URL` is actually available; the build precheck must not receive invented credentials.

- [x] **Step 5: Commit runtime wiring and configuration contract**

```bash
git add vite.config.ts .env.example lib/groble-webhook.test.js
git commit -m "chore: preserve Groble webhook raw bodies"
```

## Task 5: Verify the full feature and prepare production acceptance

**Files:**
- Review: `docs/superpowers/specs/2026-07-27-groble-signed-premium-credit-design.md`
- Review: `.env.example`

**Interfaces:**
- Consumes: all code and tests from Tasks 1-4.
- Produces: evidence-backed release notes and the manual Vercel/Groble test sequence, without revealing any secret value.

- [x] **Step 1: Run all payment-related tests**

Run: `pnpm exec vitest run lib/groble-webhook.test.js tests/api/webhooks/groble.test.js tests/api/entitlements.test.js lib/analysis-entitlements.test.js`

Expected: all selected files pass with no test failures.

- [x] **Step 2: Inspect the exact final diff and working tree**

Run: `git diff main...HEAD --check && git diff main...HEAD --stat && git status --short`

Expected: no whitespace errors; only the planned files are changed in this worktree.

- [x] **Step 3: Confirm requirement coverage before release**

Check each item against test output and code: checkout ref, raw HMAC/timestamp verification, product match, unlinked rejection, atomic pending claim, provider-ID duplicate response, no buyer PII in logs/audit payload, Vercel raw-body configuration, Vite parity, and both production environment variable names.

- [ ] **Step 4: Provide manual production acceptance steps**

Set `GROBLE_WEBHOOK_SECRET` as Sensitive and `GROBLE_PREMIUM_CONTENT_ID` in Vercel Production, deploy the implementation, then create an authenticated checkout intent. Verify its Groble URL has `ref=<UUID>`, complete a test payment, confirm that exact buyer has three new credits, and redeliver the exact same event to confirm no second credit grant. Do not paste secrets or full buyer data into chat or logs.

## Plan self-review

**Spec coverage:** Task 1 implements checkout references. Task 2 implements raw HMAC/timestamp verification before parsing. Task 3 validates event/product/reference, atomically grants credits, preserves provider-payment idempotency, defines all HTTP failures, and keeps PII out of audit/log data. Task 4 configures Vercel/Vite raw-body delivery and documents both required environment names. Task 5 verifies code-level requirements and the manual production replay test. No schema migration is required because the payment-ID unique constraint plus the atomic `PENDING` claim handles delivery retries and a reused intent.

**Placeholder scan:** The plan contains no deferred implementation placeholders.

**Type consistency:** `parseVerifiedGrobleWebhook`, `readGrobleRawBody`, `GrobleWebhookError`, `providerPaymentId`, `purchaseIntentId`, and `GROBLE_PREMIUM_CONTENT_ID` have one spelling and role throughout the plan.
