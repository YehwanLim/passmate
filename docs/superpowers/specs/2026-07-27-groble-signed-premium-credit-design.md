# Groble signed premium-credit webhook design

**Date:** 2026-07-27
**Status:** Approved design — awaiting implementation approval

## Goal

When a buyer completes the designated Groble premium product purchase, grant that
buyer exactly three analysis credits in Passmate. A Groble delivery retry or a
maliciously crafted request must never grant credits twice or to the wrong user.

## Scope

- Create Groble checkout links with an opaque Passmate purchase-intent UUID in
  the `ref` query parameter.
- Verify the Groble webhook signature and timestamp from the unmodified request
  body before parsing JSON.
- Accept only the configured premium product's `payment.completed` event and
  atomically grant the purchase-intent owner's credits.
- Keep the existing `PaymentEntitlement.providerPaymentId` uniqueness constraint
  as the durable duplicate-grant guard.

## Non-goals

- Refund, cancellation, subscription, and recurring-payment entitlement changes.
- A new payment provider UI or a database schema migration.
- Logging raw request bodies, secrets, or buyer personal information.

## Provider contract

The handler follows Groble's [webhook guide](https://www.groble.im/help/guides/webhook):

- Groble signs the exact raw request body as
  `HEX(HMAC-SHA256(secret, "{timestamp}.{raw_body}"))`.
- `X-Groble-Signature` and `X-Groble-Timestamp` are mandatory; timestamps are
  accepted only within five minutes of the server clock.
- `X-Groble-Idempotency-Key` is a delivery identifier and may be included in
  privacy-safe diagnostics, but is not the entitlement idempotency boundary.
- The seller checkout reference returns in `data.object.sellerReference`.
- The provider's `data.object.merchantUid` identifies the payment and must be
  retained as the entitlement provider-payment ID.
- A successful delivery receives a 2xx response. Retryable unexpected failures
  receive 5xx so Groble can retry.

## Configuration

Production Vercel configuration must contain the following backend-only values:

| Variable | Purpose |
| --- | --- |
| `GROBLE_WEBHOOK_SECRET` | Active Groble webhook signing secret; mark Sensitive and never expose it to the browser. |
| `GROBLE_PREMIUM_CONTENT_ID` | Exact Groble `data.object.content.id` that is allowed to grant this premium package. |

During a future Groble secret rotation, the implementation may additionally read
a previous-secret variable and accept its signature for Groble's 24-hour rotation
window. That compatibility variable is intentionally not required for the first
secure release.

## Data flow

1. The existing purchase-intent endpoint authenticates the Passmate user and
   creates a `PENDING` `PurchaseIntent`.
2. It builds the configured Groble payment URL with `ref=<PurchaseIntent.id>`.
   The UUID is opaque, URL-safe, and contains no customer information. Existing
   payment URL query parameters are preserved.
3. Groble sends the webhook. The server reads the raw bytes, requires a valid
   HMAC signature and a timestamp within five minutes, then parses the JSON.
4. The server accepts only `payment.completed`, then requires non-empty
   `merchantUid`, `sellerReference`, and `content.id`; `content.id` must equal
   `GROBLE_PREMIUM_CONTENT_ID`.
5. In one database transaction, the server finds the referenced purchase intent
   and its user, checks it is `PENDING` or already `PAID`, and grants the
   existing configured premium-credit amount (currently three) through the
   existing entitlement helper. It records `merchantUid` as the provider payment
   identifier and marks the intent paid.
6. A second delivery for the same `merchantUid` is treated as an already
   processed success: it returns 200 without adding credits again. This remains
   safe even if Groble retries after a successful response was lost.

The `sellerReference` is deliberately treated as untrusted routing data: it links
the purchase to a user only after the provider signature and product identity
have been validated. The unique provider payment ID remains the final durable
credit-grant idempotency barrier.

## HTTP responses and diagnostics

| Condition | Response | Effect |
| --- | --- | --- |
| Valid new payment or recognized duplicate | 200 | Grant once, or report the duplicate without another grant. |
| Missing, invalid, or stale signature/timestamp | 401 | No parsing or database access. |
| Signed but malformed payload or unsupported event type | 400 | No database update. |
| Signed payment for wrong product, missing/unlinked reference, or invalid intent state | 422 | No credit grant; privacy-safe warning log. |
| Unexpected infrastructure or database failure | 500 | No success acknowledgment, allowing Groble to retry. |

Logs include an event correlation value, event type, safe key names, and a
one-way hash/length for identifiers when useful. They must not include the raw
body, webhook secret, email address, phone number, or full payment reference.

## Implementation outline

- Add a small Groble webhook-verification utility that reads raw Vercel request
  bytes and compares HMAC values using a timing-safe comparison.
- Update `api/webhooks/groble.js` to verify before JSON parsing and to map the
  documented payment fields into the existing purchase and entitlement service.
- Update checkout URL construction in the purchase-intent flow to append or
  replace `ref` with the created intent UUID.
- Extend API tests with valid signed payloads and failure/duplicate cases; mocks
  will cover database and provider boundaries without any live calls.
- Preserve the endpoint's no-redirect behavior and complete promptly so Groble
  can apply its delivery/retry policy correctly.

## Verification plan

- A signed valid payment for the configured product grants exactly three credits
  to the purchase-intent owner and marks the intent paid.
- Bad signature and stale timestamp both receive 401 before JSON/DB processing.
- Unsupported event, malformed fields, wrong product, unknown reference, and
  invalid intent state grant nothing.
- Replaying the same `merchantUid` produces 200 but leaves credits unchanged.
- Checkout URL creation preserves existing query values and writes the intent
  UUID as `ref`.
- Run the focused webhook and purchase-intent tests, then the relevant type check
  if TypeScript code changes.

## Production rollout and manual acceptance

1. Add `GROBLE_WEBHOOK_SECRET` (Sensitive) and the exact
   `GROBLE_PREMIUM_CONTENT_ID` to Vercel Production, then redeploy.
2. In Groble, configure the production endpoint
   `https://passmate-gamma.vercel.app/api/webhooks/groble` without a redirect.
3. Start a premium purchase while authenticated and confirm the generated Groble
   URL includes an opaque `ref` UUID.
4. Complete a real or provider-supported test payment. Confirm the buyer's
   account increases by exactly three analysis credits.
5. Redeliver the same webhook from Groble and confirm the response succeeds but
   the credit balance does not increase a second time.

## Trade-off

This design uses the existing unique provider payment identifier instead of a new
webhook-delivery table. It is the smallest durable solution for the business
invariant (one credit grant per provider payment). It does not retain a complete
history of every individual Groble retry, which is unnecessary for the requested
credit behavior and avoids an otherwise unrelated schema change.
