# Admin premium sales control design

**Date:** 2026-08-02
**Status:** Approved design — awaiting written-spec review

## Goal

Let an authenticated administrator control whether new Groble premium checkout
sessions can begin, from the existing `/admin/payments` page. Turning sales off
must never remove credits that were already granted or reject a valid payment
webhook for an existing purchase.

## Current state

- `api/admin/entitlements.js` already provides administrator-only `GET` and
  `PATCH` access to the persisted `EntitlementSetting.premiumEnabled` flag.
- `api/entitlements.js` already returns `403 PREMIUM_SALES_DISABLED` before it
  creates a purchase intent when that flag is off.
- `/admin/payments` is an empty placeholder, so administrators cannot use the
  existing server-side control.
- `/admin/settings` has a local-storage-only `paymentModule` demo toggle. It
  does not change the database flag or the checkout API and would be misleading
  if left available beside the real control.

## Scope

- Add a persisted premium-sales control card to `/admin/payments`.
- Read and update the existing administrator-protected entitlement endpoint.
- Require confirmation before an administrator turns sales off.
- Remove the misleading local-only payment-module switch from `/admin/settings`.
- Push the verified implementation to `main`, deploy through Vercel, and run
  the manual Groble acceptance sequence after required production variables are
  configured.

## Non-goals

- Refunds, chargebacks, subscription state, or revoking already granted credits.
- Changing the Groble webhook grant logic, price, package credit amount, or
  database schema.
- Exposing webhook secrets, product IDs, or service-role credentials to the
  browser.

## UI and data flow

1. An administrator visits `/admin/payments`.
2. The page obtains the current Supabase access token and calls
   `GET /api/admin/entitlements`.
3. The page displays a clear status badge and a switch:
   - **판매 중 (ON):** new authenticated users can create premium purchase
     intents when the configured Groble payment URL exists.
   - **판매 중지 (OFF):** `POST /api/entitlements/purchase-intents` returns
     `403 PREMIUM_SALES_DISABLED`; existing credits remain usable.
4. Moving from ON to OFF opens a confirmation dialog. Confirming it sends
   `PATCH /api/admin/entitlements` with `{ "premiumEnabled": false }`.
5. Moving from OFF to ON sends the matching `true` value directly.
6. While a request is pending, the switch is disabled. On a failed request, the
   page retains the last confirmed server value and shows a recoverable error.

The UI will use a small client API module with the same token-bearing request
pattern already used for administrator credit management. The API remains the
authorization boundary; the existing `requireAdministrator` check stays in
place.

## UI placement and conflict removal

The control belongs in `/admin/payments`, not `/admin/settings`: it changes a
real payment entitlement rule and the payments page is its dedicated operator
surface. The `paymentModule` item and state from the Settings page will be
removed, so no local browser-only switch can claim to control production sales.
Other Settings page local demo controls are outside this change.

## Error handling

| Condition | UI behavior | Server behavior |
| --- | --- | --- |
| Initial settings request fails | Status unavailable and retry action shown | Existing authenticated endpoint response is surfaced safely. |
| Sales update fails | Switch returns to last confirmed value and error appears | Existing 400/401/403/500 response is surfaced; no optimistic persisted state. |
| Administrator turns sales off | Confirmation required before request | Future purchase-intent creation returns 403. |
| Existing valid webhook arrives while sales are off | No admin UI action needed | Webhook remains eligible to complete its signed, linked purchase grant. |

## Verification

- Client API tests cover authenticated GET and PATCH requests, successful
  responses, malformed responses, and non-2xx errors.
- Payments page tests cover loading, status rendering, OFF confirmation,
  successful state change, and failed update restoration.
- Existing API tests continue to prove only an administrator can update
  `premiumEnabled` and disabled sales block purchase-intent creation.
- Run the relevant Vitest tests and `pnpm check`. Do not run a local production
  build unless an actual `DATABASE_URL` is available.

## Deployment and manual acceptance

1. Push `main`; let Vercel deploy the production commit.
2. Confirm Vercel Production has both server-only variables:
   `GROBLE_WEBHOOK_SECRET` (Sensitive) and
   `GROBLE_PREMIUM_CONTENT_ID` (the exact `data.object.content.id` for the
   premium product). Values must not be committed or pasted into chat.
3. As an administrator, turn sales ON from `/admin/payments`.
4. As an authenticated buyer, start checkout and confirm the Groble URL includes
   the opaque `ref` purchase-intent UUID.
5. Complete a Groble test payment and confirm that buyer's premium analysis
   balance increases by exactly three.
6. Redeliver the same webhook once and confirm the balance does not increase
   again.
7. Turn sales OFF and confirm a new purchase-intent request is rejected with
   `PREMIUM_SALES_DISABLED`, while the buyer's existing credits remain visible.

## Trade-off

The design reuses the existing persisted API rather than adding a second feature
flag or a payment-settings schema. This keeps the user-facing checkout rule and
administrator control on one source of truth. A dedicated payments-page card is
slightly more work than reusing Settings, but avoids presenting a local-only
toggle as an operational control.
