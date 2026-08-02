# Landing Premium Purchase Design

## Goal

Make the premium offer on the landing page actionable and align every landing-page product claim with the configured offer: one payment of ₩9,900 grants three premium analysis credits.

## Scope

- Update the landing pricing copy from a two-credit pass to a three-credit pass.
- Add a visible premium purchase CTA to the pricing card.
- Send that CTA to `/entitlements`, which remains the sole screen that starts a purchase intent and redirects to the payment provider.
- Preserve the existing free-analysis CTA and entitlement balance behavior.

## User flow

1. A visitor sees the premium offer as `₩9,900 / 분석 3회권`.
2. Selecting the premium CTA navigates to `/entitlements`.
3. An authenticated visitor sees their balance and can select the existing `결제하기` button.
4. An unauthenticated visitor is redirected by the existing route guard to login, then returns to `/entitlements` after authentication.
5. The existing server endpoint creates the purchase intent and redirects to the configured Groble payment URL.

## Design choices

The landing page does not create purchase intents directly. This keeps authorization, payment configuration checks, pending-purchase creation, errors, and the purchase CTA in one established flow.

The landing CTA is an enabled navigation button rather than a disabled or "coming soon" control. It does not claim that payment succeeded; the entitlement page remains the confirmation point before leaving for the provider.

## Copy contract

- Price: `₩9,900`
- Product: `분석 3회권`
- Supporting copy: the credits may be used for a revised application or another application.
- The landing price card must not contain the obsolete `2회권` wording.

## Error handling

No new payment error path is introduced on the landing page. Authentication, unavailable sales, missing payment configuration, and checkout failures continue to be handled by the existing entitlement page and API.

## Verification

- Add a focused pricing-section test that asserts the premium CTA navigates to `/entitlements`.
- Update the landing copy test to require `분석 3회권` and reject `2회권`.
- Run the focused pricing and landing-copy tests, then TypeScript checking.
