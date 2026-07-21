# Task 3: Groble Webhook Granting Report

## Status

Completed the deployable Groble webhook receiver and Vite development mount. The receiver is intentionally fail-closed until Groble's actual test payload and signature scheme are observed and documented.

## Implemented Files

- `api/webhooks/groble.js`
  - Adds the Vercel `POST /api/webhooks/groble` function.
  - Exposes `parseGroblePaidEvent(body, headers)` as the sole provider-specific boundary.
  - Treats non-object request bodies as malformed (`400`).
  - Treats every currently unrecognized object as an unknown event (`204`) and never grants credits.
  - Provides a provider-neutral, dependency-injectable handler factory for testing verified events without inventing Groble field names.
  - Resolves a parsed `purchaseIntentId` to the stored user, calls `grantGroblePurchase` inside a Prisma transaction, marks the intent `PAID`, and returns the newly granted credit count.
  - Returns `422` for unlinked or unusable purchase intents. A second distinct payment against an already paid intent is rejected and transactionally rolled back.
  - Emits only safe structured diagnostics: a correlation ID, hashes of payment/intent IDs when available, and top-level field names. It never logs headers, payload values, webhook secrets, or raw event data.
- `api/webhooks/groble.test.js`
  - Covers one grant, idempotent retry output, unknown plausible fields, malformed input, unlinked events with redacted diagnostics, and non-POST requests.
- `vite.config.ts`
  - Mounts `/api/webhooks/groble` in Vite and forwards headers/body to the same handler.
  - Lets malformed JSON reach the handler as a `400` instead of converting it to a development-server `500`.
- `.env.example`
  - Documents server-only `SUPABASE_SERVICE_ROLE_KEY`, `GROBLE_WEBHOOK_SECRET`, `GROBLE_PAYMENT_URL`, and the deployed Groble webhook URL.

## Groble Contract Safety

No payment field names, event labels, signature header names, signing algorithm, or canonical request format were assumed. In particular, a payload containing plausible `event`, `paymentId`, and `purchaseIntentId` keys cannot grant credits. This avoids creating a silent unauthenticated credit path from guessed provider semantics.

After a Groble test-send is available, update only `parseGroblePaidEvent` and its focused tests with the observed contract. It must:

1. Verify the documented signed header using `GROBLE_WEBHOOK_SECRET` before parsing a paid event.
2. Recognize only Groble's documented `일반결제 완료` event.
3. Require the provider payment ID and the trusted purchase-intent correlation identifier.
4. Return a minimal/sanitized `rawEvent` object, never credentials or unneeded customer data.

Until then, valid JSON is acknowledged with `204` and recorded safely in deployment logs for admin review; invalid JSON receives `400`; no request can reach `grantGroblePurchase` through the production parser.

## Verification

- RED: `pnpm exec vitest run api/webhooks/groble.test.js` failed before the receiver existed with `Failed to load url ./groble.js`.
- GREEN: `pnpm exec vitest run api/webhooks/groble.test.js` passed: 6 tests.
- Regression: `pnpm exec vitest run lib/analysis-entitlements.test.js api/entitlements.test.js api/webhooks/groble.test.js` passed: 18 tests across 3 files.
- Vite smoke test on `http://127.0.0.1:5174/api/webhooks/groble`:
  - Unknown JSON payload: `204 No Content`.
  - Malformed JSON payload: `400 Bad Request` with `MALFORMED_GROBLE_PAYLOAD`.
- `pnpm run check` remains blocked by unrelated existing TypeScript errors in `client/src/components/FeedbackSection.tsx:216` and `client/src/components/ProcessSection.tsx:95`.

## Remaining Operational Requirement

Configure Groble to deliver its `일반결제 완료` test event to:

`https://passmate-gamma.vercel.app/api/webhooks/groble`

Do not enable Premium sales or automatic granting until the test payload and authenticated signature contract have been captured, reviewed, and encoded in the adapter with additional tests.
